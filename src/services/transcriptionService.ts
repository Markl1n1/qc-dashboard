
import { AssemblyAIConfig, UnifiedTranscriptionProgress } from '../types';

export interface TranscriptionOptions {
  model?: string;
  language?: string;
  speakerLabels?: boolean;
}

class TranscriptionService {
  private progressCallback: ((progress: UnifiedTranscriptionProgress) => void) | null = null;
  private modelLoaded = false;
  private currentModel: string | null = null;

  setProgressCallback(callback: (progress: UnifiedTranscriptionProgress) => void) {
    this.progressCallback = callback;
    console.log('[TranscriptionService] Progress callback set');
  }

  private updateProgress(stage: UnifiedTranscriptionProgress['stage'], progress: number, message: string) {
    console.log(`[TranscriptionService] Progress: ${stage} (${progress}%) - ${message}`);
    if (this.progressCallback) {
      try {
        this.progressCallback({ stage, progress, message });
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    }
  }

  async transcribeAudio(
    file: File, 
    assignedAgent: string, 
    assignedSupervisor: string,
    config?: AssemblyAIConfig
  ): Promise<string> {
    console.log('[TranscriptionService] transcribeAudio called with:', {
      fileName: file.name,
      fileSize: file.size,
      assignedAgent,
      assignedSupervisor,
      config
    });

    try {
      if (!file) {
        throw new Error('No file provided');
      }

      if (file.size > 100 * 1024 * 1024) {
        throw new Error('File size exceeds 100MB limit');
      }

      this.updateProgress('uploading', 10, 'Starting transcription...');
      
      // Ensure user is authenticated
      console.log('[TranscriptionService] Checking authentication...');
      const { supabase } = await import('../integrations/supabase/client');
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        console.error('[TranscriptionService] Authentication error:', authError);
        throw new Error(`Authentication failed: ${authError.message}`);
      }
      
      if (!session) {
        console.error('[TranscriptionService] No active session found');
        throw new Error('Please log in to use transcription services');
      }
      
      console.log('[TranscriptionService] Authentication verified, user:', session.user.email);
      
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('assignedAgent', assignedAgent);
      formData.append('assignedSupervisor', assignedSupervisor);
      
      if (config) {
        formData.append('config', JSON.stringify(config));
      }

      this.updateProgress('processing', 30, 'Processing audio file...');

      console.log('[TranscriptionService] Making request to process-dialog endpoint...');
      
      const response = await fetch('https://sahudeguwojdypmmlbkd.supabase.co/functions/v1/process-dialog', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      console.log('[TranscriptionService] Response status:', response.status);

      if (!response.ok) {
        const responseText = await response.text();
        console.error('[TranscriptionService] Error response body:', responseText);
        
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { message: responseText || `Transcription failed: ${response.statusText}` };
        }
        
        console.error('[TranscriptionService] Transcription request failed:', errorData);
        throw new Error(errorData.message || `Transcription failed: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('[TranscriptionService] Success response:', responseData);
      
      const { dialogId } = responseData;
      console.log('[TranscriptionService] Transcription request successful, dialogId:', dialogId);
      
      this.updateProgress('complete', 100, 'Transcription completed successfully');
      
      return dialogId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      console.error('[TranscriptionService] Transcription error:', errorMessage);
      
      this.updateProgress('error', 0, errorMessage);
      throw error;
    }
  }

  async processTranscription(dialogId: string): Promise<void> {
    console.log('[TranscriptionService] processTranscription called with dialogId:', dialogId);
    
    try {
      const { supabase } = await import('../integrations/supabase/client');
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session) {
        throw new Error('Authentication required for transcription processing');
      }
      
      console.log('[TranscriptionService] Making process transcription request...');
      const response = await fetch(`https://sahudeguwojdypmmlbkd.supabase.co/functions/v1/process-transcription/${dialogId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      console.log('[TranscriptionService] Process response status:', response.status);

      if (!response.ok) {
        const responseText = await response.text();
        console.error('[TranscriptionService] Process error response:', responseText);
        throw new Error(`Transcription processing failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[TranscriptionService] Transcription processed successfully:', data);
    } catch (error) {
      console.error('[TranscriptionService] Error processing transcription:', error);
      throw error;
    }
  }

  async estimateTokenCost(file: File): Promise<{ audioLengthMinutes: number; estimatedCost: number }> {
    console.log('[TranscriptionService] estimateTokenCost called with file:', file.name);
    
    try {
      const { supabase } = await import('../integrations/supabase/client');
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session) {
        throw new Error('Authentication required for cost estimation');
      }
      
      const formData = new FormData();
      formData.append('audio', file);

      console.log('[TranscriptionService] Making token cost estimation request...');
      const response = await fetch('https://sahudeguwojdypmmlbkd.supabase.co/functions/v1/estimate-token-cost', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      console.log('[TranscriptionService] Estimation response status:', response.status);

      if (!response.ok) {
        const responseText = await response.text();
        console.error('[TranscriptionService] Estimation error response:', responseText);
        throw new Error(`Token estimation failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[TranscriptionService] Token estimation result:', result);
      return result;
    } catch (error) {
      console.error('[TranscriptionService] Error estimating token cost:', error);
      throw error;
    }
  }

  async loadModel(options: TranscriptionOptions): Promise<void> {
    console.log('[TranscriptionService] Loading model with options:', options);
    this.updateProgress('queued', 50, 'Loading transcription model...');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.currentModel = options.model || 'default';
    this.modelLoaded = true;
    console.log('[TranscriptionService] Model loaded:', this.currentModel);
    this.updateProgress('complete', 100, 'Model loaded successfully');
  }

  isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  getCurrentModel(): string | null {
    return this.currentModel;
  }

  getModelInfo(modelName: string) {
    return { name: modelName, size: 'unknown' };
  }

  getAllModelInfo() {
    return [{ name: 'default', size: 'small' }];
  }
}

export const transcriptionService = new TranscriptionService();
