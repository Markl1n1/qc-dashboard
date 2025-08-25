
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
  }

  private updateProgress(stage: UnifiedTranscriptionProgress['stage'], progress: number, message: string) {
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
    try {
      if (!file) {
        throw new Error('No file provided');
      }

      if (file.size > 100 * 1024 * 1024) {
        throw new Error('File size exceeds 100MB limit');
      }

      this.updateProgress('uploading', 10, 'Starting transcription...');
      
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('assignedAgent', assignedAgent);
      formData.append('assignedSupervisor', assignedSupervisor);
      
      if (config) {
        formData.append('config', JSON.stringify(config));
      }

      this.updateProgress('processing', 30, 'Processing audio file...');

      const response = await fetch('https://sahudeguwojdypmmlbkd.supabase.co/functions/v1/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Transcription failed: ${response.statusText}`);
      }

      const { dialogId } = await response.json();
      
      this.updateProgress('complete', 100, 'Transcription completed successfully');
      
      return dialogId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      this.updateProgress('error', 0, errorMessage);
      throw error;
    }
  }

  async processTranscription(dialogId: string): Promise<void> {
    try {
      const response = await fetch(`https://sahudeguwojdypmmlbkd.supabase.co/functions/v1/process-transcription/${dialogId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Transcription processing failed: ${response.statusText}`);
      }
  
      const data = await response.json();
      console.log('Transcription processed:', data);
    } catch (error) {
      console.error('Error processing transcription:', error);
      throw error;
    }
  }

  async estimateTokenCost(file: File): Promise<{ audioLengthMinutes: number; estimatedCost: number }> {
    try {
      const formData = new FormData();
      formData.append('audio', file);
  
      const response = await fetch('https://sahudeguwojdypmmlbkd.supabase.co/functions/v1/estimate-token-cost', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Token estimation failed: ${response.statusText}`);
      }
  
      return await response.json();
    } catch (error) {
      console.error('Error estimating token cost:', error);
      throw error;
    }
  }

  // Mock methods for compatibility with useTranscription hook
  async transcribe(file: File, options: TranscriptionOptions): Promise<string> {
    // This would be a local transcription method - currently not implemented
    throw new Error('Local transcription not implemented');
  }

  async loadModel(options: TranscriptionOptions): Promise<void> {
    this.updateProgress('queued', 50, 'Loading transcription model...');
    this.currentModel = options.model || 'default';
    this.modelLoaded = true;
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
