
import { DeepgramOptions, DeepgramTranscriptionResult, DeepgramProgress } from '../types/deepgram';
import { SpeakerUtterance, UnifiedTranscriptionProgress } from '../types';
import { supabase } from '../integrations/supabase/client';
import { logger } from '../utils/logger';

class DeepgramService {
  private progressCallback: ((progress: UnifiedTranscriptionProgress) => void) | null = null;

  setProgressCallback(callback: (progress: UnifiedTranscriptionProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: UnifiedTranscriptionProgress['stage'], progress: number, message: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message });
    }
  }

  async transcribe(audioFile: File, options: DeepgramOptions): Promise<{ text: string; speakerUtterances: SpeakerUtterance[] }> {
    logger.info('🎙️ Starting Deepgram transcription', { fileName: audioFile.name, options });

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
        logger.error('❌ Deepgram edge function error:', error);
        throw new Error(`Deepgram transcription failed: ${error.message}`);
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Deepgram transcription failed');
      }

      this.updateProgress('processing', 80, 'Processing speaker diarization...');

      const result = data.result as DeepgramTranscriptionResult;
      
      // LOG THE COMPLETE RAW RESPONSE FOR DEBUGGING
      logger.warn('🔍 DEEPGRAM RAW RESPONSE STRUCTURE:');
      logger.warn('🔍 Full result object:', result);
      logger.warn('🔍 Speaker utterances array:', result.speakerUtterances);
      logger.warn('🔍 Detected language:', result.detectedLanguage);
      logger.warn('🔍 Metadata:', result.metadata);
      
      // Convert to unified format - USE RAW SPEAKER NUMBERS
      const speakerUtterances = this.processRawSpeakerUtterances(result.speakerUtterances);
      
      this.updateProgress('complete', 100, 'Transcription complete!');

      logger.info('✅ Deepgram transcription completed', {
        textLength: result.text.length,
        utteranceCount: speakerUtterances.length,
        detectedLanguage: result.detectedLanguage
      });

      return {
        text: result.text,
        speakerUtterances
      };

    } catch (error) {
      logger.error('❌ Deepgram service error:', error);
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

  private processRawSpeakerUtterances(utterances: any[]): SpeakerUtterance[] {
    logger.warn('🔍 PROCESSING DEEPGRAM UTTERANCES:');
    logger.warn('🔍 Input utterances array length:', utterances?.length || 0);
    
    if (!utterances || !Array.isArray(utterances)) {
      logger.warn('🔍 No utterances array found or invalid format');
      return [];
    }

    const processedUtterances = utterances.map((utterance, index) => {
      // LOG EACH INDIVIDUAL UTTERANCE STRUCTURE
      logger.warn(`🔍 Utterance ${index}:`, {
        speaker: utterance.speaker,
        text: utterance.text?.substring(0, 50) + '...',
        confidence: utterance.confidence,
        start: utterance.start,
        end: utterance.end,
        fullObject: utterance
      });

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

    // LOG SPEAKER DISTRIBUTION FOR ANALYSIS
    const speakerDistribution = processedUtterances.reduce((acc: any, utterance: any) => {
      acc[utterance.speaker] = (acc[utterance.speaker] || 0) + 1;
      return acc;
    }, {});
    
    logger.warn('🔍 FINAL SPEAKER DISTRIBUTION:', speakerDistribution);
    logger.warn('🔍 TOTAL PROCESSED UTTERANCES:', processedUtterances.length);

    return processedUtterances;
  }
}

export const deepgramService = new DeepgramService();
export type { DeepgramOptions };
