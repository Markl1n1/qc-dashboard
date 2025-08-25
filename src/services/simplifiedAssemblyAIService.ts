
import { SpeakerUtterance, UnifiedTranscriptionProgress } from '../types';
import { supabase } from '../integrations/supabase/client';
import { EmergencyLogger } from './emergencyLogger';

export interface SimplifiedAssemblyAIOptions {
  speaker_labels?: boolean;
  speakers_expected?: number;
  language_detection?: boolean;
  language_code?: string;
}

export interface SimplifiedAssemblyAIResult {
  text: string;
  speakerUtterances: SpeakerUtterance[];
  transcriptId?: string;
}

class SimplifiedAssemblyAIService {
  private progressCallback?: (progress: UnifiedTranscriptionProgress) => void;
  private isProcessing = false;
  private callDepth = 0;
  private readonly maxCallDepth = 10;

  constructor() {
    EmergencyLogger.log('SimplifiedAssemblyAIService initialized');
  }

  setProgressCallback(callback: (progress: UnifiedTranscriptionProgress) => void) {
    EmergencyLogger.log('Setting progress callback');
    this.progressCallback = callback;
  }

  private updateProgress(stage: UnifiedTranscriptionProgress['stage'], progress: number, message: string) {
    this.callDepth++;
    
    if (this.callDepth > this.maxCallDepth) {
      EmergencyLogger.log('CRITICAL: Maximum call depth reached in updateProgress', { callDepth: this.callDepth });
      throw new Error('Stack overflow prevention: Too many nested calls in updateProgress');
    }

    EmergencyLogger.log(`Progress Update (depth: ${this.callDepth})`, { stage, progress, message });
    
    if (this.progressCallback) {
      try {
        // Use setTimeout to break the call stack
        setTimeout(() => {
          if (this.progressCallback) {
            this.progressCallback({ stage, progress, message });
          }
          this.callDepth--;
        }, 0);
      } catch (error) {
        EmergencyLogger.log('Error in progress callback', error);
        this.callDepth--;
      }
    } else {
      this.callDepth--;
    }
  }

  private async convertFileToBase64(file: File): Promise<string> {
    EmergencyLogger.log('Starting file conversion to base64', { fileName: file.name, size: file.size });
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64 = result.split(',')[1];
          EmergencyLogger.log('File converted to base64 successfully', { base64Length: base64.length });
          resolve(base64);
        } catch (error) {
          EmergencyLogger.log('Error processing FileReader result', error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        EmergencyLogger.log('FileReader error', reader.error);
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  async transcribe(audioFile: File, options: SimplifiedAssemblyAIOptions): Promise<SimplifiedAssemblyAIResult> {
    EmergencyLogger.log('Transcribe method called', { 
      fileName: audioFile.name, 
      fileSize: audioFile.size,
      isProcessing: this.isProcessing 
    });

    if (this.isProcessing) {
      EmergencyLogger.log('Already processing, rejecting new request');
      throw new Error('Another transcription is already in progress');
    }

    this.isProcessing = true;
    EmergencyLogger.log('Set processing flag to true');

    try {
      // Step 1: Authentication check
      EmergencyLogger.log('Checking authentication');
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session) {
        EmergencyLogger.log('Authentication failed', authError);
        throw new Error('Authentication required');
      }
      
      EmergencyLogger.log('Authentication successful', { userEmail: session.user.email });

      // Step 2: Convert file to base64
      this.updateProgress('uploading', 10, 'Converting file...');
      const base64Audio = await this.convertFileToBase64(audioFile);
      
      // Step 3: Upload to AssemblyAI
      this.updateProgress('uploading', 30, 'Uploading to AssemblyAI...');
      EmergencyLogger.log('Calling edge function for upload');
      
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('assemblyai-transcribe', {
        body: {
          action: 'upload',
          audioData: base64Audio,
          fileName: audioFile.name
        }
      });

      if (uploadError) {
        EmergencyLogger.log('Upload error', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      EmergencyLogger.log('Upload successful', uploadData);
      const uploadUrl = uploadData.upload_url;

      // Step 4: Start transcription
      this.updateProgress('processing', 50, 'Starting transcription...');
      EmergencyLogger.log('Starting transcription with options', options);

      const transcriptionOptions = {
        audio_url: uploadUrl,
        speaker_labels: options.speaker_labels || false,
        language_detection: options.language_detection !== false
      };

      const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke('assemblyai-transcribe', {
        body: {
          action: 'transcribe',
          ...transcriptionOptions
        }
      });

      if (transcriptError) {
        EmergencyLogger.log('Transcription start error', transcriptError);
        throw new Error(`Transcription failed: ${transcriptError.message}`);
      }

      EmergencyLogger.log('Transcription started', { transcriptId: transcriptData.id });
      const transcriptId = transcriptData.id;

      // Step 5: Poll for completion (simplified)
      this.updateProgress('processing', 70, 'Processing audio...');
      const finalResult = await this.pollForCompletion(transcriptId);
      
      this.updateProgress('complete', 100, 'Transcription complete');
      EmergencyLogger.log('Transcription completed successfully');

      return this.formatResults(finalResult, transcriptId);

    } catch (error) {
      EmergencyLogger.log('Transcription error', error);
      this.updateProgress('error', 0, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    } finally {
      this.isProcessing = false;
      EmergencyLogger.log('Processing flag set to false');
    }
  }

  private async pollForCompletion(transcriptId: string, maxAttempts: number = 60): Promise<any> {
    EmergencyLogger.log('Starting polling', { transcriptId, maxAttempts });
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('assemblyai-transcribe', {
          body: {
            action: 'poll',
            transcriptId
          }
        });

        if (error) {
          EmergencyLogger.log('Poll error', { attempt, error });
          throw new Error(`Poll failed: ${error.message}`);
        }

        EmergencyLogger.log('Poll result', { attempt, status: data.status });

        if (data.status === 'completed') {
          return data;
        } else if (data.status === 'error') {
          throw new Error(`Transcription failed: ${data.error}`);
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Update progress
        const progress = Math.min(90, 70 + (attempt * 20 / maxAttempts));
        this.updateProgress('processing', progress, 'Processing audio...');

      } catch (error) {
        EmergencyLogger.log('Poll attempt failed', { attempt, error });
        if (attempt >= maxAttempts - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error('Transcription timed out');
  }

  private formatResults(transcript: any, transcriptId: string): SimplifiedAssemblyAIResult {
    EmergencyLogger.log('Formatting results', { transcriptId, hasText: !!transcript.text });
    
    const text = transcript.text || '';
    const speakerUtterances: SpeakerUtterance[] = [];

    if (transcript.utterances) {
      for (const utterance of transcript.utterances) {
        speakerUtterances.push({
          speaker: utterance.speaker === 'A' ? 'Agent' : 'Customer',
          text: utterance.text,
          confidence: utterance.confidence,
          start: utterance.start,
          end: utterance.end,
        });
      }
    }

    const result = { text, speakerUtterances, transcriptId };
    EmergencyLogger.log('Results formatted', { textLength: text.length, utteranceCount: speakerUtterances.length });
    
    return result;
  }
}

export const simplifiedAssemblyAIService = new SimplifiedAssemblyAIService();
