
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
  }

  private updateProgress(stage: UnifiedTranscriptionProgress['stage'], progress: number, message: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message });
    }
  }

  validateApiKey(): boolean {
    // API key validation is now handled by the edge function
    return true;
  }

  async transcribe(audioFile: File, options: AssemblyAIOptions): Promise<AssemblyAIResult> {
    console.log(`[AssemblyAI] Starting transcription process...`);
    console.log(`[AssemblyAI] Original file - Name: ${audioFile.name}, Type: ${audioFile.type}, Size: ${audioFile.size} bytes`);

    // Validate and fix audio file MIME type
    if (!isValidAudioFile(audioFile)) {
      console.error(`[AssemblyAI] Invalid audio file: ${audioFile.name} with type: ${audioFile.type}`);
      throw new Error(`Unsupported audio file format: ${audioFile.name}. Please use supported formats: MP3, WAV, M4A, FLAC, OGG, AAC, WEBM, 3GP, AMR, WMA`);
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
    
    console.log(`[AssemblyAI] File to upload - Name: ${fileToUpload.name}, Type: ${fileToUpload.type}, Size: ${fileToUpload.size} bytes`);

    this.updateProgress('uploading', 10, 'Uploading audio to AssemblyAI...');

    try {
      // Upload audio file
      const uploadUrl = await this.uploadAudio(fileToUpload);
      
      this.updateProgress('queued', 30, 'Audio uploaded, starting transcription...');

      // Start transcription
      const transcriptId = await this.startTranscription(uploadUrl, options);
      
      this.updateProgress('processing', 50, 'Transcription in progress...');

      // Poll for completion
      const transcript = await this.pollTranscription(transcriptId);

      this.updateProgress('complete', 100, 'Transcription completed');

      return this.formatResults(transcript, transcriptId, fileToUpload);
    } catch (error) {
      console.error(`[AssemblyAI] Transcription error:`, error);
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

    // Convert file to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

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

    console.log(`[AssemblyAI] Upload successful, URL: ${data.upload_url}`);
    return data.upload_url;
  }

  private async startTranscription(audioUrl: string, options: AssemblyAIOptions): Promise<string> {
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
    } else if (options.language_code) {
      const assemblyLanguageCode = languageDetectionService.getAssemblyAILanguageCode(options.language_code);
      if (assemblyLanguageCode) {
        transcriptionOptions.language_code = assemblyLanguageCode;
      }
    }

    const { data, error } = await supabase.functions.invoke('assemblyai-transcribe', {
      body: {
        action: 'transcribe',
        ...transcriptionOptions
      }
    });

    if (error) {
      throw new Error(`Transcription request failed: ${error.message}`);
    }

    return data.id;
  }

  private async pollTranscription(transcriptId: string): Promise<AssemblyAITranscript> {
    const maxAttempts = 120; // 10 minutes with 5-second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      const { data: transcript, error } = await supabase.functions.invoke('assemblyai-transcribe', {
        body: {
          action: 'poll',
          transcriptId
        }
      });

      if (error) {
        throw new Error(`Failed to get transcription status: ${error.message}`);
      }

      if (transcript.status === 'completed') {
        return transcript;
      } else if (transcript.status === 'error') {
        throw new Error(`Transcription failed: ${transcript.error || 'Unknown error'}`);
      }

      // Update progress based on status
      const progress = transcript.status === 'processing' ? 
        Math.min(90, 50 + (attempts * 2)) : 50;
      
      this.updateProgress('processing', progress, `Transcription ${transcript.status}...`);

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error('Transcription timed out');
  }

  private formatResults(transcript: AssemblyAITranscript, transcriptId: string, audioFile: File): AssemblyAIResult {
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

    // Estimate token usage for AssemblyAI (based on audio length)
    const audioLengthMinutes = audioFile.size / (1024 * 1024) * 0.5; // Rough estimate
    const estimatedCost = audioLengthMinutes * 0.00065; // AssemblyAI pricing per minute

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
