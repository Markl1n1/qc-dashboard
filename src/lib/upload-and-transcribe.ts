// frontend/src/lib/upload-and-transcribe.ts
import { mergeAudioFilesTo8kWav } from "./merge-audio-to-wav";
import { createClient } from "@supabase/supabase-js";

type TranscribeParams = {
  files: File[];
  supabaseUrl: string;
  supabaseAnonKey: string;
  bucket?: string;           // default: "audio-files"
  namePrefix?: string;       // default: "merged_audio"
  deepgramEdgeUrl?: string;  // e.g., "/functions/v1/deepgram-transcribe"
  deepgramPayloadExtras?: Record<string, any>; // forwarded to your function (language, diarize, etc.)
  onProgress?: (stage: string, i?: number, n?: number) => void;
};

export async function uploadAndTranscribeMerged8k(params: TranscribeParams) {
  const {
    files,
    supabaseUrl,
    supabaseAnonKey,
    bucket = "audio-files",
    namePrefix = "merged_audio",
    deepgramEdgeUrl = "/functions/v1/deepgram-transcribe",
    deepgramPayloadExtras = { language: "pl", diarize: true, utterances: true, smart_format: true, filler_words: true },
    onProgress,
  } = params;

  onProgress?.("merge:start");
  const { blob, durationSec } = await mergeAudioFilesTo8kWav(files, {
    onProgress: (stage, i, n) => onProgress?.(`merge:${stage}`, i, n),
  });

  // Upload WAV
  onProgress?.("upload:start");
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const filename = `${namePrefix}_${Date.now()}.wav`;
  const { data: up, error: upErr } = await supabase.storage
    .from(bucket)
    .upload(filename, blob, { contentType: "audio/wav", upsert: false });

  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filename);
  const publicUrl = pub?.publicUrl ?? null;

  onProgress?.("transcribe:start");

  // Call your Deepgram Edge function (assumes it supports { url } mode).
  // If your function expects a storage path instead, send { bucket, path }.
  const resp = await fetch(deepgramEdgeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: publicUrl,
      // Or: bucket, path: filename,
      ...deepgramPayloadExtras,
    }),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = json?.error || resp.statusText || "Deepgram transcription failed";
    throw new Error(msg);
  }

  onProgress?.("done");
  return {
    storagePath: filename,
    publicUrl,
    durationSec,
    deepgramResponse: json,
  };
}
