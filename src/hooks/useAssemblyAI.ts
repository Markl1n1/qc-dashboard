
import { useState, useCallback } from 'react';
import { assemblyAIService, AssemblyAIOptions } from '../services/assemblyAIService';
import { UnifiedTranscriptionProgress, SpeakerUtterance } from '../types';
import { logger } from '../utils/logger';

export const useAssemblyAI = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<UnifiedTranscriptionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transcribe = useCallback(async (audioFile: File, options: AssemblyAIOptions): Promise<{ text: string; speakerUtterances: SpeakerUtterance[] }> => {
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      // Ensure language detection and disfluencies are enabled for proper handling
      const enhancedOptions: AssemblyAIOptions = {
        ...options,
        language_detection: true,
        disfluencies: true,
        // Remove any language_code setting to allow auto-detection
        language_code: undefined
      };

      logger.info('Starting AssemblyAI transcription with language detection and disfluencies enabled');
      logger.info('Audio file:', audioFile.name, 'Size:', audioFile.size);

      // Set up progress tracking
      assemblyAIService.setProgressCallback((progress) => {
        setProgress(progress);
      });

      const result = await assemblyAIService.transcribe(audioFile, enhancedOptions);
      
      logger.info('AssemblyAI transcription completed');
      setProgress({ stage: 'complete', progress: 100, message: 'Transcription complete' });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'AssemblyAI transcription failed';
      logger.error('AssemblyAI transcription error:', errorMessage);
      
      // For frontend-only mode, provide helpful error messages
      if (errorMessage.includes('CORS') || errorMessage.includes('cors')) {
        setError('CORS error detected. For production use, please set up a backend proxy or use Supabase Edge Functions.');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        setError('Network error. Please check your internet connection and API configuration.');
      } else {
        setError(errorMessage);
      }
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Remove API key validation since it's handled by Supabase secrets
  const validateApiKey = useCallback((apiKey: string): boolean => {
    return true; // Always return true since validation is handled server-side
  }, []);

  return {
    transcribe,
    validateApiKey,
    isLoading,
    progress,
    error,
  };
};
