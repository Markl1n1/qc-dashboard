import { supabase } from "@/integrations/supabase/client";
import { createSafeFilenameWithMetadata } from "@/utils/filenameSanitizer";

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
      throw new Error("At least 2 files required for merging");
    }

    const exts = files.map((f) => this.getExtension(f.name));
    const firstExt = exts[0];
    const allSame = exts.every((e) => e === firstExt);
    
    console.log('🔍 File validation:', { 
      extensions: exts, 
      firstExt, 
      allSame,
      fileNames: files.map(f => f.name)
    });

    if (!firstExt || !allSame) {
      console.error('❌ File extension validation failed:', { exts, firstExt, allSame });
      throw new Error("Wrong audio format: all files must have the same extension");
    }

    const allowed = new Set(["mp3", "wav", "flac", "ogg", "m4a"]);
    if (!allowed.has(firstExt)) {
      console.error('❌ Unsupported format:', firstExt, 'Allowed:', Array.from(allowed));
      throw new Error(`Unsupported format '${firstExt}'. Allowed: ${Array.from(allowed).join(", ")}`);
    }

    const outputFormat = firstExt as "mp3" | "wav" | "flac" | "ogg" | "m4a";

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

        // Create safe filename for storage
        const { filename: safeFilename, metadata } = createSafeFilenameWithMetadata(file.name);
        const path = `${basePath}/${safeFilename}`;
        
        console.log(`📤 Uploading file ${i + 1}/${files.length}:`, {
          original: file.name,
          sanitized: safeFilename,
          path,
          metadata,
          fileSize: file.size,
          fileType: file.type
        });
        
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(path, file, {
            contentType: file.type || this.getContentTypeByExt(firstExt),
            upsert: false,
          });

        if (error || !data) {
          console.error('❌ Upload failed:', {
            fileName: file.name,
            path,
            error: error?.message,
            data
          });
          throw new Error(`Upload failed for ${file.name}: ${error?.message ?? "Unknown error"}`);
        }

        console.log('✅ Upload successful:', { path, data });
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

      const { data, error } = await supabase.functions.invoke("audio-merge", {
        body: JSON.stringify(invokeBody),
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
      });

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
        } : null
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
      const contentType: string = data.mergedFile?.contentType || this.getContentTypeByExt(firstExt);
      
      console.log('📥 Downloading merged file:', { 
        url: mergedUrl ? '[URL_PRESENT]' : '[URL_MISSING]',
        contentType,
        mergedFileInfo: data.mergedFile
      });

      if (!mergedUrl) {
        console.error('❌ Merged file URL missing:', data.mergedFile);
        throw new Error("Merged file URL missing");
      }

      const res = await fetch(mergedUrl);
      console.log('🌐 Fetch response:', { 
        ok: res.ok, 
        status: res.status, 
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries())
      });

      if (!res.ok) {
        console.error('❌ Download failed:', { status: res.status, statusText: res.statusText });
        throw new Error(`Failed to download merged file: HTTP ${res.status}`);
      }
      
      const blob = await res.blob();
      console.log('📦 Downloaded blob:', { size: blob.size, type: blob.type });

      this.updateProgress("merging", 95, "Finalizing merged file...");

      const mergedName = data.mergedFile?.path?.split("/").pop() || `merged_${mergeId}.${firstExt}`;
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

      this.updateProgress("complete", 100, "Audio files merged successfully");
      console.log(
        `🎉 ServerAudioMerging: Successfully merged ${files.length} files into ${mergedName} (${mergedFile.size} bytes)`
      );

      return mergedFile;
      
    } catch (err) {
      console.error("❌ ServerAudioMerging: Merge operation failed:", {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        uploadedPaths,
        mergeId
      });
      
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
