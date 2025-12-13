
import { DeepgramOptions, DeepgramTranscriptionResult, DeepgramProgress } from '../types/deepgram';
import { SpeakerUtterance, UnifiedTranscriptionProgress } from '../types';
import { supabase } from '../integrations/supabase/client';
import { logger } from './loggingService';
import { sanitizeFilename } from '../utils/filenameSanitizer';
import { audioCleanupService } from './audioCleanupService';

interface TranscriptionDebugInfo {
  requestId?: string;
  deepgramRequestId?: string;
  firstUtteranceStart?: number;
  lastUtteranceEnd?: number;
  coveragePercentage?: number;
  totalTalkTimeSeconds?: number;
  totalPauseTimeSeconds?: number;
  validationWarnings?: string[];
  isPotentiallyTruncated?: boolean;
}

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

  async transcribe(
    audioFile: File, 
    options: DeepgramOptions,
    dialogId?: string
  ): Promise<{ text: string; speakerUtterances: SpeakerUtterance[]; debug?: TranscriptionDebugInfo }> {
    const transcriptionStartTime = Date.now();
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║          🎙️ CLIENT: Starting Deepgram Transcription          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`│ File Name: ${audioFile.name}`);
    console.log(`│ File Size: ${(audioFile.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`│ File Type: ${audioFile.type}`);
    console.log(`│ Dialog ID: ${dialogId || 'NOT PROVIDED'}`);
    console.log(`│ Options:`, JSON.stringify(options));
    console.log('└─────────────────────────────────────────────────────────────┘');

    try {
      const fileSizeMB = audioFile.size / (1024 * 1024);
      const isLargeFile = fileSizeMB > 8;

      console.log(`📁 [FILE] Processing mode: ${isLargeFile ? 'LARGE FILE (>8MB)' : 'SMALL FILE (<8MB)'}`);

      if (isLargeFile) {
        return await this.transcribeLargeFile(audioFile, options, dialogId, transcriptionStartTime);
      } else {
        return await this.transcribeSmallFile(audioFile, options, dialogId, transcriptionStartTime);
      }

    } catch (error) {
      const elapsed = Date.now() - transcriptionStartTime;
      console.error('╔══════════════════════════════════════════════════════════════╗');
      console.error('║          ❌ CLIENT: Transcription Failed                      ║');
      console.error('╚══════════════════════════════════════════════════════════════╝');
      console.error(`│ Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`│ Elapsed Time: ${(elapsed / 1000).toFixed(2)}s`);
      console.error('└─────────────────────────────────────────────────────────────┘');
      
      this.updateProgress('error', 0, error instanceof Error ? error.message : 'Transcription failed');
      throw error;
    }
  }

  private async transcribeLargeFile(
    audioFile: File, 
    options: DeepgramOptions, 
    dialogId: string | undefined,
    startTime: number
  ): Promise<{ text: string; speakerUtterances: SpeakerUtterance[]; debug?: TranscriptionDebugInfo }> {
    this.updateProgress('uploading', 10, 'Uploading large file to storage...');
    
    const uploadStart = Date.now();
    const fileName = `audio_${Date.now()}_${sanitizeFilename(audioFile.name)}`;
    
    console.log(`📤 [UPLOAD] Starting upload: ${fileName}`);
    
    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, audioFile);

    const uploadTime = Date.now() - uploadStart;
    console.log(`✅ [UPLOAD] Completed in ${(uploadTime / 1000).toFixed(2)}s`);

    if (uploadError) {
      console.error(`❌ [UPLOAD] Failed:`, uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    this.updateProgress('processing', 30, 'Processing large audio file...');

    const edgeFunctionStart = Date.now();
    console.log(`🚀 [EDGE_FUNCTION] Calling deepgram-transcribe...`);
    
    const { data, error } = await supabase.functions.invoke('deepgram-transcribe', {
      body: {
        storageFile: fileName,
        mimeType: audioFile.type,
        dialogId,
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

    const edgeFunctionTime = Date.now() - edgeFunctionStart;
    console.log(`✅ [EDGE_FUNCTION] Completed in ${(edgeFunctionTime / 1000).toFixed(2)}s`);

    // Cleanup is handled by edge function, but try again just in case
    await audioCleanupService.cleanupSingleFile(fileName);

    if (error) {
      console.error(`❌ [EDGE_FUNCTION] Error:`, error);
      throw new Error(`Deepgram transcription failed: ${error.message}`);
    }

    if (!data || !data.success) {
      const errorMsg = data?.error || 'Deepgram transcription failed';
      console.error(`❌ [EDGE_FUNCTION] Failed:`, errorMsg);
      throw new Error(errorMsg);
    }

    return this.processTranscriptionResult(data, audioFile.name, startTime);
  }

  private async transcribeSmallFile(
    audioFile: File, 
    options: DeepgramOptions, 
    dialogId: string | undefined,
    startTime: number
  ): Promise<{ text: string; speakerUtterances: SpeakerUtterance[]; debug?: TranscriptionDebugInfo }> {
    this.updateProgress('uploading', 10, 'Processing audio with Deepgram...');

    const conversionStart = Date.now();
    const base64Audio = await this.fileToBase64(audioFile);
    const conversionTime = Date.now() - conversionStart;
    
    console.log(`✅ [CONVERSION] File to Base64 in ${conversionTime}ms (${(base64Audio.length / 1024 / 1024).toFixed(2)} MB)`);
    
    this.updateProgress('processing', 30, 'Processing audio with Deepgram...');

    const edgeFunctionStart = Date.now();
    console.log(`🚀 [EDGE_FUNCTION] Calling deepgram-transcribe...`);

    const { data, error } = await supabase.functions.invoke('deepgram-transcribe', {
      body: {
        audio: base64Audio,
        mimeType: audioFile.type,
        dialogId,
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

    const edgeFunctionTime = Date.now() - edgeFunctionStart;
    console.log(`✅ [EDGE_FUNCTION] Completed in ${(edgeFunctionTime / 1000).toFixed(2)}s`);

    if (error) {
      console.error(`❌ [EDGE_FUNCTION] Error:`, error);
      throw new Error(`Deepgram transcription failed: ${error.message}`);
    }

    if (!data || !data.success) {
      const errorMsg = data?.error || 'Deepgram transcription failed';
      console.error(`❌ [EDGE_FUNCTION] Failed:`, errorMsg);
      throw new Error(errorMsg);
    }

    return this.processTranscriptionResult(data, audioFile.name, startTime);
  }

  private processTranscriptionResult(data: any, fileName: string, startTime: number) {
    this.updateProgress('processing', 80, 'Processing speaker diarization...');

    const result = data.result as DeepgramTranscriptionResult & { debug?: TranscriptionDebugInfo };
    const debug = result.debug;
    
    // Process utterances
    const speakerUtterances = this.processRawSpeakerUtterances(result.speakerUtterances);
    
    // Log debug info from edge function
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│              📊 CLIENT: Transcription Results               │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ Transcript Length: ${result.text.length} characters`);
    console.log(`│ Utterance Count: ${speakerUtterances.length}`);
    console.log(`│ Audio Duration: ${result.metadata?.durationMinutes?.toFixed(2) || 'N/A'} minutes`);
    console.log(`│ Unique Speakers: ${new Set(speakerUtterances.map(u => u.speaker)).size}`);
    
    if (debug) {
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log('│                    🔍 DEBUG INFO                             │');
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log(`│ Request ID: ${debug.requestId || 'N/A'}`);
      console.log(`│ Deepgram Request ID: ${debug.deepgramRequestId || 'N/A'}`);
      console.log(`│ First Utterance Start: ${debug.firstUtteranceStart?.toFixed(2) || 'N/A'}s`);
      console.log(`│ Last Utterance End: ${debug.lastUtteranceEnd?.toFixed(2) || 'N/A'}s`);
      console.log(`│ Coverage: ${debug.coveragePercentage?.toFixed(2) || 'N/A'}%`);
      console.log(`│ Talk Time: ${debug.totalTalkTimeSeconds?.toFixed(2) || 'N/A'}s`);
      console.log(`│ Pause Time: ${debug.totalPauseTimeSeconds?.toFixed(2) || 'N/A'}s`);
      console.log(`│ Potentially Truncated: ${debug.isPotentiallyTruncated ? 'YES ⚠️' : 'NO'}`);
      
      if (debug.validationWarnings && debug.validationWarnings.length > 0) {
        console.log('├─────────────────────────────────────────────────────────────┤');
        console.log('│                    ⚠️ WARNINGS                              │');
        debug.validationWarnings.forEach(w => console.log(`│ • ${w}`));
      }
    }
    
    const totalElapsed = Date.now() - startTime;
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ Total Client Time: ${(totalElapsed / 1000).toFixed(2)}s`);
    console.log('└─────────────────────────────────────────────────────────────┘');
    
    // Check for single speaker warning
    const uniqueSpeakers = new Set(speakerUtterances.map(u => u.speaker)).size;
    if (uniqueSpeakers === 1 && speakerUtterances.length > 5) {
      logger.warn('Diarization returned only 1 speaker - potential issue', {
        fileName,
        utteranceCount: speakerUtterances.length
      });
    }
    
    // Check for potential truncation
    if (debug?.isPotentiallyTruncated) {
      logger.warn('Transcription may be truncated', {
        fileName,
        lastUtteranceEnd: debug.lastUtteranceEnd,
        audioDuration: result.metadata?.duration,
        validationWarnings: debug.validationWarnings
      });
    }
    
    this.updateProgress('complete', 100, 'Transcription complete!');

    logger.info('Deepgram transcription completed successfully', {
      fileName,
      textLength: result.text.length,
      utteranceCount: speakerUtterances.length,
      detectedLanguage: result.detectedLanguage,
      audioDurationMinutes: result.metadata?.durationMinutes || 0,
      uniqueSpeakers,
      isPotentiallyTruncated: debug?.isPotentiallyTruncated
    });

    return {
      text: result.text,
      speakerUtterances,
      audioDurationMinutes: result.metadata?.durationMinutes || 0,
      stats: result.stats,
      debug
    };
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private processRawSpeakerUtterances(utterances: unknown[]): SpeakerUtterance[] {
    if (!utterances || !Array.isArray(utterances)) {
      console.warn('⚠️ [UTTERANCES] No utterances array found or invalid format');
      return [];
    }

    const processedUtterances = utterances.map((utterance: any) => {
      const speakerLabel = utterance.speaker || 'Speaker 0';
      
      return {
        speaker: speakerLabel,
        text: utterance.text || '',
        confidence: utterance.confidence || 0.9,
        start: utterance.start || 0,
        end: utterance.end || 0
      };
    });

    // Log speaker distribution
    const speakerDistribution = processedUtterances.reduce((acc: Record<string, number>, utterance) => {
      acc[utterance.speaker] = (acc[utterance.speaker] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`👥 [SPEAKERS] Distribution:`, speakerDistribution);

    return processedUtterances;
  }
}

export const deepgramService = new DeepgramService();
export type { DeepgramOptions };

export interface TranscriptionResultWithDuration {
  text: string;
  speakerUtterances: SpeakerUtterance[];
  audioDurationMinutes?: number;
  stats?: {
    audioDurationSeconds: number;
    audioDurationMinutes: number;
    fileSizeBytes: number;
    responseTimeMs: number;
    uniqueSpeakers: number;
  };
  debug?: TranscriptionDebugInfo;
}
