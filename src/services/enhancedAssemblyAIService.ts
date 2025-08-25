
import { SpeakerUtterance, UnifiedTranscriptionProgress } from '../types';
import { AssemblyAIEnhancedOptions, AssemblyAITranscriptResponse, AssemblyAIRegion } from '../types/assemblyai';
import { AssemblyAIRegionService } from './assemblyaiRegionService';
import { AssemblyAIKeyManager } from './assemblyaiKeyManager';
import { supabase } from '../integrations/supabase/client';
import { createFileWithCorrectMimeType, isValidAudioFile } from '../utils/audioFileUtils';

export interface EnhancedAssemblyAIResult {
  text: string;
  speakerUtterances: SpeakerUtterance[];
  transcriptId: string;
  languageDetected?: {
    code: string;
    confidence: number;
  };
  contentSafety?: any;
  entities?: any[];
  sentiment?: any[];
  chapters?: any[];
  summary?: string;
  piiRedactedUrl?: string;
}

class EnhancedAssemblyAIService {
  private progressCallback?: (progress: UnifiedTranscriptionProgress) => void;
  private isProcessing = false;
  private currentRegion: AssemblyAIRegion;

  constructor() {
    this.currentRegion = AssemblyAIRegionService.getUserRegionPreference();
    console.log('Enhanced AssemblyAI Service initialized with region:', this.currentRegion);
  }

  setProgressCallback(callback: (progress: UnifiedTranscriptionProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: UnifiedTranscriptionProgress['stage'], progress: number, message: string) {
    console.log(`[Enhanced AssemblyAI] ${stage} (${progress}%): ${message}`);
    if (this.progressCallback) {
      try {
        this.progressCallback({ stage, progress, message });
      } catch (error) {
        console.error('Progress callback error:', error);
      }
    }
  }

  setRegion(region: AssemblyAIRegion) {
    this.currentRegion = region;
    AssemblyAIRegionService.setUserRegionPreference(region);
    console.log(`AssemblyAI region updated to: ${region}`);
  }

  getRegion(): AssemblyAIRegion {
    return this.currentRegion;
  }

  async transcribe(audioFile: File, options: AssemblyAIEnhancedOptions): Promise<EnhancedAssemblyAIResult> {
    console.log('Enhanced transcription started', { 
      fileName: audioFile.name,
      region: this.currentRegion,
      options 
    });

    if (this.isProcessing) {
      throw new Error('Another transcription is already in progress');
    }

    this.isProcessing = true;

    try {
      // Step 1: Authentication check
      await this.ensureAuthenticated();
      
      // Step 2: File validation
      if (!isValidAudioFile(audioFile)) {
        throw new Error(`Unsupported audio file format: ${audioFile.type}`);
      }

      // Step 3: Get API key for region
      const apiKeyObj = AssemblyAIKeyManager.getActiveKey(this.currentRegion);
      if (!apiKeyObj) {
        // Fallback to other region if available
        const fallbackRegion = this.currentRegion === 'us' ? 'eu' : 'us';
        const fallbackKey = AssemblyAIKeyManager.getActiveKey(fallbackRegion);
        
        if (fallbackKey) {
          console.log(`Falling back to ${fallbackRegion} region`);
          this.currentRegion = fallbackRegion;
        } else {
          throw new Error('No available API keys. Please add an AssemblyAI API key.');
        }
      }

      this.updateProgress('uploading', 10, 'Preparing file for upload...');
      
      // Step 4: Prepare file
      const fileToUpload = createFileWithCorrectMimeType(audioFile);
      
      // Step 5: Upload with regional support
      const uploadUrl = await this.uploadAudio(fileToUpload);
      
      this.updateProgress('queued', 30, 'Starting enhanced transcription...');
      
      // Step 6: Start transcription with enhanced options
      const transcriptId = await this.startTranscription(uploadUrl, options);
      
      this.updateProgress('processing', 50, 'Processing with advanced features...');
      
      // Step 7: Poll for completion
      const transcript = await this.pollTranscription(transcriptId);
      
      this.updateProgress('complete', 100, 'Enhanced transcription completed');
      
      // Mark API key as used
      if (apiKeyObj) {
        AssemblyAIKeyManager.markKeyUsed(apiKeyObj.id);
      }

      return this.formatEnhancedResults(transcript, transcriptId);

    } catch (error) {
      console.error('Enhanced transcription error:', error);
      
      // Handle quota errors
      const apiKeyObj = AssemblyAIKeyManager.getActiveKey(this.currentRegion);
      if (apiKeyObj && error instanceof Error) {
        const isQuotaError = error.message.includes('quota') || 
                           error.message.includes('limit') ||
                           error.message.includes('billing');
        
        AssemblyAIKeyManager.markKeyError(apiKeyObj.id, isQuotaError);
      }

      this.updateProgress('error', 0, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      throw new Error('Authentication required');
    }
  }

  private async uploadAudio(audioFile: File): Promise<string> {
    console.log('Uploading to region:', this.currentRegion);
    
    // Convert to base64 in chunks
    const arrayBuffer = await audioFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const chunkSize = 1024 * 1024; // 1MB chunks
    const chunks: string[] = [];
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      const chunkString = String.fromCharCode(...chunk);
      chunks.push(btoa(chunkString));
    }
    
    const base64 = chunks.join('');
    console.log(`Base64 conversion completed, length: ${base64.length}`);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const { data, error } = await supabase.functions.invoke('assemblyai-transcribe', {
      body: {
        action: 'upload',
        audioData: base64,
        fileName: audioFile.name,
        region: this.currentRegion
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    if (!data?.upload_url) {
      throw new Error('Invalid upload response');
    }

    return data.upload_url;
  }

  private async startTranscription(audioUrl: string, options: AssemblyAIEnhancedOptions): Promise<string> {
    console.log('Starting enhanced transcription with options:', options);
    
    // Build comprehensive transcription request
    const transcriptionRequest: any = {
      audio_url: audioUrl,
      speech_model: options.speech_model || 'universal-2',
      
      // Speaker diarization
      speaker_labels: options.speaker_labels || false,
      speakers_expected: options.speakers_expected,
      
      // Language detection
      language_detection: options.language_detection !== false,
      language_code: options.language_code,
      
      // Content analysis
      content_safety_labels: options.content_safety_labels || false,
      pii_policy: options.pii_policy,
      entity_detection: options.entity_detection || false,
      sentiment_analysis: options.sentiment_analysis || false,
      auto_chapters: options.auto_chapters || false,
      summarization: options.summarization || false,
      
      // Audio processing
      filter_profanity: options.filter_profanity || false,
      dual_channel: options.dual_channel || false,
      disfluencies: options.disfluencies !== false,
      
      // Custom settings
      boost_param: options.boost_param,
      custom_spelling: options.custom_spelling,
      
      // Data retention
      delete_after_seconds: options.delete_after_seconds
    };

    // Remove undefined values
    Object.keys(transcriptionRequest).forEach(key => {
      if (transcriptionRequest[key] === undefined) {
        delete transcriptionRequest[key];
      }
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const { data, error } = await supabase.functions.invoke('assemblyai-transcribe', {
      body: {
        action: 'transcribe',
        region: this.currentRegion,
        ...transcriptionRequest
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (error) {
      throw new Error(`Transcription request failed: ${error.message}`);
    }

    if (!data?.id) {
      throw new Error('Invalid transcription response');
    }

    return data.id;
  }

  private async pollTranscription(transcriptId: string): Promise<AssemblyAITranscriptResponse> {
    console.log(`Polling enhanced transcript: ${transcriptId}`);
    const maxAttempts = 120; // 10 minutes
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No active session');
        }

        const { data: transcript, error } = await supabase.functions.invoke('assemblyai-transcribe', {
          body: {
            action: 'poll',
            transcriptId,
            region: this.currentRegion
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (error) {
          throw new Error(`Polling failed: ${error.message}`);
        }

        console.log(`Poll attempt ${attempts + 1}: ${transcript.status}`);

        if (transcript.status === 'completed') {
          return transcript;
        } else if (transcript.status === 'error') {
          throw new Error(`Transcription failed: ${transcript.error || 'Unknown error'}`);
        }

        const progress = Math.min(90, 50 + (attempts * 2));
        this.updateProgress('processing', progress, `Processing... (${transcript.status})`);

        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
        
      } catch (error) {
        console.error(`Poll attempt ${attempts + 1} failed:`, error);
        
        if (attempts >= maxAttempts - 1) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
    }

    throw new Error('Transcription timed out');
  }

  private formatEnhancedResults(transcript: AssemblyAITranscriptResponse, transcriptId: string): EnhancedAssemblyAIResult {
    console.log('Formatting enhanced results');
    
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

    const result: EnhancedAssemblyAIResult = {
      text,
      speakerUtterances,
      transcriptId
    };

    // Add enhanced features if present
    if (transcript.language_code && transcript.language_confidence) {
      result.languageDetected = {
        code: transcript.language_code,
        confidence: transcript.language_confidence
      };
    }

    if (transcript.content_safety_labels) {
      result.contentSafety = transcript.content_safety_labels;
    }

    if (transcript.entities) {
      result.entities = transcript.entities;
    }

    if (transcript.sentiment_analysis_results) {
      result.sentiment = transcript.sentiment_analysis_results;
    }

    if (transcript.chapters) {
      result.chapters = transcript.chapters;
    }

    if (transcript.summary) {
      result.summary = transcript.summary;
    }

    if (transcript.pii_redacted_audio_url) {
      result.piiRedactedUrl = transcript.pii_redacted_audio_url;
    }

    console.log('Enhanced results formatted:', {
      textLength: result.text.length,
      utteranceCount: result.speakerUtterances.length,
      hasLanguageDetection: !!result.languageDetected,
      hasContentSafety: !!result.contentSafety,
      hasEntities: !!result.entities?.length,
      hasSentiment: !!result.sentiment?.length,
      hasChapters: !!result.chapters?.length,
      hasSummary: !!result.summary
    });

    return result;
  }
}

export const enhancedAssemblyAIService = new EnhancedAssemblyAIService();
