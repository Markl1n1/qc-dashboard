// src/services/serverAudioMergingService.ts

/* eslint-disable no-console */

import { mergeAudioFilesTo8kWav } from "@/lib/merge-audio-to-wav";
import type { SupabaseClient } from "@supabase/supabase-js";

// Optional: create a default Supabase client for the WAV server path
let defaultSupabase: SupabaseClient | undefined;
try {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
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

export type ServerMergingProgress = ProgressEvent;
export type ProgressUpdater = (evt: ProgressEvent) => void;

export type ServerAudioMergingServiceOptions = {
  onProgress?: ProgressUpdater;
  edgeMergeUrl?: string; // e.g. `${SUPABASE_URL}/functions/v1/audio-merge`
  useSupabaseFunctionsInvoke?: boolean;
  tempBucket?: string;
  outputSampleRate?: number;
  normalizePeak?: boolean;
  forceClientMerge?: boolean;
};

export class ServerAudioMergingService {
  private supabase?: SupabaseClient;
  private opts: Required<ServerAudioMergingServiceOptions>;

  constructor(supabaseClient?: SupabaseClient, options?: ServerAudioMergingServiceOptions) {
    const envEdge = process.env.SUPABASE_URL
      ? `${process.env.SUPABASE_URL}/functions/v1/audio-merge`
      : "";

    this.supabase = supabaseClient;
    this.opts = {
      onProgress: options?.onProgress ?? (() => void 0),
      edgeMergeUrl: options?.edgeMergeUrl ?? envEdge,
      useSupabaseFunctionsInvoke: options?.useSupabaseFunctionsInvoke ?? !!supabaseClient,
      tempBucket: options?.tempBucket ?? "tmp-audio",
      outputSampleRate: options?.outputSampleRate ?? 8000,
      normalizePeak: options?.normalizePeak ?? false,
      forceClientMerge: options?.forceClientMerge ?? false,
    };
  }

  public setProgressCallback(cb?: ProgressUpdater) {
    this.opts = { ...this.opts, onProgress: cb ?? (() => void 0) };
  }

  private updateProgress(stage: Stage, progress: number, message?: string) {
    this.opts.onProgress?.({ stage, progress, message });
  }

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

    if (this.opts.forceClientMerge) {
      return await this.mergeClientSideToWav(files);
    }

    if (firstExt !== "wav") {
      return await this.mergeClientSideToWav(files);
    }

    const canInvoke = this.opts.useSupabaseFunctionsInvoke && !!this.supabase;
    const canFetchEdge = !!this.opts.edgeMergeUrl;

    if (!canInvoke && !canFetchEdge) {
      console.warn("⚠️ No Supabase client or edgeMergeUrl available; falling back to client-side WAV merge.");
      return await this.mergeClientSideToWav(files);
    }

    return await this.mergeServerSideWav(files, { canInvoke, canFetchEdge });
  }

  private async mergeClientSideToWav(files: File[]): Promise<File> {
    this.updateProgress("merging", 10, "Merging in browser (converting to 8 kHz WAV)...");

    const { blob } = await mergeAudioFilesTo8kWav(files, {
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

    this.updateProgress("complete", 100, "Merge complete.");
    return mergedFile;
  }

  private async mergeServerSideWav(
    files: File[],
    caps: { canInvoke: boolean; canFetchEdge: boolean }
  ): Promise<File> {
    const { canInvoke, canFetchEdge } = caps;

    const batchId = `merge_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const bucket = this.opts.tempBucket;

    this.updateProgress("uploading", 10, "Uploading WAV files...");

    const uploadedPaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = `${batchId}/${i.toString().padStart(3, "0")}_${this.safeName(f.name)}`;

      if (!this.supabase) {
        console.warn("⚠️ Supabase client missing during upload; falling back to client merge.");
        return await this.mergeClientSideToWav(files);
      }

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
      const pct = 10 + Math.floor(((i + 1) / files.length) * 30);
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

    if (canInvoke) {
      // @ts-ignore
      const { data, error } = await this.supabase!.functions.invoke("audio-merge", { body });
      if (error) {
        this.updateProgress("error", 100, "Server merge failed.");
        throw new Error(`Edge merge error: ${error.message}`);
      }
      if (data instanceof ArrayBuffer) {
        mergedArrayBuffer = data;
      } else if (data?.url) {
        const r = await fetch(data.url);
        mergedArrayBuffer = await r.arrayBuffer();
      } else if (data?.bytes) {
        mergedArrayBuffer = new Uint8Array(data.bytes).buffer;
      }
    } else if (canFetchEdge) {
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
    } else {
      return await this.mergeClientSideToWav(files);
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

  private extOf(name: string): string {
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  }

  private safeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
  }
}

export default ServerAudioMergingService;
export const serverAudioMergingService = new ServerAudioMergingService(defaultSupabase);
