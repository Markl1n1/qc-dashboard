
import { SpeakerUtterance, UnifiedTranscriptionProgress } from '../types';
import { languageDetectionService } from './languageDetectionService';
import { createFileWithCorrectMimeType, isValidAudioFile } from '../utils/audioFileUtils';

export interface AssemblyAIOptions {
  apiKey: string;
  speaker_labels?: boolean;
  speakers_expected?: number;
  auto_chapters?: boolean;
  sentiment_analysis?: boolean;
  language_code?: string;
  language_detection?: boolean;
  speech_model?: 'universal' | 'nano';
  disfluencies?: boolean; // NEW: Add support for capturing "um", "ah", etc.
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

  validateApiKey(apiKey: string): boolean {
    return typeof apiKey === 'string' && apiKey.length > 0;
  }

  async transcribe(audioFile: File, options: AssemblyAIOptions): Promise<AssemblyAIResult> {
    if (!this.validateApiKey(options.apiKey)) {
      throw new Error('Invalid AssemblyAI API key');
    }

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
      // Ensure converted WAV files have the correct MIME type
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
      // Upload audio file with corrected MIME type
      const uploadUrl = await this.uploadAudio(fileToUpload, options.apiKey);
      
      this.updateProgress('queued', 30, 'Audio uploaded, starting transcription...');

      // Start transcription
      const transcriptId = await this.startTranscription(uploadUrl, options);
      
      this.updateProgress('processing', 50, 'Transcription in progress...');

      // Poll for completion
      const transcript = await this.pollTranscription(transcriptId, options.apiKey);

      this.updateProgress('complete', 100, 'Transcription completed');

      return this.formatResults(transcript, transcriptId);
    } catch (error) {
      console.error(`[AssemblyAI] Transcription error:`, error);
      this.updateProgress('error', 0, `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async uploadAudio(audioFile: File, apiKey: string): Promise<string> {
    console.log(`[AssemblyAI] Preparing file upload...`);
    console.log(`[AssemblyAI] File details - Name: ${audioFile.name}, Type: ${audioFile.type}, Size: ${audioFile.size} bytes`);
    
    // Validate file before upload
    if (audioFile.size === 0) {
      throw new Error('Audio file is empty');
    }
    
    if (audioFile.size > 500 * 1024 * 1024) { // 500MB limit
      throw new Error('Audio file is too large (max 500MB)');
    }

    // Additional validation for converted files
    if (audioFile.name.includes('_converted.wav')) {
      // Check if it's a valid WAV file by examining the first few bytes
      const header = await audioFile.slice(0, 12).arrayBuffer();
      const view = new DataView(header);
      const riffHeader = String.fromCharCode(
        view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)
      );
      const waveHeader = String.fromCharCode(
        view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)
      );
      
      if (riffHeader !== 'RIFF' || waveHeader !== 'WAVE') {
        console.error(`[AssemblyAI] Invalid WAV file structure in converted file`);
        throw new Error('Converted audio file has invalid WAV structure');
      }
      
      console.log(`[AssemblyAI] Validated converted WAV file structure`);
    }

    const formData = new FormData();
    
    // Append the file with explicit MIME type - this is crucial for AssemblyAI
    formData.append('file', audioFile, audioFile.name);
    
    console.log(`[AssemblyAI] Uploading file with FormData...`);
    console.log(`[AssemblyAI] File in FormData - Name: ${audioFile.name}, Type: ${audioFile.type}`);

    const response = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        // Don't set Content-Type header - let the browser set it with boundary for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AssemblyAI] Upload failed: ${response.status} ${response.statusText}`);
      console.error(`[AssemblyAI] Error response:`, errorText);
      
      // Provide more specific error messages
      if (response.status === 400) {
        throw new Error(`Upload failed: Invalid file format. AssemblyAI returned: ${errorText}`);
      } else if (response.status === 401) {
        throw new Error(`Upload failed: Invalid API key. Please check your AssemblyAI API key.`);
      } else {
        throw new Error(`Upload failed: ${response.statusText}. ${errorText}`);
      }
    }

    const data = await response.json();
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
      disfluencies: options.disfluencies !== false, // Enable by default
    };

    // Handle language detection and code mapping
    if (options.language_detection) {
      transcriptionOptions.language_detection = true;
    } else if (options.language_code) {
      // Convert our language codes to AssemblyAI format
      const assemblyLanguageCode = languageDetectionService.getAssemblyAILanguageCode(options.language_code);
      if (assemblyLanguageCode) {
        transcriptionOptions.language_code = assemblyLanguageCode;
      }
    }

    const response = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': options.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transcriptionOptions),
    });

    if (!response.ok) {
      throw new Error(`Transcription request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  private async pollTranscription(transcriptId: string, apiKey: string): Promise<AssemblyAITranscript> {
    const maxAttempts = 120; // 10 minutes with 5-second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get transcription status: ${response.statusText}`);
      }

      const transcript: AssemblyAITranscript = await response.json();

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

  private formatResults(transcript: AssemblyAITranscript, transcriptId: string): AssemblyAIResult {
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

    return { 
      text, 
      speakerUtterances,
      transcriptId,
      deletionStatus: 'pending' // Default status
    };
  }
}

export const assemblyAIService = new AssemblyAIService();
