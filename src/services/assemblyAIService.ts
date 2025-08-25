
import { SpeakerUtterance, UnifiedTranscriptionProgress } from '../types';
import { languageDetectionService } from './languageDetectionService';
import { createFileWithCorrectMimeType, isValidAudioFile } from '../utils/audioFileUtils';
import { supabase } from '../integrations/supabase/client';

export interface AssemblyAIOptions {
  speaker_labels?: boolean;
  speakers_expected?: number;
  auto_chapters?: boolean;
  sentiment_analysis?: boolean;
  language_code?: string;
  language_detection?: boolean;
  speech_model?: 'universal' | 'nano';
  disfluencies?: boolean;
  zeroDataRetention?: boolean;
  deleteAfterProcessing?: boolean;
  deleteLemurData?: boolean;
}

export interface AssemblyAITranscript {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  utterances?: Array<{
    speaker: string;
    text: string;
    confidence: number;
    start: number;
    end: number;
  }>;
  language_code?: string;
  language_confidence?: number;
  error?: string;
}

export interface AssemblyAIResult {
  text: string;
  speakerUtterances: SpeakerUtterance[];
  transcriptId?: string;
  deletionStatus?: 'pending' | 'completed' | 'failed';
  tokenEstimation?: {
    audioLengthMinutes: number;
    estimatedCost: number;
  };
}

class AssemblyAIService {
  private progressCallback?: (progress: UnifiedTranscriptionProgress) => void;

  setProgressCallback(callback: (progress: UnifiedTranscriptionProgress) => void) {
    this.progressCallback = callback;
    console.log('[AssemblyAI] Progress callback set');
  }

  private updateProgress(stage: UnifiedTranscriptionProgress['stage'], progress: number, message: string) {
    console.log(`[AssemblyAI] Progress: ${stage} (${progress}%) - ${message}`);
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message });
    }
  }

  validateApiKey(): boolean {
    // API key validation is now handled by the edge function
    console.log('[AssemblyAI] API key validation delegated to edge function');
    return true;
  }

  async transcribe(audioFile: File, options: AssemblyAIOptions): Promise<AssemblyAIResult> {
    console.log(`[AssemblyAI] Starting transcription process...`);
    console.log(`[AssemblyAI] File details:`, {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
      lastModified: new Date(audioFile.lastModified).toISOString()
    });
    console.log(`[AssemblyAI] Options:`, options);

    // Validate and fix audio file MIME type
    if (!isValidAudioFile(audioFile)) {
      const error = `Unsupported audio file format: ${audioFile.name} with type: ${audioFile.type}. Please use supported formats: MP3, WAV, M4A, FLAC, OGG, AAC, WEBM, 3GP, AMR, WMA`;
      console.error(`[AssemblyAI] ${error}`);
      throw new Error(error);
    }

    // For converted files, ensure they have the correct MIME type
    let fileToUpload = audioFile;
    if (audioFile.name.includes('_converted.wav')) {
      console.log(`[AssemblyAI] Handling converted WAV file: ${audioFile.name}`);
      fileToUpload = new File([audioFile], audioFile.name, {
        type: 'audio/wav',
        lastModified: audioFile.lastModified
      });
    } else {
      fileToUpload = createFileWithCorrectMimeType(audioFile);
    }
    
    console.log(`[AssemblyAI] Final file to upload:`, {
      name: fileToUpload.name,
      type: fileToUpload.type,
      size: fileToUpload.size
    });

    this.updateProgress('uploading', 10, 'Uploading audio to AssemblyAI...');

    try {
      // Step 1: Upload audio file
      console.log('[AssemblyAI] Step 1: Uploading audio file...');
      const uploadUrl = await this.uploadAudio(fileToUpload);
      console.log('[AssemblyAI] Upload completed, URL received:', uploadUrl);
      
      this.updateProgress('queued', 30, 'Audio uploaded, starting transcription...');

      // Step 2: Start transcription
      console.log('[AssemblyAI] Step 2: Starting transcription...');
      const transcriptId = await this.startTranscription(uploadUrl, options);
      console.log('[AssemblyAI] Transcription started with ID:', transcriptId);
      
      this.updateProgress('processing', 50, 'Transcription in progress...');

      // Step 3: Poll for completion
      console.log('[AssemblyAI] Step 3: Polling for completion...');
      const transcript = await this.pollTranscription(transcriptId);
      console.log('[AssemblyAI] Transcription completed:', {
        id: transcript.id,
        status: transcript.status,
        textLength: transcript.text?.length || 0,
        utteranceCount: transcript.utterances?.length || 0
      });

      this.updateProgress('complete', 100, 'Transcription completed');

      const result = this.formatResults(transcript, transcriptId, fileToUpload);
      console.log('[AssemblyAI] Final result formatted:', {
        textLength: result.text.length,
        utteranceCount: result.speakerUtterances.length,
        transcriptId: result.transcriptId
      });
      
      return result;
    } catch (error) {
      console.error(`[AssemblyAI] Transcription error:`, error);
      console.error(`[AssemblyAI] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      this.updateProgress('error', 0, `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async uploadAudio(audioFile: File): Promise<string> {
    console.log(`[AssemblyAI] Preparing file upload...`);
    
    // Validate file before upload
    if (audioFile.size === 0) {
      throw new Error('Audio file is empty');
    }
    
    if (audioFile.size > 500 * 1024 * 1024) { // 500MB limit
      throw new Error('Audio file is too large (max 500MB)');
    }

    console.log(`[AssemblyAI] Converting file to base64...`);
    // Convert file to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    console.log(`[AssemblyAI] Base64 conversion completed, length: ${base64.length}`);

    console.log(`[AssemblyAI] Calling upload edge function...`);
    const { data, error } = await supabase.functions.invoke('assemblyai-transcribe', {
      body: {
        action: 'upload',
        audioData: base64,
        fileName: audioFile.name
      }
    });

    if (error) {
      console.error(`[AssemblyAI] Upload failed:`, error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    if (!data || !data.upload_url) {
      console.error(`[AssemblyAI] Invalid upload response:`, data);
      throw new Error('Invalid upload response - no upload URL received');
    }

    console.log(`[AssemblyAI] Upload successful, URL: ${data.upload_url}`);
    return data.upload_url;
  }

  private async startTranscription(audioUrl: string, options: AssemblyAIOptions): Promise<string> {
    console.log(`[AssemblyAI] Starting transcription with audio URL: ${audioUrl}`);
    
    // Convert language detection to AssemblyAI format if needed
    const transcriptionOptions: any = {
      audio_url: audioUrl,
      speaker_labels: options.speaker_labels || false,
      speakers_expected: options.speakers_expected,
      auto_chapters: options.auto_chapters || false,
      sentiment_analysis: options.sentiment_analysis || false,
      speech_model: options.speech_model || 'universal',
      disfluencies: options.disfluencies !== false,
    };

    // Handle language detection and code mapping
    if (options.language_detection) {
      transcriptionOptions.language_detection = true;
      console.log(`[AssemblyAI] Language detection enabled`);
    } else if (options.language_code) {
      const assemblyLanguageCode = languageDetectionService.getAssemblyAILanguageCode(options.language_code);
      if (assemblyLanguageCode) {
        transcriptionOptions.language_code = assemblyLanguageCode;
        console.log(`[AssemblyAI] Language code set to: ${assemblyLanguageCode}`);
      }
    }

    console.log(`[AssemblyAI] Transcription options:`, transcriptionOptions);
    console.log(`[AssemblyAI] Calling transcription edge function...`);

    const { data, error } = await supabase.functions.invoke('assemblyai-transcribe', {
      body: {
        action: 'transcribe',
        ...transcriptionOptions
      }
    });

    if (error) {
      console.error(`[AssemblyAI] Transcription request failed:`, error);
      throw new Error(`Transcription request failed: ${error.message}`);
    }

    if (!data || !data.id) {
      console.error(`[AssemblyAI] Invalid transcription response:`, data);
      throw new Error('Invalid transcription response - no transcript ID received');
    }

    console.log(`[AssemblyAI] Transcription request successful, ID: ${data.id}`);
    return data.id;
  }

  private async pollTranscription(transcriptId: string): Promise<AssemblyAITranscript> {
    console.log(`[AssemblyAI] Starting to poll transcription: ${transcriptId}`);
    const maxAttempts = 120; // 10 minutes with 5-second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      console.log(`[AssemblyAI] Polling attempt ${attempts + 1}/${maxAttempts} for transcript: ${transcriptId}`);
      
      const { data: transcript, error } = await supabase.functions.invoke('assemblyai-transcribe', {
        body: {
          action: 'poll',
          transcriptId
        }
      });

      if (error) {
        console.error(`[AssemblyAI] Polling error:`, error);
        throw new Error(`Failed to get transcription status: ${error.message}`);
      }

      if (!transcript) {
        console.error(`[AssemblyAI] No transcript data received`);
        throw new Error('No transcript data received');
      }

      console.log(`[AssemblyAI] Transcript status: ${transcript.status}`);

      if (transcript.status === 'completed') {
        console.log(`[AssemblyAI] Transcription completed successfully`);
        return transcript;
      } else if (transcript.status === 'error') {
        console.error(`[AssemblyAI] Transcription failed with error: ${transcript.error}`);
        throw new Error(`Transcription failed: ${transcript.error || 'Unknown error'}`);
      }

      // Update progress based on status
      const progress = transcript.status === 'processing' ? 
        Math.min(90, 50 + (attempts * 2)) : 50;
      
      this.updateProgress('processing', progress, `Transcription ${transcript.status}...`);

      // Wait before next poll
      console.log(`[AssemblyAI] Waiting 5 seconds before next poll...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    console.error(`[AssemblyAI] Transcription timed out after ${maxAttempts} attempts`);
    throw new Error('Transcription timed out');
  }

  private formatResults(transcript: AssemblyAITranscript, transcriptId: string, audioFile: File): AssemblyAIResult {
    console.log(`[AssemblyAI] Formatting results for transcript: ${transcriptId}`);
    
    const text = transcript.text || '';
    const speakerUtterances: SpeakerUtterance[] = [];

    if (transcript.utterances) {
      console.log(`[AssemblyAI] Processing ${transcript.utterances.length} utterances`);
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

    // Estimate token usage for AssemblyAI (based on audio length)
    const audioLengthMinutes = audioFile.size / (1024 * 1024) * 0.5; // Rough estimate
    const estimatedCost = audioLengthMinutes * 0.00065; // AssemblyAI pricing per minute

    console.log(`[AssemblyAI] Results formatted:`, {
      textLength: text.length,
      speakerUtteranceCount: speakerUtterances.length,
      estimatedAudioLength: audioLengthMinutes,
      estimatedCost
    });

    return { 
      text, 
      speakerUtterances,
      transcriptId,
      deletionStatus: 'pending',
      tokenEstimation: {
        audioLengthMinutes,
        estimatedCost
      }
    };
  }
}

export const assemblyAIService = new AssemblyAIService();
