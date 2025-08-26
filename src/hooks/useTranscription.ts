
import { useState, useCallback } from 'react';
import { transcriptionService } from '../services/transcriptionService';
import { UnifiedTranscriptionProgress, SpeakerUtterance } from '../types';

export interface TranscriptionOptions {
  model?: string;
  language?: string;
  speakerLabels?: boolean;
}

export const useTranscription = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<UnifiedTranscriptionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transcribe = useCallback(async (audioFile: File, options: TranscriptionOptions): Promise<{ text: string; speakerUtterances: SpeakerUtterance[] }> => {
    console.log('Transcription hook called');
    console.log('File:', audioFile.name, 'Options:', options);
    
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      // Set up progress tracking
      transcriptionService.setProgressCallback((progressData) => {
        console.log('Progress callback received:', progressData);
        try {
          setProgress(progressData);
        } catch (err) {
          console.error('Error setting progress state:', err);
        }
      });

      console.log('Calling transcription service...');
      
      // For now, return mock data since we removed AssemblyAI
      // This should be replaced with actual transcription service integration
      const result = {
        text: "This is a mock transcription result. Please integrate with your preferred transcription service.",
        speakerUtterances: [
          {
            speaker: "Agent",
            text: "Hello, how can I help you today?",
            confidence: 0.95,
            start: 0,
            end: 2
          },
          {
            speaker: "Customer", 
            text: "I need help with my account.",
            confidence: 0.92,
            start: 2.5,
            end: 4.5
          }
        ]
      };
      
      setProgress({ stage: 'complete', progress: 100, message: 'Transcription complete' });
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
      console.error('Transcription error:', errorMessage);
      
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadModel = useCallback(async (options: TranscriptionOptions): Promise<void> => {
    console.log('loadModel called - mock implementation');
  }, []);

  return {
    transcribe,
    loadModel,
    isLoading,
    progress,
    error,
    isModelLoaded: () => true,
    getCurrentModel: () => 'mock-transcription-service',
    getModelInfo: (modelName: string) => ({ name: modelName, size: 'unknown' }),
    getAllModelInfo: () => [{ name: 'mock-transcription-service', size: 'unknown' }]
  };
};
