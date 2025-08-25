
import { useState, useCallback } from 'react';
import { assemblyAIService } from '../services/assemblyAIService';
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
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      console.log('Starting transcription for file:', audioFile.name);
      console.log('Transcription options:', options);

      // Set up progress tracking
      assemblyAIService.setProgressCallback((progressData) => {
        try {
          setProgress(progressData);
        } catch (err) {
          console.error('Error in progress callback:', err);
        }
      });

      // Convert transcription options to AssemblyAI format
      const assemblyOptions = {
        speaker_labels: options.speakerLabels || false,
        language_detection: true,
        language_code: options.language,
        speech_model: 'universal' as const,
        disfluencies: true,
      };

      const result = await assemblyAIService.transcribe(audioFile, assemblyOptions);
      
      console.log('Transcription completed, text length:', result.text.length);
      setProgress({ stage: 'complete', progress: 100, message: 'Transcription complete' });
      
      return {
        text: result.text,
        speakerUtterances: result.speakerUtterances
      };
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
    console.log('Model loading not required for AssemblyAI service');
    // AssemblyAI doesn't require local model loading
  }, []);

  return {
    transcribe,
    loadModel,
    isLoading,
    progress,
    error,
    isModelLoaded: () => true, // Always available for AssemblyAI
    getCurrentModel: () => 'assemblyai-universal',
    getModelInfo: (modelName: string) => ({ name: modelName, size: 'cloud' }),
    getAllModelInfo: () => [{ name: 'assemblyai-universal', size: 'cloud' }]
  };
};
