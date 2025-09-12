import { supabase } from "@/integrations/supabase/client";
import { createSafeFilenameWithMetadata } from "@/utils/filenameSanitizer";

export interface ServerMergingProgress {
  stage: "uploading" | "merging" | "complete" | "error";
  progress: number;
  message: string;
  currentFile?: string;
}

/** Robustly extracts a string filename from createSafeFilenameWithMetadata result */
function resolveSafeFilename(baseName: string, extraMeta: Record<string, any>): string {
  try {
    const res: any = createSafeFilenameWithMetadata(baseName, JSON.stringify(extraMeta));
    if (typeof res === "string") return sanitize(res);
    if (res && typeof res === "object") {
      const candidate =
        res.sanitized ??
        res.filename ??
        res.fileName ??
        res.name ??
        res.safeName ??
        res.safeFilename ??
        null;
      if (typeof candidate === "string") return sanitize(candidate);
    }
    // fallback to sanitized baseName
    return sanitize(baseName);
  } catch {
    return sanitize(baseName);
  }

  function sanitize(name: string): string {
    // убираем слеши/управляющие и приводим к безопасному виду
    return name
      .replace(/[/\\]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/[^\w.\-()]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }
}

// Lightweight retry helper with exponential backoff + jitter
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 300): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const jitter = Math.random() * 100;
      const delay = baseMs * Math.pow(2, i) + jitter;
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
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
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
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
    console.log('🔀 ServerAudioMergingService: Starting merge process', {
      fileCount: files.length,
      files: files.map(f => ({ 
        name: f.name, 
        size: f.size, 
        type: f.type,
        lastModified: f.lastModified 
      }))
    });

    if (files.length < 2) {
      // Nothing to merge — return the original file
      return files[0];
    }

    const exts = files.map((f) => this.getExtension(f.name));
    const uniqueExts = Array.from(new Set(exts.filter(Boolean)));

    console.log('🔍 File validation:', {
      extensions: exts,
      uniqueExtensions: uniqueExts,
      fileNames: files.map(f => f.name)
    });

    const allowed = new Set(["mp3", "wav", "flac", "ogg", "m4a"]);
    // Ensure every provided extension is allowed
    for (const ext of uniqueExts) {
      if (!allowed.has(ext)) {
        console.error('❌ Unsupported format detected:', ext, 'Allowed:', Array.from(allowed));
        throw new Error(`Unsupported format '${ext}'. Allowed: ${Array.from(allowed).join(", ")}`);
      }
    }

    // If all files share the same extension, preserve it. If mixed, normalize to WAV on server.
    let outputFormat: "mp3" | "wav" | "flac" | "ogg" | "m4a";
    if (uniqueExts.length === 1) {
      outputFormat = uniqueExts[0] as any;
    } else {
      console.log('🔀 Mixed input formats detected, selecting WAV as canonical output for merge', { uniqueExts });
      outputFormat = 'wav';
    }

    this.updateProgress("uploading", 5, "Preparing files for server-side merging...");

    const mergeId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const bucket = "audio-files";
    const basePath = `temp-merge/${mergeId}`;

    console.log('📋 Merge session info:', { mergeId, bucket, basePath, outputFormat });

    const uploadedPaths: string[] = [];

    try {
      // Upload each file to Storage
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = 5 + Math.floor((i / files.length) * 45);
        this.updateProgress("uploading", progress, "Uploading to storage...", file.name);

        // Produce a SAFE filename string no matter what the sanitizer returns
        const safeFilename = resolveSafeFilename(file.name, {
          mergeId,
          index: i,
          total: files.length
        });

        const path = `${basePath}/${safeFilename}`;

        // (optional) metadata only for logs
        const uploadMeta = {
          original: file.name,
          sanitized: safeFilename,
          path,
          fileSize: file.size,
          fileType: file.type,
          index: i,
          total: files.length,
          mergeId
        };
        
        const fileExt = this.getExtension(file.name);
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(path, file, {
            contentType: file.type || this.getContentTypeByExt(fileExt),
            upsert: false,
          });

        if (error || !data) {
          console.error('❌ Upload failed:', {
            fileName: file.name,
            path,
            error: error?.message,
            details: error,
            meta: uploadMeta
          });
          throw new Error(`Upload failed for ${file.name}: ${error?.message ?? "Unknown error"}`);
        }

        console.log('✅ Upload successful:', { path, data, ...uploadMeta });
        uploadedPaths.push(path);
      }

      this.updateProgress("merging", 60, "Requesting server-side merge...");

      const invokeBody = {
        paths: uploadedPaths,
        outputFormat,
        deleteSources: true,
        namePrefix: `merged_${mergeId}`,
      };
      
      console.log("🔄 Invoking audio-merge edge function:", {
        body: invokeBody,
        pathsCount: uploadedPaths.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0)
      });

      // Call the server-side ffmpeg endpoint (Vercel function) instead of Supabase edge function
      const invokeRes = await withRetry(async () => {
        const resp = await fetch('/api/audio-merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invokeBody),
        });
        const json = await resp.json();
        if (!resp.ok) {
          const err = new Error(json?.error || `HTTP ${resp.status}`);
          (err as any).details = json;
          throw err;
        }
        return json;
      });
      const data = invokeRes;
      const error = null;

      console.log("📋 Edge function response:", { 
        data: data ? { 
          success: data.success, 
          error: data.error,
          mergedFile: data.mergedFile ? {
            path: data.mergedFile.path,
            url: data.mergedFile.url ? '[URL_PRESENT]' : '[URL_MISSING]',
            contentType: data.mergedFile.contentType,
            size: data.mergedFile.size
          } : '[MISSING]'
        } : '[NO_DATA]',
        error: error ? {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        } : '[NO_ERROR]'
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw new Error(`Server merge failed: ${error.message}`);
      }
      
      if (!data?.success) {
        console.error('❌ Edge function returned failure:', data);
        throw new Error(data?.error || "Unknown server error");
      }

      this.updateProgress("merging", 85, "Downloading merged file...");

      const mergedUrl: string | null = data.mergedFile?.url ?? null;
      const contentType = data.mergedFile?.contentType || this.getContentTypeByExt(outputFormat);

      if (!mergedUrl) {
        throw new Error("Merged file URL is missing in edge response");
      }

      const res = await fetch(mergedUrl);
      if (!res.ok) {
        throw new Error(`Failed to download merged file: ${res.status} ${res.statusText}`);
      }

      const blob = await res.blob();

      this.updateProgress("merging", 95, "Finalizing merged file...");

  const mergedName = data.mergedFile?.path?.split("/").pop() || `merged_${mergeId}.${outputFormat}`;
      const mergedFile = new File([blob], mergedName, {
        type: contentType,
        lastModified: Date.now(),
      });

      console.log('✅ Final merged file created:', {
        name: mergedFile.name,
        size: mergedFile.size,
        type: mergedFile.type,
        lastModified: mergedFile.lastModified
      });

      this.updateProgress("complete", 100, "Server-side merge complete");

      return mergedFile;

    } catch (err) {
      console.error('💥 Merge failed:', err, {
        mergeId,
        basePath,
        uploadedPaths,
        stack: err instanceof Error ? err.stack : undefined,
      });

      // Best-effort cleanup (uploaded sources)
      if (uploadedPaths.length > 0) {
        console.log('🧹 Cleaning up uploaded files:', uploadedPaths);
        try { 
          const { error: cleanupError } = await supabase.storage.from(bucket).remove(uploadedPaths);
          if (cleanupError) {
            console.error('❌ Cleanup failed:', cleanupError);
          } else {
            console.log('✅ Cleanup successful');
          }
        }
        catch (cleanupErr) { 
          console.error('❌ Cleanup exception:', cleanupErr);
        }
      }
      
      this.updateProgress("error", 0, err instanceof Error ? err.message : "Audio merge failed");
      throw new Error(`Failed to merge audio files: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  isMergingSupported(): boolean { return true; }
  getMergingInfo(): { supported: boolean; reason?: string } { return { supported: true }; }
}

export const serverAudioMergingService = new ServerAudioMergingService();
