// src/services/serverAudioMergingService.ts

/* eslint-disable no-console */

import { mergeAudioFilesTo8kWav } from "@/lib/merge-audio-to-wav";

// If you use Supabase elsewhere, keep this import.
// Remove it if you inject a different client.
import type { SupabaseClient } from "@supabase/supabase-js";

type Stage = "idle" | "validating" | "uploading" | "merging" | "downloading" | "complete" | "error";

export type ProgressEvent = {
  stage: Stage;
  progress: number; // 0..100
  message?: string;
};

export type ProgressUpdater = (evt: ProgressEvent) => void;

export type ServerAudioMergingServiceOptions = {
  /**
   * Called whenever we have a user-visible progress update.
   */
  onProgress?: ProgressUpdater;

  /**
   * Public HTTP endpoint of your edge function (no trailing slash),
   * e.g. `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/audio-merge`
   *
   * If you prefer to call via supabase.functions.invoke, leave this undefined
   * and set `useSupabaseFunctionsInvoke: true`.
   */
  edgeMergeUrl?: string;

  /**
   * Use supabase.functions.invoke("audio-merge") instead of raw fetch.
   * Default: false
   */
  useSupabaseFunctionsInvoke?: boolean;

  /**
   * Temporary storage bucket for uploads when using the server WAV path.
   * Must be publicly readable (or your edge fn must use service key to read).
   */
  tempBucket?: string; // default "tmp-audio"

  /**
   * Desired output sample rate for server WAV merges.
   * Your edge merge currently concatenates WAVs; this is kept for parity.
   */
  outputSampleRate?: number; // default 8000

  /**
   * Whether to normalize client-side merge peak to -1..1 prior to encode.
   * Keeps previous behavior default: false
   */
  normalizePeak?: boolean; // default false
};

export class ServerAudioMergingService {
  private supabase?: SupabaseClient;
  private opts: Required<ServerAudioMergingServiceOptions>;

  constructor(
    supabaseClient?: SupabaseClient,
    options?: ServerAudioMergingServiceOptions,
  ) {
    this.supabase = supabaseClient;

    this.opts = {
      onProgress: options?.onProgress ?? (() => void 0),
      edgeMergeUrl: options?.edgeMergeUrl ?? "",
      useSupabaseFunctionsInvoke: options?.useSupabaseFunctionsInvoke ?? false,
      tempBucket: options?.tempBucket ?? "tmp-audio",
      outputSampleRate: options?.outputSampleRate ?? 8000,
      normalizePeak: options?.normalizePeak ?? false,
    };
  }

  private updateProgress(stage: Stage, progress: number, message?: string) {
    this.opts.onProgress?.({ stage, progress, message });
  }

  /**
   * Main entry: merges a batch of audio Files.
   * - If the batch is WAV-only → server path (fast concat, no re-encode).
   * - Otherwise (mp3/flac/m4a/ogg/… ) → client path → returns a single WAV.
   */
  async mergeAudioFiles(files: File[]): Promise<File> {
    this.updateProgress("validating", 5, "Validating audio files...");

    if (!files || files.length === 0) {
      throw new Error("No files provided for merging.");
    }
    if (files.length === 1) {
      // Nothing to merge.
      return files[0];
    }

    const exts = files.map((f) => this.extOf(f.name));
    const firstExt = exts[0];
    const allSame = exts.every((e) => e === firstExt);

    if (!allSame) {
      // Keep your previous constraint.
      throw new Error("Wrong audio format: all files must have the same extension.");
    }

    const allowed = new Set(["mp3", "wav", "flac", "ogg", "m4a", "aac", "webm"]);
    if (!allowed.has(firstExt)) {
      throw new Error(
        `Unsupported format '${firstExt}'. Allowed: ${Array.from(allowed).join(", ")}`
      );
    }

    // ✅ NEW: If not WAV, merge client-side (decode → resample mono 8k → WAV)
    if (firstExt !== "wav") {
      return await this.mergeClientSideToWav(files);
    }

    // ✅ WAV-only: keep your server fast-path
    return await this.mergeServerSideWav(files);
  }

  // ---------------------------
  // Client-side (non-WAV) path
  // ---------------------------

  private async mergeClientSideToWav(files: File[]): Promise<File> {
    this.updateProgress("merging", 10, "Merging in browser (converting to 8 kHz WAV)...");

    const { blob, durationSec, sampleRate, channels } = await mergeAudioFilesTo8kWav(files, {
      onProgress: (stage, i, n) => {
        const stageBase: Record<string, number> = {
          decoding: 20,
          resampling: 40,
          concatenating: 60,
          encoding: 80,
        };
        const base = stageBase[stage] ?? 20;
        const pct = base + Math.floor(((i ?? 0) / Math.max(1, n ?? files.length)) * 15);
        this.updateProgress("merging", Math.min(95, pct), `Merging (${stage})...`);
      },
      normalizePeak: this.opts.normalizePeak,
      targetSampleRate: 8000,
      targetChannels: 1,
    });

    const mergedName = `merged_${Date.now()}.wav`;
    const mergedFile = new File([blob], mergedName, {
      type: "audio/wav",
      lastModified: Date.now(),
    });

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
      throw new Error(
        "Supabase client not available. Provide it to use the server-side WAV merge."
      );
    }

    // 1) Upload all WAV files to a temp folder in the bucket
    const batchId = `merge_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const bucket = this.opts.tempBucket;

    this.updateProgress("uploading", 10, "Uploading WAV files...");

    const uploadedPaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = `${batchId}/${i.toString().padStart(3, "0")}_${this.safeName(f.name)}`;

      const { error: upErr } = await this.supabase
        .storage
        .from(bucket)
        .upload(path, f, {
          cacheControl: "3600",
          contentType: "audio/wav",
          upsert: false,
        });

      if (upErr) {
        this.updateProgress("error", 100, "Upload failed.");
        throw new Error(`Failed to upload ${f.name}: ${upErr.message}`);
      }

      uploadedPaths.push(path);
      const pct = 10 + Math.floor(((i + 1) / files.length) * 30); // to 40%
      this.updateProgress("uploading", pct, `Uploaded ${i + 1}/${files.length}...`);
    }

    // 2) Invoke edge function to merge (concatenate) WAVs
    this.updateProgress("merging", 45, "Merging on server...");

    // We’ll ask the edge fn to return the merged WAV bytes directly.
    // If your function writes to storage instead, adapt below to download from that path.
    const body = {
      bucket,
      inputPaths: uploadedPaths,
      // keep your previous behavior (concat @ 8k mono)
      outputSampleRate: this.opts.outputSampleRate,
      outputChannels: 1,
      // make sure the edge fn knows it’s WAV-only
      outputFormat: "wav",
      // optional: if your fn can normalize / trim, pass flags here
    };

    let mergedArrayBuffer: ArrayBuffer | null = null;

    if (this.opts.useSupabaseFunctionsInvoke) {
      // @ts-ignore - invoke typing lives on Supabase client
      const { data, error } = await this.supabase.functions.invoke("audio-merge", {
        body,
      });

      if (error) {
        this.updateProgress("error", 100, "Server merge failed.");
        throw new Error(`Edge merge error: ${error.message}`);
      }

      // `data` might be ArrayBuffer or { ok: true, url: "..." }
      if (data instanceof ArrayBuffer) {
        mergedArrayBuffer = data;
      } else if (data?.url) {
        // If your edge fn gives a URL, fetch it now:
        const r = await fetch(data.url);
        if (!r.ok) {
          throw new Error(`Failed to download merged file from URL (status ${r.status}).`);
        }
        mergedArrayBuffer = await r.arrayBuffer();
      } else if (data?.bytes) {
        // Some setups return { bytes: number[] }
        mergedArrayBuffer = new Uint8Array(data.bytes).buffer;
      } else {
        throw new Error("Unexpected edge function response for merged data.");
      }
    } else {
      // Raw fetch to a public function URL
      if (!this.opts.edgeMergeUrl) {
        throw new Error(
          "edgeMergeUrl not configured. Set edgeMergeUrl or enable useSupabaseFunctionsInvoke."
        );
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

      // Assume the function returns binary WAV
      mergedArrayBuffer = await r.arrayBuffer();
    }

    this.updateProgress("downloading", 85, "Preparing merged file...");

    if (!mergedArrayBuffer) {
      this.updateProgress("error", 100, "No merged data received.");
      throw new Error("No merged data received from edge function.");
    }

    // 3) Build the final File from bytes
    const mergedBlob = new Blob([mergedArrayBuffer], { type: "audio/wav" });
    const mergedName = `merged_${batchId}.wav`;
    const mergedFile = new File([mergedBlob], mergedName, {
      type: "audio/wav",
      lastModified: Date.now(),
    });

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

export default ServerAudioMergingService;
