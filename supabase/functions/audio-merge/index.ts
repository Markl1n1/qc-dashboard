// supabase/functions/audio-merge/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type MergeFromStorageRequest = {
  // Full paths within your bucket, e.g. "user-123/clip1.mp3"
  paths: string[];
  // Optional: enforce the expected output format (must match inputs)
  outputFormat?: "mp3" | "wav" | "m4a" | "ogg" | "flac";
  // If true, delete source paths after successful merge
  deleteSources?: boolean;
  // Optional: customize destination file name prefix
  namePrefix?: string;
};

const BUCKET = "audio-files";               // your public bucket
const MAX_FILES = 32;                       // cap the number of parts
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;  // 300MB total cap; adjust as needed

// Extension helper (lowercased, no dot)
const ext = (p: string) => {
  const m = p.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
};

// Build a stream that concatenates multiple ReadableStreams<Uint8Array>
function concatStreams(streams: ReadableStream<Uint8Array>[]): ReadableStream<Uint8Array> {
  let i = 0;
  let currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        if (!currentReader) {
          if (i >= streams.length) {
            controller.close();
            return;
          }
          currentReader = streams[i++].getReader();
        }
        const { value, done } = await currentReader.read();
        if (done) {
          currentReader.releaseLock();
          currentReader = null;
          continue; // next stream
        }
        controller.enqueue(value);
        return;
      }
    },
    cancel(reason) {
      try { currentReader?.cancel(reason); } catch {}
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const {
      paths,
      outputFormat,
      deleteSources = true,
      namePrefix = "merged_audio",
    } = (await req.json()) as MergeFromStorageRequest;

    if (!Array.isArray(paths) || paths.length < 2) {
      return new Response(JSON.stringify({ error: "At least 2 files required for merging" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (paths.length > MAX_FILES) {
      return new Response(JSON.stringify({ error: `Too many files (max ${MAX_FILES})` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extensions = paths.map(ext);
    const firstExt = extensions[0];
    if (!firstExt) {
      return new Response(JSON.stringify({ error: "Unable to detect audio format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce identical formats; you said you only need same-format merges.
    const allSame = extensions.every((e) => e === firstExt);
    if (!allSame) {
      return new Response(JSON.stringify({ error: "Wrong audio format: all inputs must share the same extension/codec" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (outputFormat && outputFormat.toLowerCase() !== firstExt) {
      return new Response(
        JSON.stringify({ error: `Wrong audio format: requested output '${outputFormat}' doesn't match inputs '${firstExt}'` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow containers we "byte-concat" safely-ish (still not gapless guaranteed).
    const allowed = new Set(["mp3", "wav", "ogg", "m4a", "flac"]);
    if (!allowed.has(firstExt)) {
      return new Response(
        JSON.stringify({
          error: `Unsupported format '${firstExt}'. This endpoint only concatenates identical containers/codecs (e.g. all mp3 or all wav).`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // Service role key allows deleting source files when requested.
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[AudioMerge] Streaming merge of ${paths.length} *.${firstExt} files`);

    // Pull blobs & build stream list; keep a running size total to guard memory/storage.
    const sourceStreams: ReadableStream<Uint8Array>[] = [];
    let totalBytes = 0;

    for (const p of paths) {
      const { data, error } = await supabase.storage.from(BUCKET).download(p);
      if (error || !data) {
        console.error(`[AudioMerge] Failed to open ${p}:`, error);
        return new Response(JSON.stringify({ error: `Failed to read: ${p}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      totalBytes += data.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        return new Response(
          JSON.stringify({
            error: `Total size too large (${(totalBytes / (1024 * 1024)).toFixed(1)} MB). Max ${(MAX_TOTAL_BYTES / (1024 * 1024)).toFixed(0)} MB.`,
          }),
          { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      sourceStreams.push(data.stream());
    }

    const mergedStream = concatStreams(sourceStreams);

    const timestamp = Date.now();
    const destKey = `${namePrefix}_${timestamp}.${firstExt}`;
    const contentType =
      firstExt === "mp3" ? "audio/mpeg" :
      firstExt === "wav" ? "audio/wav" :
      firstExt === "ogg" ? "audio/ogg" :
      firstExt === "m4a" ? "audio/mp4" :
      firstExt === "flac" ? "audio/flac" :
      `audio/${firstExt}`;

    console.log(`[AudioMerge] Uploading merged stream to ${BUCKET}/${destKey}`);

    // Upload without buffering whole result in RAM
    const { data: uploadRes, error: uploadErr } = await supabase.storage
      .from(BUCKET)
      // Supabase Storage SDK in Deno accepts ReadableStream | Blob | ArrayBuffer
      .upload(destKey, mergedStream as unknown as ReadableStream, {
        contentType,
        upsert: false,
      });

    if (uploadErr || !uploadRes) {
      console.error("[AudioMerge] Upload failed:", uploadErr);
      return new Response(JSON.stringify({ error: "Failed to upload merged file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (deleteSources) {
      const { error: delErr } = await supabase.storage.from(BUCKET).remove(paths);
      if (delErr) {
        console.warn("[AudioMerge] Merged, but failed to delete some sources:", delErr);
      } else {
        console.log(`[AudioMerge] Deleted ${paths.length} source files`);
      }
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(destKey);
    const publicUrl = pub?.publicUrl ?? null;

    const payload = {
      success: true,
      mergedFile: {
        bucket: BUCKET,
        path: destKey,
        url: publicUrl,      // public bucket -> usable directly by the client
        contentType,
        size: totalBytes,    // concatenated size
        format: firstExt,
      },
      note: "Merged via streaming concatenation; inputs were required to have identical formats.",
    };

    console.log(`[AudioMerge] Success -> ${destKey} (${(totalBytes / (1024 * 1024)).toFixed(1)} MB)`);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[AudioMerge] Error:", err);
    return new Response(
      JSON.stringify({
        error: "Audio merge failed",
        details: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
