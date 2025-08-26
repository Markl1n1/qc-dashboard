
import { DeepgramOptions, DeepgramTranscriptionResult, DeepgramProgress } from '../types/deepgram';
import { SpeakerUtterance, UnifiedTranscriptionProgress } from '../types';
import { supabase } from '../integrations/supabase/client';
import { logger } from './loggingService';

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

  async transcribe(audioFile: File, options: DeepgramOptions): Promise<{ text: string; speakerUtterances: SpeakerUtterance[] }> {
    logger.info('Starting Deepgram transcription', { 
      fileName: audioFile.name, 
      fileSize: audioFile.size,
      options 
    });

    try {
      this.updateProgress('uploading', 10, 'Uploading audio to Deepgram...');

      // Convert File to base64
      const base64Audio = await this.fileToBase64(audioFile);
      
      this.updateProgress('processing', 30, 'Processing audio with Deepgram...');

      // Call Deepgram edge function
      const { data, error } = await supabase.functions.invoke('deepgram-transcribe', {
        body: {
          audio: base64Audio,
          mimeType: audioFile.type,
          options: {
            model: options.model || 'nova-2',
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

      if (error) {
        logger.error('Deepgram edge function error', error, { fileName: audioFile.name });
        throw new Error(`Deepgram transcription failed: ${error.message}`);
      }

      if (!data || !data.success) {
        const errorMsg = data?.error || 'Deepgram transcription failed';
        logger.error('Deepgram transcription failed', new Error(errorMsg), { fileName: audioFile.name });
        throw new Error(errorMsg);
      }

      this.updateProgress('processing', 80, 'Processing speaker diarization...');

      const result = data.result as DeepgramTranscriptionResult;
      
      // Process utterances
      const speakerUtterances = this.processRawSpeakerUtterances(result.speakerUtterances);
      
      this.updateProgress('complete', 100, 'Transcription complete!');

      logger.info('Deepgram transcription completed successfully', {
        fileName: audioFile.name,
        textLength: result.text.length,
        utteranceCount: speakerUtterances.length,
        detectedLanguage: result.detectedLanguage
      });

      return {
        text: result.text,
        speakerUtterances
      };

    } catch (error) {
      logger.error('Deepgram service error', error as Error, { fileName: audioFile.name });
      this.updateProgress('error', 0, error instanceof Error ? error.message : 'Transcription failed');
      throw error;
    }
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
      logger.warn('No utterances array found or invalid format');
      return [];
    }

    const processedUtterances = utterances.map((utterance: any, index: number) => {
      // Use RAW speaker numbers - no intelligent detection
      const speakerNumber = utterance.speaker !== undefined ? utterance.speaker : 0;
      const speakerLabel = `Speaker ${speakerNumber}`;
      
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
    
    logger.debug('Speaker distribution analysis', { 
      speakerDistribution, 
      totalUtterances: processedUtterances.length 
    });

    return processedUtterances;
  }
}

export const deepgramService = new DeepgramService();
export type { DeepgramOptions };
