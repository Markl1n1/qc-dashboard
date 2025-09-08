import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type MergeFromStorageRequest = {
  // preferred: array of storage paths
  paths?: string[];
  // legacy: array of base64 files (we won't support merging those here, but we’ll detect presence)
  files?: unknown;
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ---- parse & log body (super helpful for mismatches) ----
    let body: MergeFromStorageRequest | undefined;
    try {
      body = await req.json();
    } catch (e) {
      console.error("[AudioMerge] Failed to parse JSON body:", e);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[AudioMerge] Incoming body:", JSON.stringify(body));

    // Prefer new contract: paths[]
    let paths: string[] | undefined = Array.isArray(body?.paths) ? body!.paths : undefined;

    // If someone accidentally sends {files: [...]}, make that obvious in logs.
    if (!paths && body?.files) {
      console.warn("[AudioMerge] Received 'files' field (legacy). This function expects 'paths' to Storage objects.");
    }

    const { outputFormat, deleteSources = true, namePrefix = "merged_audio" } = body ?? {};

    // ---- item count validation ----
    if (!Array.isArray(paths) || paths.length < 2) {
      return new Response(JSON.stringify({ error: "At least 2 files required for merging" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (paths.length > MAX_FILES) {
      return new Response(JSON.stringify({ error: `Too many files (max ${MAX_FILES})` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- format validation (same extension) ----
    const extensions = paths.map(ext);
    const firstExt = extensions[0];
    if (!firstExt) {
      return new Response(JSON.stringify({ error: "Unable to detect audio format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!extensions.every((e) => e === firstExt)) {
      return new Response(JSON.stringify({ error: "Wrong audio format: all inputs must share the same extension/codec" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (outputFormat && outputFormat.toLowerCase() !== firstExt) {
      return new Response(
        JSON.stringify({ error: `Wrong audio format: requested output '${outputFormat}' doesn't match inputs '${firstExt}'` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowed = new Set(["mp3", "wav", "ogg", "m4a", "flac"]);
    if (!allowed.has(firstExt)) {
      return new Response(
        JSON.stringify({ error: `Unsupported format '${firstExt}'. Only identical containers/codecs are concatenated.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[AudioMerge] Streaming merge of ${paths.length} *.${firstExt} files`, paths);

    const sourceStreams: ReadableStream<Uint8Array>[] = [];
    let totalBytes = 0;

    for (const p of paths) {
      const { data, error } = await supabase.storage.from(BUCKET).download(p);
      if (error || !data) {
        console.error(`[AudioMerge] Failed to open ${p}:`, error);
        return new Response(JSON.stringify({ error: `Failed to read: ${p}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      totalBytes += data.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        return new Response(JSON.stringify({
          error: `Total size too large (${(totalBytes / (1024 * 1024)).toFixed(1)} MB). Max ${(MAX_TOTAL_BYTES / (1024 * 1024)).toFixed(0)} MB.`,
        }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      sourceStreams.push(data.stream());
    }

    const mergedStream = concatStreams(sourceStreams);

    const ts = Date.now();
    const destKey = `${namePrefix}_${ts}.${firstExt}`;
    const contentType =
      firstExt === "mp3" ? "audio/mpeg" :
      firstExt === "wav" ? "audio/wav" :
      firstExt === "ogg" ? "audio/ogg" :
      firstExt === "m4a" ? "audio/mp4" :
      firstExt === "flac" ? "audio/flac" : `audio/${firstExt}`;

    console.log(`[AudioMerge] Uploading merged stream -> ${BUCKET}/${destKey}`);

    const { data: uploadRes, error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(destKey, mergedStream as unknown as ReadableStream, {
        contentType,
        upsert: false,
      });

    if (uploadErr || !uploadRes) {
      console.error("[AudioMerge] Upload failed:", uploadErr);
      return new Response(JSON.stringify({ error: "Failed to upload merged file" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (deleteSources) {
      const { error: delErr } = await supabase.storage.from(BUCKET).remove(paths);
      if (delErr) console.warn("[AudioMerge] Merged, but failed to delete some sources:", delErr);
      else console.log(`[AudioMerge] Deleted ${paths.length} source files`);
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(destKey);
    const publicUrl = pub?.publicUrl ?? null;

    return new Response(JSON.stringify({
      success: true,
      mergedFile: {
        bucket: BUCKET,
        path: destKey,
        url: publicUrl,
        contentType,
        size: totalBytes,
        format: firstExt,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[AudioMerge] Error:", err);
    return new Response(JSON.stringify({
      error: "Audio merge failed",
      details: err instanceof Error ? err.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
