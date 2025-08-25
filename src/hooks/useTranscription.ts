
import { useState, useCallback } from 'react';
import { transcriptionService, TranscriptionOptions } from '../services/transcriptionService';
import { UnifiedTranscriptionProgress } from '../types';

export const useTranscription = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<UnifiedTranscriptionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transcribe = useCallback(async (audioFile: File, options: TranscriptionOptions): Promise<string> => {
    // Reset state before starting
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      console.log('Starting local transcription for file:', audioFile.name);
      console.log('Transcription options:', options);

      // Clear any existing progress callback to prevent memory leaks
      transcriptionService.setProgressCallback(() => {});

      // Set up new progress tracking with error boundary
      transcriptionService.setProgressCallback((progressData) => {
        try {
          setProgress(progressData);
        } catch (err) {
          console.error('Error in progress callback:', err);
        }
      });

      const result = await transcriptionService.transcribe(audioFile, options);
      
      console.log('Local transcription completed, text length:', result.length);
      setProgress({ stage: 'complete', progress: 100, message: 'Transcription complete' });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
      console.error('Local transcription error:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
      // Clear progress callback to prevent memory leaks
      transcriptionService.setProgressCallback(() => {});
    }
  }, []);

  const loadModel = useCallback(async (options: TranscriptionOptions): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Loading transcription model with options:', options);
      
      // Clear any existing progress callback
      transcriptionService.setProgressCallback(() => {});

      transcriptionService.setProgressCallback((progressData) => {
        try {
          setProgress(progressData);
        } catch (err) {
          console.error('Error in model loading progress callback:', err);
        }
      });

      await transcriptionService.loadModel(options);
      console.log('Transcription model loaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load model';
      console.error('Model loading error:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
      // Clear progress callback
      transcriptionService.setProgressCallback(() => {});
    }
  }, []);

  return {
    transcribe,
    loadModel,
    isLoading,
    progress,
    error,
    isModelLoaded: transcriptionService.isModelLoaded(),
    getCurrentModel: transcriptionService.getCurrentModel(),
    getModelInfo: transcriptionService.getModelInfo.bind(transcriptionService),
    getAllModelInfo: transcriptionService.getAllModelInfo.bind(transcriptionService)
  };
};
