import { AssemblyAIConfig, UnifiedTranscriptionProgress } from '../types';
import { useDialogStore } from '../store/dialogStore';
import { v4 as uuidv4 } from 'uuid';

class TranscriptionService {
  private progressCallback: ((progress: UnifiedTranscriptionProgress) => void) | null = null;

  setProgressCallback(callback: (progress: UnifiedTranscriptionProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: UnifiedTranscriptionProgress['stage'], progress: number, message: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message });
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

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Transcription failed: ${response.statusText}`);
      }

      const { dialogId } = await response.json();
      const store = useDialogStore.getState();
      const fileName = file.name;
      const uploadDate = new Date().toISOString();
      const newDialog = {
        id: dialogId,
        fileName: fileName,
        status: 'processing',
        assignedAgent: assignedAgent,
        assignedSupervisor: assignedSupervisor,
        uploadDate: uploadDate,
      };
      store.addDialog(newDialog);

      this.updateProgress('complete', 100, 'Transcription completed successfully');
      
      return dialogId;
    } catch (error) {
      this.updateProgress('error', 0, error instanceof Error ? error.message : 'Transcription failed');
      throw error;
    }
  }

  async processTranscription(dialogId: string): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/process-transcription/${dialogId}`, {
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
      const store = useDialogStore.getState();
  
      store.updateDialog(dialogId, {
        transcription: data.transcription,
        speakerTranscription: data.speaker_utterances,
        status: 'completed',
        error: data.error,
      });
    } catch (error) {
      const store = useDialogStore.getState();
      store.updateDialog(dialogId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Transcription processing failed',
      });
      console.error('Error processing transcription:', error);
    }
  }

  async estimateTokenCost(file: File): Promise<{ audioLengthMinutes: number; estimatedCost: number }> {
    try {
      const formData = new FormData();
      formData.append('audio', file);
  
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/estimate-token-cost`, {
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
}

export const transcriptionService = new TranscriptionService();
