
import { DeepgramOptions, DeepgramTranscriptionResult, DeepgramProgress } from '../types/deepgram';
import { SpeakerUtterance, UnifiedTranscriptionProgress } from '../types';
import { supabase } from '../integrations/supabase/client';

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
    console.log('🎙️ Starting Deepgram transcription', { fileName: audioFile.name, options });

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
        console.error('❌ Deepgram edge function error:', error);
        throw new Error(`Deepgram transcription failed: ${error.message}`);
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Deepgram transcription failed');
      }

      this.updateProgress('processing', 80, 'Processing speaker diarization...');

      const result = data.result as DeepgramTranscriptionResult;
      
      // Convert to unified format
      const speakerUtterances = this.processSpeakerUtterances(result.speakerUtterances);
      
      this.updateProgress('complete', 100, 'Transcription complete!');

      console.log('✅ Deepgram transcription completed', {
        textLength: result.text.length,
        utteranceCount: speakerUtterances.length,
        detectedLanguage: result.detectedLanguage
      });

      return {
        text: result.text,
        speakerUtterances
      };

    } catch (error) {
      console.error('❌ Deepgram service error:', error);
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

  private processSpeakerUtterances(utterances: any[]): SpeakerUtterance[] {
    return utterances.map((utterance, index) => {
      // Intelligent speaker role detection
      const speakerLabel = this.detectSpeakerRole(utterance.text, utterance.speaker, index);
      
      return {
        speaker: speakerLabel,
        text: utterance.text,
        confidence: utterance.confidence || 0.9,
        start: utterance.start,
        end: utterance.end
      };
    });
  }

  private detectSpeakerRole(text: string, speakerNumber: string, utteranceIndex: number): string {
    const lowerText = text.toLowerCase();
    
    // Keywords that suggest agent role
    const agentKeywords = [
      'thank you for calling',
      'how can i help',
      'my name is',
      'i can assist',
      'let me check',
      'i understand',
      'is there anything else',
      'have a great day'
    ];

    // Keywords that suggest customer role
    const customerKeywords = [
      'i have a problem',
      'i need help',
      'my account',
      'i want to',
      'can you help me',
      'i\'m calling about'
    ];

    // Check for agent patterns
    const isAgent = agentKeywords.some(keyword => lowerText.includes(keyword));
    if (isAgent) {
      return 'Agent';
    }

    // Check for customer patterns
    const isCustomer = customerKeywords.some(keyword => lowerText.includes(keyword));
    if (isCustomer) {
      return 'Customer';
    }

    // Fallback logic: first speaker is usually agent in customer service
    if (utteranceIndex < 2) {
      return speakerNumber === '0' ? 'Agent' : 'Customer';
    }

    // Default labeling
    return speakerNumber === '0' ? 'Agent' : 'Customer';
  }
}

export const deepgramService = new DeepgramService();
export type { DeepgramOptions };
