
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface MergingProgress {
  stage: 'initializing' | 'loading_ffmpeg' | 'preparing' | 'merging' | 'complete' | 'error';
  progress: number;
  message: string;
  currentFile?: string;
}

class AudioMergingService {
  private ffmpeg: FFmpeg | null = null;
  private progressCallback?: (progress: MergingProgress) => void;
  private isLoaded = false;

  setProgressCallback(callback: (progress: MergingProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: MergingProgress['stage'], progress: number, message: string, currentFile?: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message, currentFile });
    }
    console.log(`[AudioMerging] ${stage}: ${progress}% - ${message}${currentFile ? ` (${currentFile})` : ''}`);
  }

  private async loadFFmpeg(): Promise<void> {
    if (this.isLoaded && this.ffmpeg) {
      return;
    }

    this.updateProgress('loading_ffmpeg', 10, 'Loading FFmpeg for audio merging...');
    
    try {
      this.ffmpeg = new FFmpeg();
      
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
      
      try {
        await this.ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
        });
      } catch (error) {
        console.log('[AudioMerging] jsDelivr failed, trying alternative CDN...');
        const fallbackURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await this.ffmpeg.load({
          coreURL: await toBlobURL(`${fallbackURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${fallbackURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      }

      this.updateProgress('loading_ffmpeg', 30, 'FFmpeg loaded successfully');
      this.isLoaded = true;
    } catch (error) {
      console.error('[AudioMerging] FFmpeg loading failed:', error);
      this.updateProgress('error', 0, 'Failed to load FFmpeg');
      throw new Error('Failed to load FFmpeg. Audio merging is not available.');
    }
  }

  private validateFilesCompatibility(files: File[]): { compatible: boolean; reason?: string } {
    if (files.length < 2) {
      return { compatible: false, reason: 'At least 2 files required for merging' };
    }

    // Check if all files have audio extensions
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
    const hasValidExtensions = files.every(file => {
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      return audioExtensions.includes(extension);
    });

    if (!hasValidExtensions) {
      return { compatible: false, reason: 'All files must be audio files' };
    }

    return { compatible: true };
  }

  async mergeAudioFiles(files: File[]): Promise<File> {
    this.updateProgress('initializing', 0, 'Initializing audio merge process...');
    
    const validation = this.validateFilesCompatibility(files);
    if (!validation.compatible) {
      throw new Error(validation.reason);
    }

    try {
      await this.loadFFmpeg();
      
      if (!this.ffmpeg) {
        throw new Error('FFmpeg not loaded');
      }

      this.updateProgress('preparing', 40, 'Preparing audio files for merging...');
      
      // Write all input files
      const inputFiles: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const extension = file.name.substring(file.name.lastIndexOf('.'));
        const inputFileName = `input_${i}${extension}`;
        
        this.updateProgress('preparing', 40 + (i / files.length) * 20, 'Loading file...', file.name);
        
        await this.ffmpeg.writeFile(inputFileName, await fetchFile(file));
        inputFiles.push(inputFileName);
      }

      this.updateProgress('merging', 70, 'Merging audio files...');

      // Create concat file list for FFmpeg
      const concatContent = inputFiles.map(filename => `file '${filename}'`).join('\n');
      await this.ffmpeg.writeFile('concat_list.txt', new TextEncoder().encode(concatContent));

      const outputFileName = 'merged_output.mp3';

      // Build FFmpeg command for concatenation
      const command = [
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat_list.txt',
        '-c', 'copy',
        '-y',
        outputFileName
      ];

      console.log('[AudioMerging] FFmpeg merge command:', command.join(' '));

      // Execute merge
      await this.ffmpeg.exec(command);

      this.updateProgress('merging', 90, 'Finalizing merged audio...');

      // Read the merged file
      const data = await this.ffmpeg.readFile(outputFileName);
      
      // Create new file with merged data
      const mergedBlob = new Blob([data], { type: 'audio/mpeg' });
      const mergedFileName = `merged_audio_${Date.now()}.mp3`;
      
      const mergedFile = new File([mergedBlob], mergedFileName, {
        type: 'audio/mpeg',
        lastModified: Date.now()
      });

      // Cleanup
      for (const inputFile of inputFiles) {
        await this.ffmpeg.deleteFile(inputFile);
      }
      await this.ffmpeg.deleteFile('concat_list.txt');
      await this.ffmpeg.deleteFile(outputFileName);

      this.updateProgress('complete', 100, 'Audio files merged successfully');
      
      console.log(`[AudioMerging] Successfully merged ${files.length} files into ${mergedFile.name}`);
      console.log(`[AudioMerging] Merged file size: ${mergedFile.size} bytes`);
      
      return mergedFile;
    } catch (error) {
      console.error('[AudioMerging] Merge failed:', error);
      this.updateProgress('error', 0, 'Audio merge failed');
      throw new Error(`Failed to merge audio files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  isMergingSupported(): boolean {
    return (typeof SharedArrayBuffer !== 'undefined' && crossOriginIsolated);
  }

  getMergingInfo(): { supported: boolean; reason?: string } {
    if (typeof SharedArrayBuffer === 'undefined') {
      return {
        supported: false,
        reason: 'Audio merging requires FFmpeg. SharedArrayBuffer is not supported in this environment.'
      };
    }

    if (!crossOriginIsolated) {
      return {
        supported: false,
        reason: 'Audio merging requires FFmpeg. Cross-origin isolation is required for FFmpeg to work.'
      };
    }

    return { supported: true };
  }
}

export const audioMergingService = new AudioMergingService();
