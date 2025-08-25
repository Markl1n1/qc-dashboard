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
  private isProcessing = false;
  private errorCount = 0;
  private readonly maxErrors = 3;

  constructor() {
    // Force console logging to be visible
    console.warn('🔧 AssemblyAI Service initialized - Console logging active');
    console.warn('🔧 If you see this message, console logging is working properly');
  }

  setProgressCallback(callback: (progress: UnifiedTranscriptionProgress) => void) {
    this.progressCallback = callback;
    console.warn('🔧 [AssemblyAI] Progress callback set successfully');
  }

  private updateProgress(stage: UnifiedTranscriptionProgress['stage'], progress: number, message: string) {
    console.warn(`🔧 [AssemblyAI] PROGRESS UPDATE: ${stage} (${progress}%) - ${message}`);
    if (this.progressCallback) {
      try {
        this.progressCallback({ stage, progress, message });
        console.warn('🔧 [AssemblyAI] Progress callback executed successfully');
      } catch (error) {
        console.error('❌ [AssemblyAI] CRITICAL ERROR in progress callback:', error);
        console.error('❌ [AssemblyAI] Progress callback error stack:', error instanceof Error ? error.stack : 'No stack trace');
      }
    } else {
      console.warn('⚠️ [AssemblyAI] No progress callback set - progress not reported to UI');
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    console.warn('🔧 [AssemblyAI] AUTHENTICATION CHECK STARTED');
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ [AssemblyAI] Authentication error:', error);
        throw new Error(`Authentication failed: ${error.message}`);
      }
      
      if (!session) {
        console.error('❌ [AssemblyAI] No active session found');
        throw new Error('Please log in to use transcription services');
      }
      
      console.warn('✅ [AssemblyAI] Authentication verified for user:', session.user.email);
    } catch (authError) {
      console.error('❌ [AssemblyAI] CRITICAL AUTH ERROR:', authError);
      throw authError;
    }
  }

  validateApiKey(): boolean {
    console.warn('🔧 [AssemblyAI] API key validation delegated to edge function');
    return true;
  }

  async transcribe(audioFile: File, options: AssemblyAIOptions): Promise<AssemblyAIResult> {
    console.warn('🚀 [AssemblyAI] TRANSCRIPTION PROCESS STARTED');
    console.warn('🚀 [AssemblyAI] Current processing state:', this.isProcessing);
    console.warn('🚀 [AssemblyAI] Current error count:', this.errorCount);
    
    // Circuit breaker pattern with detailed logging
    if (this.isProcessing) {
      console.error('❌ [AssemblyAI] BLOCKED: Another transcription is already in progress');
      throw new Error('Another transcription is already in progress. Please wait.');
    }

    if (this.errorCount >= this.maxErrors) {
      console.error('❌ [AssemblyAI] BLOCKED: Too many failed attempts:', this.errorCount);
      throw new Error('Too many failed attempts. Please refresh the page and try again.');
    }

    this.isProcessing = true;
    console.warn('🔧 [AssemblyAI] Processing flag set to TRUE');

    try {
      console.warn('🔧 [AssemblyAI] File details:', {
        name: audioFile.name,
        type: audioFile.type,
        size: audioFile.size,
        lastModified: new Date(audioFile.lastModified).toISOString()
      });
      console.warn('🔧 [AssemblyAI] Options:', options);

      // Step 1: Ensure user is authenticated
      console.warn('🔧 [AssemblyAI] STEP 1: Authentication check');
      await this.ensureAuthenticated();
      
      // Step 2: Validate file
      console.warn('🔧 [AssemblyAI] STEP 2: File validation');
      if (!isValidAudioFile(audioFile)) {
        const error = `Unsupported audio file format: ${audioFile.name} with type: ${audioFile.type}`;
        console.error('❌ [AssemblyAI] File validation failed:', error);
        throw new Error(error);
      }

      // Step 3: Prepare file for upload
      console.warn('🔧 [AssemblyAI] STEP 3: File preparation');
      let fileToUpload = createFileWithCorrectMimeType(audioFile);
      console.warn('🔧 [AssemblyAI] Final file prepared:', {
        name: fileToUpload.name,
        type: fileToUpload.type,
        size: fileToUpload.size
      });

      this.updateProgress('uploading', 10, 'Uploading audio to AssemblyAI...');

      // Step 4: Upload audio file
      console.warn('🔧 [AssemblyAI] STEP 4: File upload');
      const uploadUrl = await this.uploadAudio(fileToUpload);
      console.warn('✅ [AssemblyAI] Upload completed, URL received:', uploadUrl);
      
      this.updateProgress('queued', 30, 'Audio uploaded, starting transcription...');

      // Step 5: Start transcription
      console.warn('🔧 [AssemblyAI] STEP 5: Starting transcription');
      const transcriptId = await this.startTranscription(uploadUrl, options);
      console.warn('✅ [AssemblyAI] Transcription started with ID:', transcriptId);
      
      this.updateProgress('processing', 50, 'Transcription in progress...');

      // Step 6: Poll for completion
      console.warn('🔧 [AssemblyAI] STEP 6: Polling for completion');
      const transcript = await this.pollTranscription(transcriptId);
      console.warn('✅ [AssemblyAI] Transcription completed:', {
        id: transcript.id,
        status: transcript.status,
        textLength: transcript.text?.length || 0,
        utteranceCount: transcript.utterances?.length || 0
      });

      this.updateProgress('complete', 100, 'Transcription completed');

      const result = this.formatResults(transcript, transcriptId, fileToUpload);
      console.warn('✅ [AssemblyAI] Final result formatted:', {
        textLength: result.text.length,
        utteranceCount: result.speakerUtterances.length,
        transcriptId: result.transcriptId
      });

      // Reset error count on success
      this.errorCount = 0;
      console.warn('🔧 [AssemblyAI] Error count reset to 0');
      
      return result;
    } catch (error) {
      this.errorCount++;
      console.error('❌ [AssemblyAI] TRANSCRIPTION FAILED (attempt', this.errorCount, '):', error);
      console.error('❌ [AssemblyAI] Error stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      
      let errorMessage = 'Transcription failed';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      console.error('❌ [AssemblyAI] Final error message:', errorMessage);
      
      this.updateProgress('error', 0, errorMessage);
      throw new Error(errorMessage);
    } finally {
      this.isProcessing = false;
      console.warn('🔧 [AssemblyAI] Processing flag set to FALSE');
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

    console.log(`[AssemblyAI] Converting file to base64 in chunks...`);
    
    try {
      // Convert file to base64 in chunks to prevent memory issues
      const arrayBuffer = await audioFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Process in 1MB chunks to prevent memory issues
      const chunkSize = 1024 * 1024; // 1MB chunks
      const chunks: string[] = [];
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        const chunkString = String.fromCharCode(...chunk);
        chunks.push(btoa(chunkString));
      }
      
      const base64 = chunks.join('');
      console.log(`[AssemblyAI] Base64 conversion completed, total length: ${base64.length}`);

      console.log(`[AssemblyAI] Calling upload edge function...`);
      
      // Get current session for auth headers
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found');
      }

      const { data, error } = await supabase.functions.invoke('assemblyai-transcribe', {
        body: {
          action: 'upload',
          audioData: base64,
          fileName: audioFile.name
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (error) {
        console.error(`[AssemblyAI] Upload edge function error:`, error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      if (!data || !data.upload_url) {
        console.error(`[AssemblyAI] Invalid upload response:`, data);
        throw new Error('Invalid upload response - no upload URL received');
      }

      console.log(`[AssemblyAI] Upload successful, URL: ${data.upload_url}`);
      return data.upload_url;
      
    } catch (error) {
      console.error('[AssemblyAI] Upload error details:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error('Network connection failed. Please check your internet connection and try again.');
        } else if (error.message.includes('timeout')) {
          throw new Error('Upload timeout. The file may be too large. Please try a smaller file.');
        }
      }
      
      throw error;
    }
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

    try {
      // Get current session for auth headers
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found');
      }

      console.log(`[AssemblyAI] Calling transcription edge function...`);

      const { data, error } = await supabase.functions.invoke('assemblyai-transcribe', {
        body: {
          action: 'transcribe',
          ...transcriptionOptions
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
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
      
    } catch (error) {
      console.error('[AssemblyAI] Start transcription error:', error);
      throw error;
    }
  }

  private async pollTranscription(transcriptId: string): Promise<AssemblyAITranscript> {
    console.log(`[AssemblyAI] Starting to poll transcription: ${transcriptId}`);
    const maxAttempts = 120; // 10 minutes with 5-second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      console.log(`[AssemblyAI] Polling attempt ${attempts + 1}/${maxAttempts} for transcript: ${transcriptId}`);
      
      try {
        // Get current session for auth headers
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No active session found');
        }

        const { data: transcript, error } = await supabase.functions.invoke('assemblyai-transcribe', {
          body: {
            action: 'poll',
            transcriptId
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
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
        
      } catch (error) {
        console.error(`[AssemblyAI] Poll attempt ${attempts + 1} failed:`, error);
        
        // If we're near the end of attempts, throw the error
        if (attempts >= maxAttempts - 1) {
          throw error;
        }
        
        // Otherwise, wait and try again
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
    }

    console.error(`[AssemblyAI] Transcription timed out after ${maxAttempts} attempts`);
    throw new Error('Transcription timed out. Please try again with a shorter audio file.');
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
