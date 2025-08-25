
import { useState, useCallback } from 'react';
import { transcriptionService, TranscriptionOptions } from '../services/transcriptionService';
import { UnifiedTranscriptionProgress } from '../types';

export const useTranscription = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<UnifiedTranscriptionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transcribe = useCallback(async (audioFile: File, options: TranscriptionOptions): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      console.log('Starting local transcription for file:', audioFile.name);
      console.log('Transcription options:', options);

      // Set up progress tracking
      transcriptionService.setProgressCallback((progress) => {
        setProgress(progress);
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
    }
  }, []);

  const loadModel = useCallback(async (options: TranscriptionOptions): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Loading transcription model with options:', options);
      
      transcriptionService.setProgressCallback((progress) => {
        setProgress(progress);
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
