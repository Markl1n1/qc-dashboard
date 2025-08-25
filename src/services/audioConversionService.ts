import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { AudioMetadata, parseWAVHeader } from '../utils/audioMetadataUtils';
// Removed webAudioConversionService - now using FFmpeg only for real MP3 conversion

export interface ConversionOptions {
  targetSampleRate: number;
  targetBitDepth: number;
  targetChannels: number;
}

export interface ConversionProgress {
  stage: 'initializing' | 'loading_ffmpeg' | 'converting' | 'complete' | 'error';
  progress: number;
  message: string;
}

class AudioConversionService {
  private ffmpeg: FFmpeg | null = null;
  private progressCallback?: (progress: ConversionProgress) => void;
  private isLoaded = false;

  setProgressCallback(callback: (progress: ConversionProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: ConversionProgress['stage'], progress: number, message: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message });
    }
    console.log(`[AudioConversion] ${stage}: ${progress}% - ${message}`);
  }

  private async loadFFmpeg(): Promise<void> {
    if (this.isLoaded && this.ffmpeg) {
      return;
    }

    this.updateProgress('loading_ffmpeg', 10, 'Loading FFmpeg...');
    
    try {
      this.ffmpeg = new FFmpeg();
      
      // Use jsDelivr CDN which has better CORS support
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
      
      try {
        await this.ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
        });
      } catch (error) {
        console.log('[AudioConversion] jsDelivr failed, trying alternative CDN...');
        // Fallback to alternative CDN
        const fallbackURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await this.ffmpeg.load({
          coreURL: await toBlobURL(`${fallbackURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${fallbackURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      }

      this.updateProgress('loading_ffmpeg', 20, 'FFmpeg loaded successfully');
      this.isLoaded = true;
    } catch (error) {
      console.error('[AudioConversion] FFmpeg loading failed:', error);
      this.updateProgress('error', 0, 'Failed to load FFmpeg');
      throw new Error('Failed to load FFmpeg. Audio conversion is not available.');
    }
  }

  /**
   * Check if a WAV file needs conversion based on sample rate and compatibility
   */
  async shouldConvertWav(file: File): Promise<{ shouldConvert: boolean; reason?: string; currentSampleRate?: number }> {
    if (!file.name.toLowerCase().endsWith('.wav')) {
      return { shouldConvert: false };
    }

    try {
      // Read first 1KB for header analysis
      const headerBuffer = await file.slice(0, 1024).arrayBuffer();
      const metadata = parseWAVHeader(headerBuffer);
      
      if (!metadata) {
        return { 
          shouldConvert: true, 
          reason: 'Unable to read WAV metadata - converting to MP3 for AssemblyAI compatibility' 
        };
      }

      const currentSampleRate = metadata.sampleRate;
      
      // Always convert WAV files to MP3 for AssemblyAI compatibility
      return { 
        shouldConvert: true, 
        reason: `Converting WAV to MP3 format for AssemblyAI (${currentSampleRate} Hz → optimized MP3)`,
        currentSampleRate 
      };
    } catch (error) {
      console.error('[AudioConversion] Error analyzing WAV file:', error);
      return { 
        shouldConvert: true, 
        reason: 'Error analyzing file - converting to MP3 for AssemblyAI compatibility' 
      };
    }
  }

  async convertAudioFile(file: File, options: ConversionOptions): Promise<File> {
    // Always use FFmpeg for real MP3 conversion
    this.updateProgress('initializing', 0, 'Preparing audio conversion...');
    
    try {
      await this.loadFFmpeg();
      
      if (!this.ffmpeg) {
        throw new Error('FFmpeg not loaded');
      }

      this.updateProgress('converting', 30, 'Reading audio file...');
      
      // Write input file
      const inputFileName = 'input.' + file.name.split('.').pop();
      const outputFileName = 'output.mp3';
      
      await this.ffmpeg.writeFile(inputFileName, await fetchFile(file));

      this.updateProgress('converting', 50, 'Converting audio format...');

      // Build FFmpeg command for conversion
      const command = [
        '-i', inputFileName,
        '-acodec', 'libmp3lame',
        '-ar', options.targetSampleRate.toString(),
        '-ac', options.targetChannels.toString(),
        '-b:a', '128k', // 128kbps bitrate
        '-y', // Overwrite output
        outputFileName
      ];

      console.log('[AudioConversion] FFmpeg command:', command.join(' '));

      // Execute conversion
      await this.ffmpeg.exec(command);

      this.updateProgress('converting', 80, 'Finalizing conversion...');

      // Read the converted file
      const data = await this.ffmpeg.readFile(outputFileName);
      
      // Create new file with converted data
      const convertedBlob = new Blob([data], { type: 'audio/mpeg' });
      const convertedFileName = file.name.replace(/\.[^/.]+$/, '.mp3');
      
      const convertedFile = new File([convertedBlob], convertedFileName, {
        type: 'audio/mpeg',
        lastModified: Date.now()
      });

      // Cleanup
      await this.ffmpeg.deleteFile(inputFileName);
      await this.ffmpeg.deleteFile(outputFileName);

      this.updateProgress('complete', 100, 'Conversion complete');
      
      console.log(`[AudioConversion] Successfully converted ${file.name} to ${convertedFile.name}`);
      console.log(`[AudioConversion] Original size: ${file.size} bytes, Converted size: ${convertedFile.size} bytes`);
      
      return convertedFile;
    } catch (error) {
      console.error('[AudioConversion] Conversion failed:', error);
      this.updateProgress('error', 0, 'Conversion failed');
      throw new Error(`Failed to convert ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async convertWavToOptimalMp3(file: File, currentSampleRate?: number): Promise<File> {
    const displayRate = currentSampleRate || 'unknown';
    console.log(`[AudioConversion] Converting to real MP3 format using FFmpeg: ${file.name} (${displayRate} Hz)`);
    
    // Always use FFmpeg for real MP3 conversion
    const options: ConversionOptions = {
      targetSampleRate: 16000,
      targetBitDepth: 16,
      targetChannels: 1
    };

    return await this.convertAudioFile(file, options);
  }

  async convertWavToMp3(file: File): Promise<File> {
    console.log(`[AudioConversion] Converting WAV to MP3: ${file.name}`);
    
    // Use the main conversion method with standard options
    const options: ConversionOptions = {
      targetSampleRate: 16000, // Good for speech recognition
      targetBitDepth: 16,
      targetChannels: 1 // Mono for speech
    };

    return await this.convertAudioFile(file, options);
  }

  createDialog(transcription: string, fileName: string): any {
    return {
      id: Date.now().toString(),
      fileName,
      transcription,
      status: 'completed',
      uploadDate: new Date().toISOString()
    };
  }

  // Check if FFmpeg conversion is supported
  isConversionSupported(): boolean {
    return (typeof SharedArrayBuffer !== 'undefined' && crossOriginIsolated);
  }

  // Get FFmpeg conversion capability info
  getConversionInfo(): { supported: boolean; reason?: string } {
    if (typeof SharedArrayBuffer === 'undefined') {
      return {
        supported: false,
        reason: 'Audio conversion requires FFmpeg. SharedArrayBuffer is not supported in this environment.'
      };
    }

    if (!crossOriginIsolated) {
      return {
        supported: false,
        reason: 'Audio conversion requires FFmpeg. Cross-origin isolation is required for FFmpeg to work.'
      };
    }

    return { supported: true };
  }
}

export const audioConversionService = new AudioConversionService();
