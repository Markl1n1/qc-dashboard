import { supabase } from "@/integrations/supabase/client";

export interface ServerMergingProgress {
  stage: 'uploading' | 'merging' | 'complete' | 'error';
  progress: number;
  message: string;
  currentFile?: string;
}

class ServerAudioMergingService {
  private progressCallback?: (progress: ServerMergingProgress) => void;

  setProgressCallback(callback: (progress: ServerMergingProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: ServerMergingProgress['stage'], progress: number, message: string, currentFile?: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message, currentFile });
    }
    console.log(`[ServerAudioMerging] ${stage}: ${progress}% - ${message}${currentFile ? ` (${currentFile})` : ''}`);
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async mergeAudioFiles(files: File[]): Promise<File> {
    if (files.length < 2) {
      throw new Error('At least 2 files required for merging');
    }

    this.updateProgress('uploading', 10, 'Preparing files for server-side merging...');

    try {
      // Convert files to base64 for transmission
      const fileData = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        this.updateProgress('uploading', 10 + (i / files.length) * 40, 'Converting file...', file.name);
        
        const base64Data = await this.fileToBase64(file);
        fileData.push({
          data: base64Data,
          name: file.name,
          type: file.type
        });
      }

      this.updateProgress('merging', 60, 'Sending files to server for merging...');

      // Call the server-side merge function
      const { data, error } = await supabase.functions.invoke('audio-merge', {
        body: {
          files: fileData,
          outputFormat: 'mp3'
        }
      });

      if (error) {
        throw new Error(`Server merge failed: ${error.message}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Unknown server error');
      }

      this.updateProgress('merging', 90, 'Processing merged file...');

      // Convert the returned base64 data back to a File
      const response = await fetch(data.mergedFile.data);
      const blob = await response.blob();
      
      const mergedFile = new File([blob], data.mergedFile.name, {
        type: data.mergedFile.type,
        lastModified: Date.now()
      });

      this.updateProgress('complete', 100, 'Audio files merged successfully');
      
      console.log(`[ServerAudioMerging] Successfully merged ${files.length} files into ${mergedFile.name}`);
      console.log(`[ServerAudioMerging] Merged file size: ${mergedFile.size} bytes`);
      
      return mergedFile;
    } catch (error) {
      console.error('[ServerAudioMerging] Merge failed:', error);
      this.updateProgress('error', 0, 'Audio merge failed');
      throw new Error(`Failed to merge audio files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  isMergingSupported(): boolean {
    return true; // Server-side merging is always supported
  }

  getMergingInfo(): { supported: boolean; reason?: string } {
    return { supported: true };
  }
}

export const serverAudioMergingService = new ServerAudioMergingService();