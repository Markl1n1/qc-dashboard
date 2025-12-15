
import { DeepgramOptions, DeepgramTranscriptionResult, DeepgramProgress } from '../types/deepgram';
import { SpeakerUtterance, UnifiedTranscriptionProgress } from '../types';
import { supabase } from '../integrations/supabase/client';
import { logger } from './loggingService';
import { sanitizeFilename } from '../utils/filenameSanitizer';
import { audioCleanupService } from './audioCleanupService';

// Detailed logging helper
const logTranscription = {
  start: (fileName: string, fileSize: number, options: DeepgramOptions) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎙️ [TRANSCRIPTION START]', new Date().toISOString());
    console.log('📁 [FILE]', {
      name: fileName,
      size: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
      sizeBytes: fileSize
    });
    console.log('⚙️ [OPTIONS]', {
      model: options.model || 'nova-2-general',
      language: options.language || 'auto',
      diarization: options.speaker_labels ? 'enabled' : 'disabled',
      languageDetection: options.language_detection ? 'enabled' : 'disabled'
    });
  },
  
  upload: (stage: string, details: Record<string, unknown>) => {
    console.log(`📤 [UPLOAD] ${stage}`, details);
  },
  
  apiCall: (stage: string, details: Record<string, unknown>) => {
    console.log(`🌐 [API] ${stage}`, details);
  },
  
  result: (data: {
    textLength: number;
    utteranceCount: number;
    uniqueSpeakers: number;
    audioDurationMinutes: number;
    responseTimeMs: number;
    detectedLanguage?: string;
  }) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ [TRANSCRIPTION COMPLETE]', new Date().toISOString());
    console.log('📊 [RESULTS]', {
      textLength: `${data.textLength} chars`,
      utterances: data.utteranceCount,
      speakers: data.uniqueSpeakers,
      audioDuration: `${data.audioDurationMinutes.toFixed(2)} min`,
      processingTime: `${(data.responseTimeMs / 1000).toFixed(2)}s`,
      language: data.detectedLanguage || 'N/A'
    });
    if (data.audioDurationMinutes > 0 && data.responseTimeMs > 0) {
      const realTimeRatio = (data.audioDurationMinutes * 60 * 1000) / data.responseTimeMs;
      console.log('⚡ [PERFORMANCE]', `${realTimeRatio.toFixed(1)}x realtime`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  },
  
  error: (stage: string, error: unknown, details?: Record<string, unknown>) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`❌ [TRANSCRIPTION ERROR] ${stage}`, {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.name : typeof error,
      ...details
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  },
  
  timing: (label: string, startTime: number) => {
    const elapsed = Date.now() - startTime;
    console.log(`⏱️ [TIMING] ${label}:`, `${elapsed}ms`);
    return elapsed;
  }
};

class DeepgramService {
  private progressCallback: ((progress: UnifiedTranscriptionProgress) => void) | null = null;

  setProgressCallback(callback: (progress: UnifiedTranscriptionProgress) => void): void {
    this.progressCallback = callback;
  }

  private updateProgress(stage: UnifiedTranscriptionProgress['stage'], progress: number, message: string): void {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message });
    }
  }

  async transcribe(audioFile: File, options: DeepgramOptions): Promise<{ 
    text: string; 
    speakerUtterances: SpeakerUtterance[];
    audioDurationMinutes?: number;
    stats?: TranscriptionStats;
  }> {
    const transcriptionStartTime = Date.now();
    
    logTranscription.start(audioFile.name, audioFile.size, options);
    
    logger.info('Starting Deepgram transcription', { 
      fileName: audioFile.name, 
      fileSize: audioFile.size,
      options 
    });

    try {
      const fileSizeMB = audioFile.size / (1024 * 1024);
      const isLargeFile = fileSizeMB > 8;
      
      console.log(`📦 [FILE MODE] ${isLargeFile ? 'LARGE FILE (>8MB) - Storage upload' : 'SMALL FILE - Base64 encoding'}`);

      if (isLargeFile) {
        return await this.transcribeLargeFile(audioFile, options, transcriptionStartTime);
      } else {
        return await this.transcribeSmallFile(audioFile, options, transcriptionStartTime);
      }
    } catch (error) {
      logTranscription.error('Transcription failed', error, { fileName: audioFile.name });
      logger.error('Deepgram service error', error as Error, { fileName: audioFile.name });
      this.updateProgress('error', 0, error instanceof Error ? error.message : 'Transcription failed');
      throw error;
    }
  }

  private async transcribeLargeFile(
    audioFile: File, 
    options: DeepgramOptions,
    startTime: number
  ) {
    this.updateProgress('uploading', 10, 'Uploading large file to storage...');
    
    const uploadStartTime = Date.now();
    const fileName = `audio_${Date.now()}_${sanitizeFilename(audioFile.name)}`;
    
    logTranscription.upload('Starting storage upload', { 
      fileName, 
      originalName: audioFile.name,
      size: `${(audioFile.size / 1024 / 1024).toFixed(2)} MB`
    });
    
    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, audioFile);

    if (uploadError) {
      logTranscription.error('Storage upload failed', uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }
    
    const uploadDuration = logTranscription.timing('Storage upload', uploadStartTime);
    logTranscription.upload('Upload complete', { 
      fileName, 
      uploadDuration: `${uploadDuration}ms` 
    });

    this.updateProgress('processing', 30, 'Processing large audio file...');

    const apiCallStartTime = Date.now();
    logTranscription.apiCall('Calling Deepgram Edge Function (storage mode)', {
      storageFile: fileName,
      options: {
        model: options.model || 'nova-2-general',
        language: options.language,
        diarize: options.speaker_labels
      }
    });

    const { data, error } = await supabase.functions.invoke('deepgram-transcribe', {
      body: {
        storageFile: fileName,
        mimeType: audioFile.type,
        options: {
          model: options.model || 'nova-2-general',
          language: options.language_detection ? undefined : options.language,
          detect_language: options.language_detection || false,
          diarize: options.speaker_labels || false,
          punctuate: true,
          utterances: options.speaker_labels || false,
          smart_format: options.smart_formatting !== false,
          profanity_filter: options.profanity_filter || false
        }
      }
    });

    const apiCallDuration = logTranscription.timing('Deepgram API call (large file)', apiCallStartTime);

    // Clean up storage file after transcription
    await audioCleanupService.cleanupSingleFile(fileName);

    if (error) {
      logTranscription.error('Edge function error (large file)', error, { fileName: audioFile.name });
      logger.error('Deepgram edge function error (large file)', error, { fileName: audioFile.name });
      throw new Error(`Deepgram transcription failed: ${error.message}`);
    }

    if (!data || !data.success) {
      const errorMsg = data?.error || 'Deepgram transcription failed';
      logTranscription.error('Transcription failed (large file)', new Error(errorMsg), { 
        response: data 
      });
      logger.error('Deepgram transcription failed (large file)', new Error(errorMsg), { fileName: audioFile.name });
      throw new Error(errorMsg);
    }

    return this.processTranscriptionResult(data, audioFile, startTime, apiCallDuration);
  }

  private async transcribeSmallFile(
    audioFile: File, 
    options: DeepgramOptions,
    startTime: number
  ) {
    this.updateProgress('uploading', 10, 'Processing audio with Deepgram...');

    const base64StartTime = Date.now();
    logTranscription.apiCall('Converting to Base64', { 
      fileSize: `${(audioFile.size / 1024 / 1024).toFixed(2)} MB` 
    });
    
    const base64Audio = await this.fileToBase64(audioFile);
    const base64Duration = logTranscription.timing('Base64 conversion', base64StartTime);
    
    logTranscription.apiCall('Base64 conversion complete', {
      base64Size: `${(base64Audio.length / 1024 / 1024).toFixed(2)} MB`,
      duration: `${base64Duration}ms`
    });

    this.updateProgress('processing', 30, 'Processing audio with Deepgram...');

    const apiCallStartTime = Date.now();
    logTranscription.apiCall('Calling Deepgram Edge Function (base64 mode)', {
      base64Size: `${(base64Audio.length / 1024 / 1024).toFixed(2)} MB`,
      options: {
        model: options.model || 'nova-2-general',
        language: options.language,
        diarize: options.speaker_labels
      }
    });

    const { data, error } = await supabase.functions.invoke('deepgram-transcribe', {
      body: {
        audio: base64Audio,
        mimeType: audioFile.type,
        options: {
          model: options.model || 'nova-2-general',
          language: options.language_detection ? undefined : options.language,
          detect_language: options.language_detection || false,
          diarize: options.speaker_labels || false,
          punctuate: true,
          utterances: options.speaker_labels || false,
          smart_format: options.smart_formatting !== false,
          profanity_filter: options.profanity_filter || false
        }
      }
    });

    const apiCallDuration = logTranscription.timing('Deepgram API call (small file)', apiCallStartTime);

    if (error) {
      logTranscription.error('Edge function error', error, { fileName: audioFile.name });
      logger.error('Deepgram edge function error', error, { fileName: audioFile.name });
      throw new Error(`Deepgram transcription failed: ${error.message}`);
    }

    if (!data || !data.success) {
      const errorMsg = data?.error || 'Deepgram transcription failed';
      logTranscription.error('Transcription failed', new Error(errorMsg), { response: data });
      logger.error('Deepgram transcription failed', new Error(errorMsg), { fileName: audioFile.name });
      throw new Error(errorMsg);
    }

    return this.processTranscriptionResult(data, audioFile, startTime, apiCallDuration);
  }

  private processTranscriptionResult(
    data: any, 
    audioFile: File, 
    startTime: number,
    apiCallDuration: number
  ) {
    const processingStartTime = Date.now();
    this.updateProgress('processing', 80, 'Processing speaker diarization...');

    const result = data.result as DeepgramTranscriptionResult;
    
    // Process utterances
    const speakerUtterances = this.processRawSpeakerUtterances(result.speakerUtterances);
    
    // Check for single speaker warning
    const uniqueSpeakers = new Set(speakerUtterances.map(u => u.speaker)).size;
    if (uniqueSpeakers === 1 && speakerUtterances.length > 5) {
      console.warn('⚠️ [DIARIZATION] Only 1 speaker detected with', speakerUtterances.length, 'utterances');
      logger.warn('Diarization returned only 1 speaker - potential issue', {
        fileName: audioFile.name,
        utteranceCount: speakerUtterances.length
      });
    }

    const totalDuration = Date.now() - startTime;
    const processingDuration = Date.now() - processingStartTime;
    
    const stats: TranscriptionStats = {
      audioDurationSeconds: result.stats?.audioDurationSeconds || result.metadata?.duration || 0,
      audioDurationMinutes: result.stats?.audioDurationMinutes || result.metadata?.durationMinutes || 0,
      fileSizeBytes: audioFile.size,
      responseTimeMs: apiCallDuration,
      totalProcessingTimeMs: totalDuration,
      uniqueSpeakers,
      utteranceCount: speakerUtterances.length,
      textLength: result.text.length
    };

    // Log detailed results
    logTranscription.result({
      textLength: result.text.length,
      utteranceCount: speakerUtterances.length,
      uniqueSpeakers,
      audioDurationMinutes: stats.audioDurationMinutes,
      responseTimeMs: apiCallDuration,
      detectedLanguage: result.detectedLanguage?.language
    });

    console.log('📈 [STATS] Detailed statistics:', {
      file: audioFile.name,
      audioDuration: `${stats.audioDurationMinutes.toFixed(2)} min (${stats.audioDurationSeconds.toFixed(1)}s)`,
      fileSize: `${(stats.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`,
      apiResponseTime: `${(stats.responseTimeMs / 1000).toFixed(2)}s`,
      totalProcessingTime: `${(stats.totalProcessingTimeMs / 1000).toFixed(2)}s`,
      processingOverhead: `${(processingDuration)}ms`,
      speakers: stats.uniqueSpeakers,
      utterances: stats.utteranceCount,
      textChars: stats.textLength
    });
    
    this.updateProgress('complete', 100, 'Transcription complete!');

    logger.info('Deepgram transcription completed successfully', {
      fileName: audioFile.name,
      ...stats
    });

    return {
      text: result.text,
      speakerUtterances,
      audioDurationMinutes: stats.audioDurationMinutes,
      stats
    };
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private processRawSpeakerUtterances(utterances: unknown[]): SpeakerUtterance[] {
    logger.debug('Processing Deepgram utterances', { 
      utteranceCount: utterances?.length || 0 
    });
    
    if (!utterances || !Array.isArray(utterances)) {
      console.warn('⚠️ [UTTERANCES] No utterances array or invalid format');
      logger.warn('No utterances array found or invalid format');
      return [];
    }

    console.log(`👥 [UTTERANCES] Processing ${utterances.length} utterances...`);

    const processedUtterances = utterances.map((utterance: any, index: number) => {
      // Use the speaker label directly from the edge function (already formatted as "Speaker X")
      const speakerLabel = utterance.speaker || 'Speaker 0';
      
      return {
        speaker: speakerLabel,
        text: utterance.text || '',
        confidence: utterance.confidence || 0.9,
        start: utterance.start || 0,
        end: utterance.end || 0
      };
    });

    // Log speaker distribution for analysis
    const speakerDistribution = processedUtterances.reduce((acc: Record<string, number>, utterance) => {
      acc[utterance.speaker] = (acc[utterance.speaker] || 0) + 1;
      return acc;
    }, {});
    
    console.log('👥 [SPEAKER DISTRIBUTION]', speakerDistribution);
    
    // Calculate talk time per speaker
    const speakerTalkTime = processedUtterances.reduce((acc: Record<string, number>, utterance) => {
      const duration = utterance.end - utterance.start;
      acc[utterance.speaker] = (acc[utterance.speaker] || 0) + duration;
      return acc;
    }, {});
    
    console.log('⏱️ [SPEAKER TALK TIME]', Object.entries(speakerTalkTime).map(([speaker, time]) => ({
      speaker,
      talkTime: `${(time as number).toFixed(1)}s`
    })));
    
    logger.debug('Speaker distribution analysis', { 
      speakerDistribution, 
      speakerTalkTime,
      totalUtterances: processedUtterances.length 
    });

    return processedUtterances;
  }
}

export const deepgramService = new DeepgramService();
export type { DeepgramOptions };

// Type for transcription statistics
export interface TranscriptionStats {
  audioDurationSeconds: number;
  audioDurationMinutes: number;
  fileSizeBytes: number;
  responseTimeMs: number;
  totalProcessingTimeMs: number;
  uniqueSpeakers: number;
  utteranceCount: number;
  textLength: number;
}

// Type for transcription result with audio duration
export interface TranscriptionResultWithDuration {
  text: string;
  speakerUtterances: SpeakerUtterance[];
  audioDurationMinutes?: number;
  stats?: TranscriptionStats;
}
