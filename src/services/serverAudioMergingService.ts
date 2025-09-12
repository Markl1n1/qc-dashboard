// src/services/serverAudioMergingService.ts

/* eslint-disable no-console */

import { mergeAudioFilesTo8kWav } from "@/lib/merge-audio-to-wav";
import type { SupabaseClient } from "@supabase/supabase-js";

// Optional: create a default Supabase client for the WAV server path
let defaultSupabase: SupabaseClient | undefined;
try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require("@supabase/supabase-js");
    defaultSupabase = createClient(url, anon);
  }
} catch {
  // no-op
}

type Stage =
  | "idle"
  | "validating"
  | "uploading"
  | "merging"
  | "downloading"
  | "complete"
  | "error";

export type ProgressEvent = {
  stage: Stage;
  progress: number; // 0..100
  message?: string;
};

// Kept for Upload.tsx imports
export type ServerMergingProgress = ProgressEvent;

export type ProgressUpdater = (evt: ProgressEvent) => void;

export type ServerAudioMergingServiceOptions = {
  onProgress?: ProgressUpdater;
  edgeMergeUrl?: string;
  useSupabaseFunctionsInvoke?: boolean;
  tempBucket?: string;
  outputSampleRate?: number;
  normalizePeak?: boolean;
};

export class ServerAudioMergingService {
  private supabase?: SupabaseClient;
  private opts: Required<ServerAudioMergingServiceOptions>;

  constructor(supabaseClient?: SupabaseClient, options?: ServerAudioMergingServiceOptions) {
    this.supabase = supabaseClient;
    this.opts = {
      onProgress: options?.onProgress ?? (() => void 0),
      edgeMergeUrl:
        options?.edgeMergeUrl ??
        (process.env.NEXT_PUBLIC_SUPABASE_URL
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/audio-merge`
          : ""),
      useSupabaseFunctionsInvoke: options?.useSupabaseFunctionsInvoke ?? !!supabaseClient,
      tempBucket: options?.tempBucket ?? "tmp-audio",
      outputSampleRate: options?.outputSampleRate ?? 8000,
      normalizePeak: options?.normalizePeak ?? false,
    };
  }

  // 🔁 Restored to maintain backward compatibility with Upload.tsx
  public setProgressCallback(cb?: ProgressUpdater) {
    this.opts = { ...this.opts, onProgress: cb ?? (() => void 0) };
  }

  private updateProgress(stage: Stage, progress: number, message?: string) {
    this.opts.onProgress?.({ stage, progress, message });
  }

  /**
   * Merges a batch of audio Files.
   * - WAV-only → server path (concat, no re-encode).
   * - Otherwise (mp3/flac/m4a/ogg/…) → client path → single 8k mono WAV.
   */
  async mergeAudioFiles(files: File[]): Promise<File> {
    this.updateProgress("validating", 5, "Validating audio files...");

    if (!files?.length) throw new Error("No files provided for merging.");
    if (files.length === 1) return files[0];

    const exts = files.map((f) => this.extOf(f.name));
    const firstExt = exts[0];
    const allSame = exts.every((e) => e === firstExt);
    if (!allSame) throw new Error("Wrong audio format: all files must have the same extension.");

    const allowed = new Set(["mp3", "wav", "flac", "ogg", "m4a", "aac", "webm"]);
    if (!allowed.has(firstExt)) {
      throw new Error(`Unsupported format '${firstExt}'. Allowed: ${Array.from(allowed).join(", ")}`);
    }

    if (firstExt !== "wav") {
      return await this.mergeClientSideToWav(files);
    }

    return await this.mergeServerSideWav(files);
  }

  // ---------------------------
  // Client-side (non-WAV) path
  // ---------------------------

  private async mergeClientSideToWav(files: File[]): Promise<File> {
    this.updateProgress("merging", 10, "Merging in browser (converting to 8 kHz WAV)...");

    const { blob, durationSec, sampleRate, channels } = await mergeAudioFilesTo8kWav(files, {
      onProgress: (stage, i, n) => {
        const map: Record<string, number> = { decoding: 20, resampling: 40, concatenating: 60, encoding: 80 };
        const base = map[stage] ?? 20;
        const pct = base + Math.floor(((i ?? 0) / Math.max(1, n ?? files.length)) * 15);
        this.updateProgress("merging", Math.min(95, pct), `Merging (${stage})...`);
      },
      normalizePeak: this.opts.normalizePeak,
      targetSampleRate: 8000,
      targetChannels: 1,
    });

    const mergedName = `merged_${Date.now()}.wav`;
    const mergedFile = new File([blob], mergedName, { type: "audio/wav", lastModified: Date.now() });

    console.log("✅ Client-side merge complete:", {
      mergedName,
      durationSec,
      sampleRate,
      channels,
      size: mergedFile.size,
    });

    this.updateProgress("complete", 100, "Merge complete.");
    return mergedFile;
  }

  // ---------------------------
  // Server-side WAV→WAV path
  // ---------------------------

  private async mergeServerSideWav(files: File[]): Promise<File> {
    if (!this.supabase) {
      throw new Error("Supabase client not available. Provide it to use the server-side WAV merge.");
    }

    const batchId = `merge_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const bucket = this.opts.tempBucket;

    this.updateProgress("uploading", 10, "Uploading WAV files...");

    const uploadedPaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = `${batchId}/${i.toString().padStart(3, "0")}_${this.safeName(f.name)}`;

      const { error: upErr } = await this.supabase.storage.from(bucket).upload(path, f, {
        cacheControl: "3600",
        contentType: "audio/wav",
        upsert: false,
      });
      if (upErr) {
        this.updateProgress("error", 100, "Upload failed.");
        throw new Error(`Failed to upload ${f.name}: ${upErr.message}`);
      }

      uploadedPaths.push(path);
      const pct = 10 + Math.floor(((i + 1) / files.length) * 30); // → 40%
      this.updateProgress("uploading", pct, `Uploaded ${i + 1}/${files.length}...`);
    }

    this.updateProgress("merging", 45, "Merging on server...");

    const body = {
      bucket,
      inputPaths: uploadedPaths,
      outputSampleRate: this.opts.outputSampleRate,
      outputChannels: 1,
      outputFormat: "wav",
    };

    let mergedArrayBuffer: ArrayBuffer | null = null;

    if (this.opts.useSupabaseFunctionsInvoke) {
      // @ts-ignore - invoke typing lives on Supabase client
      const { data, error } = await this.supabase.functions.invoke("audio-merge", { body });
      if (error) {
        this.updateProgress("error", 100, "Server merge failed.");
        throw new Error(`Edge merge error: ${error.message}`);
      }
      if (data instanceof ArrayBuffer) {
        mergedArrayBuffer = data;
      } else if (data?.url) {
        const r = await fetch(data.url);
        if (!r.ok) throw new Error(`Failed to download merged file from URL (status ${r.status}).`);
        mergedArrayBuffer = await r.arrayBuffer();
      } else if (data?.bytes) {
        mergedArrayBuffer = new Uint8Array(data.bytes).buffer;
      } else {
        throw new Error("Unexpected edge function response for merged data.");
      }
    } else {
      if (!this.opts.edgeMergeUrl) {
        throw new Error("edgeMergeUrl not configured. Set edgeMergeUrl or enable useSupabaseFunctionsInvoke.");
      }
      const r = await fetch(this.opts.edgeMergeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        this.updateProgress("error", 100, "Server merge failed.");
        throw new Error(`Edge merge request failed (${r.status}): ${text || r.statusText}`);
      }
      mergedArrayBuffer = await r.arrayBuffer();
    }

    this.updateProgress("downloading", 85, "Preparing merged file...");

    if (!mergedArrayBuffer) {
      this.updateProgress("error", 100, "No merged data received.");
      throw new Error("No merged data received from edge function.");
    }

    const mergedBlob = new Blob([mergedArrayBuffer], { type: "audio/wav" });
    const mergedName = `merged_${batchId}.wav`;
    const mergedFile = new File([mergedBlob], mergedName, { type: "audio/wav", lastModified: Date.now() });

    this.updateProgress("complete", 100, "Merge complete.");
    return mergedFile;
  }

  // ---------------------------
  // Helpers
  // ---------------------------

  private extOf(name: string): string {
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  }

  private safeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
  }
}

// Default class export
export default ServerAudioMergingService;

// Named instance + types used by Upload.tsx
export const serverAudioMergingService = new ServerAudioMergingService(defaultSupabase);
