// supabase/functions/audio-merge/index.ts
// Keep std at 0.168.0 (matches your runtime); add explicit version + health GET.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const VERSION = "audio-merge/streaming-2025-09-08-01";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type MergeFromStorageRequest = {
  paths?: string[];
  files?: unknown;  // legacy field (diagnostics only)
  outputFormat?: "mp3" | "wav" | "m4a" | "ogg" | "flac";
  deleteSources?: boolean;
  namePrefix?: string;
};

const BUCKET = "audio-files";
const MAX_FILES = 32;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;

const ext = (p: string) => {
  const m = p.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
};

function concatStreams(streams: ReadableStream<Uint8Array>[]): ReadableStream<Uint8Array> {
  let i = 0;
  let currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        if (!currentReader) {
          if (i >= streams.length) { controller.close(); return; }
          currentReader = streams[i++].getReader();
        }
        const { value, done } = await currentReader.read();
        if (done) { currentReader.releaseLock(); currentReader = null; continue; }
        controller.enqueue(value);
        return;
      }
    },
    cancel(reason) { try { currentReader?.cancel(reason); } catch {} },
  });
}

// Never-throw body parser with raw echoing (for diagnostics).
async function parseBody(req: Request): Promise<{ body: MergeFromStorageRequest | null; contentType: string; rawLen: number }> {
  const contentType = req.headers.get("content-type") || "";
  // Read the body once as text to avoid "already read" errors.
  let raw = "";
  try { raw = await req.text(); } catch {}
  const rawLen = raw.length;

  // application/json → parse JSON
  if (contentType.includes("application/json")) {
    try { return { body: raw ? JSON.parse(raw) : null, contentType, rawLen }; }
    catch { return { body: null, contentType, rawLen }; }
  }

  if (contentType.includes("multipart/form-data")) {
    try {
      const fd = await (new Request(req.url, { method: req.method, headers: req.headers, body: (await req.blob?.()) as any })).formData();
      const p = fd.get("paths");
      const of = fd.get("outputFormat");
      const ds = fd.get("deleteSources");
      const np = fd.get("namePrefix");
      let paths: string[] | undefined;
      if (typeof p === "string") { try { paths = JSON.parse(p); } catch {} }
      // @ts-ignore deno types for File
      else if (p && "text" in p) { try { paths = JSON.parse(await (p as File).text()); } catch {} }
      return {
        body: {
          paths,
          outputFormat: typeof of === "string" ? (of as any) : undefined,
          deleteSources: typeof ds === "string" ? ds === "true" : undefined,
          namePrefix: typeof np === "string" ? np : undefined,
        },
        contentType,
        rawLen,
      };
    } catch {
      return { body: null, contentType, rawLen };
    }
  }

  // Fallback: try JSON first, then URL-encoded params
  try { return { body: raw ? JSON.parse(raw) : null, contentType, rawLen }; } catch {}
  try {
    const params = new URLSearchParams(raw);
    const p = params.get("paths");
    let paths: string[] | undefined;
    if (p) { try { paths = JSON.parse(p); } catch {} }
    return {
      body: {
        paths,
        outputFormat: params.get("outputFormat") as any,
        deleteSources: params.get("deleteSources") === "true",
        namePrefix: params.get("namePrefix") ?? undefined,
      },
      contentType,
      rawLen,
    };
  } catch {
    return { body: null, contentType, rawLen };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Health check / version probe
  if (req.method === "GET") {
    console.error(`[AudioMerge] HEALTHCHECK ${VERSION}`); // error-level so it shows on "Highest"
    return new Response(JSON.stringify({ ok: true, version: VERSION }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed", version: VERSION }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { body, contentType, rawLen } = await parseBody(req);
    console.error(`[AudioMerge] INVOKE ${VERSION} ct=${contentType} rawLen=${rawLen}`);
    console.error("[AudioMerge] Parsed keys:", body ? Object.keys(body) : []);

    if (body?.files && !body.paths) {
      console.error("[AudioMerge] Received legacy 'files'. This endpoint expects 'paths' to Storage objects.");
    }

    const paths = Array.isArray(body?.paths) ? body!.paths : undefined;
    console.error("[AudioMerge] Resolved paths length:", paths?.length ?? 0);
    if (!Array.isArray(paths) || paths.length < 2) {
      return new Response(
        JSON.stringify({
          error: "At least 2 files required for merging",
          version: VERSION,
          debug: { contentType, rawLen, parsedKeys: body ? Object.keys(body) : [] },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (paths.length > MAX_FILES) {
      return new Response(JSON.stringify({ error: `Too many files (max ${MAX_FILES})`, version: VERSION }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format checks
    const extensions = paths.map(ext);
    const firstExt = extensions[0];
    if (!firstExt) {
      return new Response(JSON.stringify({ error: "Unable to detect audio format", version: VERSION }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!extensions.every((e) => e === firstExt)) {
      return new Response(JSON.stringify({ error: "Wrong audio format: all inputs must share the same extension/codec", version: VERSION }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body?.outputFormat && body.outputFormat.toLowerCase() !== firstExt) {
      return new Response(JSON.stringify({
        error: `Wrong audio format: requested output '${body.outputFormat}' doesn't match inputs '${firstExt}'`,
        version: VERSION,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const allowed = new Set(["mp3", "wav", "ogg", "m4a", "flac"]);
    if (!allowed.has(firstExt)) {
      return new Response(JSON.stringify({
        error: `Unsupported format '${firstExt}'. Only identical containers/codecs are concatenated.`,
        version: VERSION,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.error(`[AudioMerge] START stream merge (${paths.length} *.${firstExt})`);

    // Stream sources
    const sourceStreams: ReadableStream<Uint8Array>[] = [];
    let totalBytes = 0;

    for (const p of paths) {
      const { data, error } = await supabase.storage.from(BUCKET).download(p);
      if (error || !data) {
        console.error(`[AudioMerge] Failed to open ${p}:`, error);
        return new Response(JSON.stringify({ error: `Failed to read: ${p}`, version: VERSION }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      totalBytes += data.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        return new Response(JSON.stringify({
          error: `Total size too large (${(totalBytes / (1024 * 1024)).toFixed(1)} MB). Max ${(MAX_TOTAL_BYTES / (1024 * 1024)).toFixed(0)} MB.`,
          version: VERSION,
        }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      sourceStreams.push(data.stream());
    }

    const mergedStream = concatStreams(sourceStreams);

    const ts = Date.now();
    const destKey = `${body?.namePrefix ?? "merged_audio"}_${ts}.${firstExt}`;
    const contentTypeOut =
      firstExt === "mp3" ? "audio/mpeg" :
      firstExt === "wav" ? "audio/wav" :
      firstExt === "ogg" ? "audio/ogg" :
      firstExt === "m4a" ? "audio/mp4" :
      firstExt === "flac" ? "audio/flac" : `audio/${firstExt}`;

    console.error(`[AudioMerge] UPLOAD -> ${BUCKET}/${destKey}`);

    const { data: uploadRes, error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(destKey, mergedStream as unknown as ReadableStream, {
        contentType: contentTypeOut,
        upsert: false,
      });

    if (uploadErr || !uploadRes) {
      console.error("[AudioMerge] Upload failed:", uploadErr);
      return new Response(JSON.stringify({ error: "Failed to upload merged file", version: VERSION }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body?.deleteSources ?? true) {
      const { error: delErr } = await supabase.storage.from(BUCKET).remove(paths);
      if (delErr) console.error("[AudioMerge] Source delete failed:", delErr);
      else console.error(`[AudioMerge] Deleted ${paths.length} sources`);
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(destKey);
    const publicUrl = pub?.publicUrl ?? null;

    return new Response(JSON.stringify({
      success: true,
      version: VERSION,
      mergedFile: {
        bucket: BUCKET,
        path: destKey,
        url: publicUrl,
        contentType: contentTypeOut,
        size: totalBytes,
        format: firstExt,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[AudioMerge] FATAL ERROR:", err);
    console.error("[AudioMerge] Error Stack:", err instanceof Error ? err.stack : 'No stack trace');
    console.error("[AudioMerge] Error Type:", typeof err);
    console.error("[AudioMerge] Error Details:", {
      name: err instanceof Error ? err.name : 'Unknown',
      message: err instanceof Error ? err.message : String(err),
      cause: err instanceof Error ? err.cause : undefined
    });
    
    return new Response(JSON.stringify({
      error: "Audio merge failed",
      version: VERSION,
      details: err instanceof Error ? err.message : "Unknown error",
      errorType: err instanceof Error ? err.name : typeof err,
      timestamp: new Date().toISOString()
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
