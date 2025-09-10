// supabase/functions/audio-merge/index.ts
// Deno edge function. Корректная склейка WAV, stream-конкат для других форматов.
// Возвращает signedUrl + publicUrl, делает HEAD/PEEK для диагностики.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const VERSION = "audio-merge/streaming-2025-09-10-02";
const BUCKET = "audio-files";
const MAX_FILES = 32;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type MergeFromStorageRequest = {
  paths?: string[];
  outputFormat?: "wav" | "mp3" | "ogg" | "m4a" | "flac";
  deleteSources?: boolean;
  namePrefix?: string;
};

// ---- WAV helpers ----
type WavInfo = {
  audioFormat: number; // 1 = PCM
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
};

function readWavInfo(buf: ArrayBuffer): WavInfo {
  const v = new DataView(buf);
  // 'RIFF' + size + 'WAVE'
  if (v.getUint32(0, false) !== 0x52494646 || v.getUint32(8, false) !== 0x57415645) {
    throw new Error("Not a WAV (missing RIFF/WAVE)");
  }
  let pos = 12;
  let fmtFound = false, dataFound = false;
  const info: Partial<WavInfo> = {};

  while (pos + 8 <= v.byteLength) {
    const id = v.getUint32(pos, false); pos += 4;
    const size = v.getUint32(pos, true); pos += 4; // little-endian
    if (id === 0x666d7420) { // 'fmt '
      fmtFound = true;
      info.audioFormat = v.getUint16(pos + 0, true);
      info.numChannels = v.getUint16(pos + 2, true);
      info.sampleRate = v.getUint32(pos + 4, true);
      info.bitsPerSample = v.getUint16(pos + 14, true);
    } else if (id === 0x64617461) { // 'data'
      dataFound = true;
      info.dataOffset = pos;
      info.dataSize = size;
      break; // берём первый data
    }
    pos += size + (size % 2); // word-aligned
  }
  if (!fmtFound || !dataFound) throw new Error("Invalid WAV (no fmt/data)");
  return info as WavInfo;
}

function buildWav(files: ArrayBuffer[], infos: WavInfo[]): ArrayBuffer {
  const ref = infos[0];
  if (ref.audioFormat !== 1) throw new Error("Only PCM WAV is supported");
  const same = infos.every(i =>
    i.audioFormat === ref.audioFormat &&
    i.sampleRate === ref.sampleRate &&
    i.bitsPerSample === ref.bitsPerSample &&
    i.numChannels === ref.numChannels
  );
  if (!same) throw new Error("WAV params mismatch (rate/bits/channels)");

  const totalData = infos.reduce((s, i) => s + i.dataSize, 0);
  const headerSize = 44; // canonical PCM header
  const out = new ArrayBuffer(headerSize + totalData);
  const w = new DataView(out);

  // 'RIFF'
  w.setUint32(0, 0x52494646, false);
  w.setUint32(4, out.byteLength - 8, true);
  w.setUint32(8, 0x57415645, false); // 'WAVE'
  // 'fmt ' chunk
  w.setUint32(12, 0x666d7420, false);
  w.setUint32(16, 16, true); // fmt chunk size
  w.setUint16(20, 1, true); // PCM
  w.setUint16(22, ref.numChannels, true);
  w.setUint32(24, ref.sampleRate, true);
  const byteRate = ref.sampleRate * ref.numChannels * (ref.bitsPerSample / 8);
  w.setUint32(28, byteRate, true);
  const blockAlign = ref.numChannels * (ref.bitsPerSample / 8);
  w.setUint16(32, blockAlign, true);
  w.setUint16(34, ref.bitsPerSample, true);
  // 'data'
  w.setUint32(36, 0x64617461, false);
  w.setUint32(40, totalData, true);

  // payloads
  let off = headerSize;
  const outU8 = new Uint8Array(out);
  files.forEach((buf, idx) => {
    const i = infos[idx];
    outU8.set(new Uint8Array(buf, i.dataOffset, i.dataSize), off);
    off += i.dataSize;
  });
  return out;
}

// ---- Request parsing ----
async function parseBody(req: Request): Promise<{ body: MergeFromStorageRequest | null; contentType: string; rawLen: number }> {
  const contentType = req.headers.get("content-type") || "";
  let raw = "";
  try { raw = await req.text(); } catch {}
  const rawLen = raw.length;

  if (contentType.includes("application/json")) {
    try { return { body: raw ? JSON.parse(raw) : null, contentType, rawLen }; }
    catch { return { body: null, contentType, rawLen }; }
  }

  if (contentType.includes("multipart/form-data")) {
    try {
      // Deno: formData через повторный Request
      const fd = await (new Request(req.url, { method: req.method, headers: req.headers, body: (await req.blob?.()) as any })).formData();
      const p = fd.get("paths");
      const of = fd.get("outputFormat");
      const ds = fd.get("deleteSources");
      const np = fd.get("namePrefix");
      let paths: string[] | undefined;
      if (typeof p === "string") { try { paths = JSON.parse(p); } catch {} }
      else if (p && typeof (p as any).text === "function") { try { paths = JSON.parse(await (p as File).text()); } catch {} }
      return {
        body: {
          paths,
          outputFormat: typeof of === "string" ? (of as any) : undefined,
          deleteSources: typeof ds === "string" ? ds === "true" : undefined,
          namePrefix: typeof np === "string" ? np : undefined,
        },
        contentType, rawLen
      };
    } catch {
      return { body: null, contentType, rawLen };
    }
  }

  // x-www-form-urlencoded fallback
  try {
    const params = new URLSearchParams(raw);
    const p = params.get("paths");
    return {
      body: { paths: p ? JSON.parse(p) : undefined },
      contentType, rawLen
    };
  } catch {
    return { body: null, contentType, rawLen };
  }
}

function inferContentType(ext: string): string {
  return ext === "mp3" ? "audio/mpeg"
    : ext === "wav" ? "audio/wav"
    : ext === "ogg" ? "audio/ogg"
    : ext === "m4a" ? "audio/mp4"
    : ext === "flac" ? "audio/flac"
    : `audio/${ext}`;
}

function concatStreams(readables: ReadableStream<Uint8Array>[]): ReadableStream<Uint8Array> {
  let i = 0;
  let currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        if (!currentReader) {
          if (i >= readables.length) { controller.close(); return; }
          currentReader = readables[i++].getReader();
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
  // CORS / health
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true, version: VERSION }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed", version: VERSION }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    const { body, contentType, rawLen } = await parseBody(req);
    console.error(`[AudioMerge] INVOKE ${VERSION} ct=${contentType} rawLen=${rawLen}`);
    console.error("[AudioMerge] Parsed keys:", body ? Object.keys(body) : []);

    const paths = Array.isArray(body?.paths) ? body!.paths : undefined;
    console.error("[AudioMerge] Resolved paths length:", paths?.length ?? 0);

    if (!Array.isArray(paths) || paths.length < 2) {
      return new Response(JSON.stringify({
        error: "At least 2 files required for merging",
        version: VERSION,
        debug: { contentType, rawLen, parsedKeys: body ? Object.keys(body) : [] },
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (paths.length > MAX_FILES) {
      return new Response(JSON.stringify({ error: `Too many files (max ${MAX_FILES})`, version: VERSION }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // infer format from first extension (all files должны совпадать)
    const first = paths[0];
    const firstExt = (first.split(".").pop() || "").toLowerCase();
    const allSame = paths.every(p => (p.split(".").pop() || "").toLowerCase() === firstExt);
    if (!firstExt || !allSame) {
      return new Response(JSON.stringify({ error: "All files must have the same extension", version: VERSION }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // download all
    const objects: { stream?: ReadableStream<Uint8Array>; buffer?: ArrayBuffer; info?: WavInfo }[] = [];

    if (firstExt === "wav") {
      for (const p of paths) {
        const { data: f, error: e } = await supabase.storage.from(BUCKET).download(p);
        if (e || !f) {
          console.error("[AudioMerge] Download failed:", p, e);
          return new Response(JSON.stringify({ error: "Download failed", version: VERSION }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const buf = await f.arrayBuffer();
        const info = readWavInfo(buf);
        objects.push({ buffer: buf, info });
      }
    } else {
      for (const p of paths) {
        const { data: f, error: e } = await supabase.storage.from(BUCKET).download(p);
        if (e || !f) {
          console.error("[AudioMerge] Download failed:", p, e);
          return new Response(JSON.stringify({ error: "Download failed", version: VERSION }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // @ts-ignore ReadableStream present in Deno Response
        objects.push({ stream: f.stream() });
      }
    }

    const ts = Date.now();
    const destKey = `${body?.namePrefix ?? "merged_audio"}_${ts}.${firstExt}`;
    const contentTypeOut = inferContentType(firstExt);

    console.error(`[AudioMerge] UPLOAD -> ${BUCKET}/${destKey}`);

    if (firstExt === "wav") {
      const bufs = objects.map(o => o.buffer!) as ArrayBuffer[];
      const infos = objects.map(o => o.info!) as WavInfo[];
      const mergedBuf = buildWav(bufs, infos);

      const { data: uploadRes, error: uploadErr } = await supabase.storage
        .from(BUCKET)
        // @ts-ignore: supabase-js v2 принимает Blob | File | ArrayBuffer
        .upload(destKey, mergedBuf, {
          contentType: contentTypeOut,
          upsert: false,
        });

      if (uploadErr || !uploadRes) {
        console.error("[AudioMerge] Upload failed:", uploadErr);
        return new Response(JSON.stringify({ error: "Failed to upload merged file", version: VERSION }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const mergedStream = concatStreams(objects.map(o => o.stream!));
      const { data: uploadRes, error: uploadErr } = await supabase.storage
        .from(BUCKET)
        // @ts-ignore: ReadableStream допустим в Deno runtime
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
    }

    // cleanup sources (best-effort)
    if (body?.deleteSources ?? true) {
      const { error: delErr } = await supabase.storage.from(BUCKET).remove(paths);
      if (delErr) console.error("[AudioMerge] Source delete failed:", delErr);
      else console.error(`[AudioMerge] Deleted ${paths.length} sources`);
    }

    // URLs
    const { data: signedData, error: signedErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(destKey, 60 * 60, { download: true }); // 1ч

    if (signedErr) console.error("[AudioMerge] Signed URL failed:", signedErr);

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(destKey);
    const publicUrl = pub?.publicUrl ?? null;
    const finalUrl = signedData?.signedUrl ?? publicUrl;

    // HEAD/PEEK diagnostics
    try {
      if (finalUrl) {
        const head = await fetch(finalUrl, { method: "HEAD" });
        console.error("[AudioMerge] HEAD merged:", {
          status: head.status,
          ct: head.headers.get("content-type"),
          cl: head.headers.get("content-length")
        });
        const peekRes = await fetch(finalUrl, { headers: { Range: "bytes=0-63" } });
        const peekBuf = new Uint8Array(await peekRes.arrayBuffer());
        const hex = Array.from(peekBuf).map(b => b.toString(16).padStart(2, "0")).join(" ");
        console.error("[AudioMerge] PEEK hex:", hex);
      }
    } catch (e) {
      console.error("[AudioMerge] HEAD/PEEK failed:", e);
    }

    return new Response(JSON.stringify({
      success: true,
      version: VERSION,
      mergedFile: {
        bucket: BUCKET,
        path: destKey,
        url: finalUrl,
        signedUrl: signedData?.signedUrl ?? null,
        publicUrl,
        contentType: contentTypeOut,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[AudioMerge] FATAL ERROR:", err);
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