import { supabase } from "@/integrations/supabase/client";

export interface ServerMergingProgress {
  stage: "uploading" | "merging" | "complete" | "error";
  progress: number;
  message: string;
  currentFile?: string;
}

class ServerAudioMergingService {
  private progressCallback?: (progress: ServerMergingProgress) => void;

  setProgressCallback(callback: (progress: ServerMergingProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(
    stage: ServerMergingProgress["stage"],
    progress: number,
    message: string,
    currentFile?: string
  ) {
    this.progressCallback?.({ stage, progress, message, currentFile });
    console.log(
      `[ServerAudioMerging] ${stage}: ${progress}% - ${message}${currentFile ? ` (${currentFile})` : ""}`
    );
  }

  private getExtension(name: string): string {
    const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  private getContentTypeByExt(ext: string): string {
    switch (ext) {
      case "mp3": return "audio/mpeg";
      case "wav": return "audio/wav";
      case "ogg": return "audio/ogg";
      case "m4a": return "audio/mp4";
      case "flac": return "audio/flac";
      default: return `audio/${ext}`;
    }
  }

  async mergeAudioFiles(files: File[]): Promise<File> {
    if (files.length < 2) {
      throw new Error("At least 2 files required for merging");
    }

    const exts = files.map((f) => this.getExtension(f.name));
    const firstExt = exts[0];
    const allSame = exts.every((e) => e === firstExt);
    if (!firstExt || !allSame) {
      throw new Error("Wrong audio format: all files must have the same extension");
    }

    const allowed = new Set(["mp3", "wav", "flac", "ogg", "m4a"]);
    if (!allowed.has(firstExt)) {
      throw new Error(`Unsupported format '${firstExt}'. Allowed: ${Array.from(allowed).join(", ")}`);
    }

    const outputFormat = firstExt as "mp3" | "wav" | "flac" | "ogg" | "m4a";

    this.updateProgress("uploading", 5, "Preparing files for server-side merging...");

    const mergeId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const bucket = "audio-files";
    const basePath = `temp-merge/${mergeId}`;

    const uploadedPaths: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = 5 + Math.floor((i / files.length) * 45);
        this.updateProgress("uploading", progress, "Uploading to storage...", file.name);

        const path = `${basePath}/${file.name}`;
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(path, file, {
            contentType: file.type || this.getContentTypeByExt(firstExt),
            upsert: false,
          });

        if (error || !data) {
          throw new Error(`Upload failed for ${file.name}: ${error?.message ?? "Unknown error"}`);
        }
        uploadedPaths.push(path);
      }

      this.updateProgress("merging", 60, "Requesting server-side merge...");

      const invokeBody = {
        paths: uploadedPaths,
        outputFormat,
        deleteSources: true,
        namePrefix: `merged_${mergeId}`,
      };
      console.log("[ServerAudioMerging] Invoking audio-merge with body:", invokeBody);

      const { data, error } = await supabase.functions.invoke("audio-merge", { body: invokeBody });

      if (error) throw new Error(`Server merge failed: ${error.message}`);
      if (!data?.success) throw new Error(data?.error || "Unknown server error");

      this.updateProgress("merging", 85, "Downloading merged file...");

      const mergedUrl: string | null = data.mergedFile?.url ?? null;
      const contentType: string = data.mergedFile?.contentType || this.getContentTypeByExt(firstExt);

      if (!mergedUrl) {
        throw new Error("Merged file URL missing");
      }

      const res = await fetch(mergedUrl);
      if (!res.ok) throw new Error(`Failed to download merged file: HTTP ${res.status}`);

      const blob = await res.blob();
      this.updateProgress("merging", 95, "Finalizing merged file...");

      const mergedName = data.mergedFile?.path?.split("/").pop() || `merged_${mergeId}.${firstExt}`;
      const mergedFile = new File([blob], mergedName, {
        type: contentType,
        lastModified: Date.now(),
      });

      this.updateProgress("complete", 100, "Audio files merged successfully");
      console.log(
        `[ServerAudioMerging] Successfully merged ${files.length} files into ${mergedName} (${mergedFile.size} bytes)`
      );

      return mergedFile;
    } catch (err) {
      console.error("[ServerAudioMerging] Merge failed:", err);
      if (uploadedPaths.length > 0) {
        try { await supabase.storage.from(bucket).remove(uploadedPaths); }
        catch (cleanupErr) { console.warn("[ServerAudioMerging] Cleanup failed:", cleanupErr); }
      }
      this.updateProgress("error", 0, err instanceof Error ? err.message : "Audio merge failed");
      throw new Error(`Failed to merge audio files: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  isMergingSupported(): boolean { return true; }
  getMergingInfo(): { supported: boolean; reason?: string } { return { supported: true }; }
}

export const serverAudioMergingService = new ServerAudioMergingService();
