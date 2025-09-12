// supabase/functions/audio-merge/index.ts
// Audio merge Edge Function – WAV-aware (streaming safe)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
// ffmpeg.wasm for in-function transcoding of mixed audio formats
import { createFFmpeg, fetchFile } from "https://esm.sh/@ffmpeg/ffmpeg@0.11.4";

const VERSION = "audio-merge/wavmerge-2025-09-11-01";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type MergeFromStorageRequest = {
  paths?: string[];
  outputFormat?: "wav";
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

// Concatenate multiple ReadableStreams
function concatStreams(
  streams: ReadableStream<Uint8Array>[],
): ReadableStream<Uint8Array> {
  let i = 0;
  let current: ReadableStreamDefaultReader<Uint8Array> | null = null;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        if (!current) {
          if (i >= streams.length) {
            controller.close();
            return;
          }
          current = streams[i++].getReader();
        }
        const { value, done } = await current.read();
        if (done) {
          current.releaseLock();
          current = null;
          continue;
        }
        controller.enqueue(value);
        return;
      }
    },
  });
}

// --- WAV helpers ---
type WavFmt = {
  audioFormat: number;
  numChannels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
};
type Part = { blob: Blob; dataOffset: number; dataBytes: number; fmt: WavFmt };

function u32(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
}
function u16(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8);
}
function parseHead(h: Uint8Array) {
  const tag = (o: number) => String.fromCharCode(...h.slice(o, o + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") {
    throw new Error("Not WAV/RIFF");
  }
  let off = 12;
  let fmt: WavFmt | undefined;
  let dataOff = -1;
  let dataLen = -1;
  while (off + 8 <= h.length) {
    const id = tag(off);
    const sz = u32(h, off + 4);
    const next = off + 8 + sz + (sz % 2);
    if (id === "fmt ") {
      const b = off + 8;
      fmt = {
        audioFormat: u16(h, b),
        numChannels: u16(h, b + 2),
        sampleRate: u32(h, b + 4),
        byteRate: u32(h, b + 8),
        blockAlign: u16(h, b + 12),
        bitsPerSample: u16(h, b + 14),
      };
    } else if (id === "data") {
      dataOff = off + 8;
      dataLen = sz;
      if (fmt) break;
    }
    off = next;
  }
  if (!fmt || dataOff < 0) throw new Error("Malformed WAV");
  return { fmt, dataOffset: dataOff, dataBytes: dataLen };
}
function wavHeader(totalData: number, f: WavFmt) {
  const h = new Uint8Array(44);
  const dv = new DataView(h.buffer);
  h.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  dv.setUint32(4, 36 + totalData, true);
  h.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
  h.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  dv.setUint32(16, 16, true);
  dv.setUint16(20, f.audioFormat, true);
  dv.setUint16(22, f.numChannels, true);
  dv.setUint32(24, f.sampleRate, true);
  dv.setUint32(28, f.byteRate, true);
  dv.setUint16(32, f.blockAlign, true);
  dv.setUint16(34, f.bitsPerSample, true);
  h.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  dv.setUint32(40, totalData, true);
  return h;
}
// --- end WAV helpers ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, version: VERSION }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed", version: VERSION }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body: MergeFromStorageRequest = await req.json().catch(() => ({}));
    const paths = Array.isArray(body?.paths) ? body.paths : undefined;
    if (!paths || paths.length < 2) {
      return new Response(
        JSON.stringify({ error: "At least 2 files required", version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (paths.length > MAX_FILES) {
      return new Response(
        JSON.stringify({ error: `Too many files (max ${MAX_FILES})`, version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

  const extensions = paths.map(ext);
  const uniqueExts = Array.from(new Set(extensions.filter(Boolean)));

  // If all inputs are WAV and share identical fmt, we will use the fast concatenation path below.
  // Otherwise, fall back to transcoding each input to a canonical WAV (PCM16 mono 8000 Hz) using ffmpeg.wasm
  let needTranscode = !(uniqueExts.length === 1 && uniqueExts[0] === 'wav');

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const parts: Part[] = [];
    let common: WavFmt | null = null;
    let totalBytes = 0;
    let totalPcm = 0;

    // Fast path: if all inputs are WAV, try to parse headers and ensure identical format
    if (!needTranscode) {
      for (const p of paths) {
        const { data, error } = await supabase.storage.from(BUCKET).download(p);
        if (error || !data) {
          return new Response(
            JSON.stringify({ error: `Failed to read: ${p}`, version: VERSION }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        totalBytes += data.size;
        if (totalBytes > MAX_TOTAL_BYTES) {
          return new Response(
            JSON.stringify({ error: "Total size too large", version: VERSION }),
            { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const head = new Uint8Array(await data.slice(0, 4096).arrayBuffer());
        const { fmt, dataOffset, dataBytes } = parseHead(head);
        if (!common) common = fmt;
        const same =
          fmt.audioFormat === common.audioFormat &&
          fmt.numChannels === common.numChannels &&
          fmt.sampleRate === common.sampleRate &&
          fmt.bitsPerSample === common.bitsPerSample &&
          fmt.blockAlign === common.blockAlign &&
          fmt.byteRate === common.byteRate;
        if (!same) {
          // fallback to transcode path if formats differ
          needTranscode = true;
          break;
        }
        totalPcm += dataBytes;
        parts.push({ blob: data, dataOffset, dataBytes, fmt });
      }
    }

    // Transcode path: use ffmpeg.wasm to convert each file to WAV PCM16 mono 8000Hz
    if (needTranscode) {
      // initialize ffmpeg
      const ffmpeg = createFFmpeg({ log: false });
      if (!ffmpeg.isLoaded()) {
        await ffmpeg.load();
      }

      // Process each file sequentially (memory/time heavy; limit file count/size above)
      for (let i = 0; i < paths.length; i++) {
        const p = paths[i];
        const { data, error } = await supabase.storage.from(BUCKET).download(p);
        if (error || !data) {
          return new Response(
            JSON.stringify({ error: `Failed to read: ${p}`, version: VERSION }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        totalBytes += data.size;
        if (totalBytes > MAX_TOTAL_BYTES) {
          return new Response(
            JSON.stringify({ error: "Total size too large", version: VERSION }),
            { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const inName = `in_${i}` + `.${ext(p) || 'bin'}`;
        const outName = `out_${i}.wav`;

        // Write the file to ffmpeg FS
        const arr = new Uint8Array(await data.arrayBuffer());
        ffmpeg.FS('writeFile', inName, arr);

        // Convert to canonical WAV 16-bit PCM mono @ 8000 Hz
        try {
          await ffmpeg.run('-i', inName, '-ac', '1', '-ar', '8000', '-f', 'wav', outName);
        } catch (e) {
          return new Response(
            JSON.stringify({ error: `Transcode failed for: ${p}`, details: String(e), version: VERSION }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const outData = ffmpeg.FS('readFile', outName);
        const blob = new Blob([outData.buffer], { type: 'audio/wav' });

        // parse header and push part
        const head = new Uint8Array(await blob.slice(0, 4096).arrayBuffer());
        const { fmt, dataOffset, dataBytes } = parseHead(head);
        if (!common) common = fmt;
        totalPcm += dataBytes;
        parts.push({ blob, dataOffset, dataBytes, fmt });

        // cleanup ffmpeg FS entries to free memory
        try { ffmpeg.FS('unlink', inName); } catch {};
        try { ffmpeg.FS('unlink', outName); } catch {};
      }
    }

    const header = wavHeader(totalPcm, common!);
    const headerStream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(header);
        c.close();
      },
    });
    const pcmStreams = parts.map((p) =>
      p.blob.slice(p.dataOffset, p.dataOffset + p.dataBytes).stream()
    );
    const mergedStream = concatStreams([headerStream, ...pcmStreams]);

    const destKey = `${body?.namePrefix ?? "merged_audio"}_${Date.now()}.wav`;
    const { data: uploadRes, error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(destKey, mergedStream as unknown as ReadableStream, {
        contentType: "audio/wav",
        upsert: false,
      });

    if (uploadErr || !uploadRes) {
      return new Response(
        JSON.stringify({ error: "Failed to upload merged file", version: VERSION }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body?.deleteSources ?? true) {
      await supabase.storage.from(BUCKET).remove(paths);
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(destKey);
    return new Response(
      JSON.stringify({
        success: true,
        version: VERSION,
        mergedFile: {
          bucket: BUCKET,
          path: destKey,
          url: pub?.publicUrl ?? null,
          contentType: "audio/wav",
          size: totalBytes,
          format: "wav",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Audio merge failed",
        version: VERSION,
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
