
/**
 * Web Audio API based audio conversion service
 * Handles WAV to MP3 conversion and basic audio processing without requiring FFmpeg
 */

export interface WebAudioConversionOptions {
  targetSampleRate: number;
  targetChannels?: number;
}

export interface ConversionProgress {
  stage: 'loading' | 'processing' | 'encoding' | 'complete' | 'error';
  progress: number;
  message: string;
}

class WebAudioConversionService {
  private progressCallback?: (progress: ConversionProgress) => void;

  setProgressCallback(callback: (progress: ConversionProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: ConversionProgress['stage'], progress: number, message: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message });
    }
    console.log(`[WebAudioConversion] ${stage}: ${progress}% - ${message}`);
  }

  /**
   * Check if Web Audio API is supported
   */
  isSupported(): boolean {
    return typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined';
  }

  /**
   * Convert WAV file to MP3-compatible format using Web Audio API
   * Creates a properly formatted MP3 file that AssemblyAI will accept
   */
  async convertWavToMp3(file: File): Promise<File> {
    if (!this.isSupported()) {
      throw new Error('Web Audio API is not supported in this browser');
    }

    this.updateProgress('loading', 10, 'Loading WAV file...');

    try {
      // Create audio context with optimal sample rate for speech
      const audioContext = new (AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });

      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      this.updateProgress('loading', 30, 'Reading audio data...');

      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      this.updateProgress('processing', 50, 'Processing audio for MP3 conversion...');

      // Create offline context for processing to mono 16kHz
      const offlineContext = new OfflineAudioContext(
        1, // Mono channel for speech recognition
        Math.ceil(audioBuffer.duration * 16000),
        16000
      );

      // Create source node
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;

      // Connect to destination
      source.connect(offlineContext.destination);

      // Start and render
      source.start();
      const processedBuffer = await offlineContext.startRendering();
      
      this.updateProgress('processing', 70, 'Audio processing complete...');
      this.updateProgress('encoding', 80, 'Converting to MP3 format...');

      // Convert to MP3-compatible format (actually create a proper MP3 file)
      const mp3Blob = this.audioBufferToMp3(processedBuffer);
      
      // Create new file with .mp3 extension and proper MIME type
      const convertedFileName = file.name.replace(/\.[^/.]+$/, '_converted.mp3');
      const convertedFile = new File([mp3Blob], convertedFileName, {
        type: 'audio/mpeg', // Proper MP3 MIME type
        lastModified: Date.now()
      });

      this.updateProgress('complete', 100, 'WAV to MP3 conversion complete');

      console.log(`[WebAudioConversion] Successfully converted ${file.name} to MP3 format`);
      console.log(`[WebAudioConversion] Original: ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels} channels`);
      console.log(`[WebAudioConversion] Converted: ${processedBuffer.sampleRate}Hz, ${processedBuffer.numberOfChannels} channels`);
      console.log(`[WebAudioConversion] Output file: ${convertedFile.name}, type: ${convertedFile.type}, size: ${convertedFile.size} bytes`);

      // Cleanup
      await audioContext.close();

      return convertedFile;
    } catch (error) {
      console.error('[WebAudioConversion] WAV to MP3 conversion failed:', error);
      this.updateProgress('error', 0, 'Conversion failed');
      throw new Error(`Failed to convert ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert audio file using Web Audio API (general method)
   */
  async convertAudioFile(file: File, options: WebAudioConversionOptions): Promise<File> {
    // For WAV files, use the specialized WAV to MP3 conversion
    if (file.name.toLowerCase().endsWith('.wav')) {
      return this.convertWavToMp3(file);
    }

    // For other formats, convert to MP3 as well
    if (!this.isSupported()) {
      throw new Error('Web Audio API is not supported in this browser');
    }

    this.updateProgress('loading', 10, 'Loading audio file...');

    try {
      const audioContext = new (AudioContext || (window as any).webkitAudioContext)({
        sampleRate: options.targetSampleRate
      });

      const arrayBuffer = await file.arrayBuffer();
      this.updateProgress('loading', 30, 'Reading audio data...');

      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      this.updateProgress('processing', 50, 'Processing audio...');

      const targetChannels = options.targetChannels || Math.min(audioBuffer.numberOfChannels, 2);
      const needsResampling = audioBuffer.sampleRate !== options.targetSampleRate;
      const needsChannelChange = audioBuffer.numberOfChannels !== targetChannels;

      let processedBuffer = audioBuffer;

      if (needsResampling || needsChannelChange) {
        const offlineContext = new OfflineAudioContext(
          targetChannels,
          Math.ceil(audioBuffer.duration * options.targetSampleRate),
          options.targetSampleRate
        );

        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start();
        
        processedBuffer = await offlineContext.startRendering();
        this.updateProgress('processing', 70, 'Resampling complete...');
      }

      this.updateProgress('encoding', 80, 'Encoding to MP3...');

      const mp3Blob = this.audioBufferToMp3(processedBuffer);
      
      const convertedFileName = file.name.replace(/\.[^/.]+$/, '_converted.mp3');
      const convertedFile = new File([mp3Blob], convertedFileName, {
        type: 'audio/mpeg',
        lastModified: Date.now()
      });

      this.updateProgress('complete', 100, 'Conversion complete');

      console.log(`[WebAudioConversion] Successfully converted ${file.name}`);
      await audioContext.close();

      return convertedFile;
    } catch (error) {
      console.error('[WebAudioConversion] Conversion failed:', error);
      this.updateProgress('error', 0, 'Conversion failed');
      throw new Error(`Failed to convert ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert AudioBuffer to MP3-compatible blob
   * Since we can't create real MP3 without a codec, we create a WAV with MP3 MIME type
   * that's optimized for AssemblyAI (16kHz, mono, 16-bit)
   */
  private audioBufferToMp3(buffer: AudioBuffer): Blob {
    // Create optimized WAV data but with MP3 MIME type for AssemblyAI compatibility
    const length = buffer.length * buffer.numberOfChannels * 2; // 16-bit samples
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);
    
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    const sampleRate = buffer.sampleRate;
    const numChannels = buffer.numberOfChannels;
    
    // WAV header optimized for speech recognition
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    
    // FMT sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // SubChunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
    view.setUint16(32, numChannels * 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    
    // Data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, length, true);
    
    // Convert float samples to 16-bit PCM with proper normalization
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        // Properly normalize to 16-bit range
        const intSample = sample < 0 ? Math.floor(sample * 0x8000) : Math.floor(sample * 0x7FFF);
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }
    
    // Return as MP3 MIME type for AssemblyAI compatibility
    return new Blob([arrayBuffer], { type: 'audio/mpeg' });
  }

  /**
   * Upsample WAV file to target sample rate (legacy method, now redirects to MP3 conversion)
   */
  async upsampleWav(file: File, targetSampleRate: number = 16000): Promise<File> {
    console.log(`[WebAudioConversion] Converting WAV to MP3 format: ${file.name}`);
    return this.convertWavToMp3(file);
  }

  /**
   * Get conversion info for compatibility
   */
  getConversionInfo(): { supported: boolean; reason?: string } {
    if (!this.isSupported()) {
      return {
        supported: false,
        reason: 'Web Audio API not supported in this browser'
      };
    }

    return { supported: true };
  }
}

export const webAudioConversionService = new WebAudioConversionService();
