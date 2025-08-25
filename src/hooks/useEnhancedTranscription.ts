
import { useState, useCallback } from 'react';
import { enhancedAssemblyAIService, EnhancedAssemblyAIResult } from '../services/enhancedAssemblyAIService';
import { AssemblyAIEnhancedOptions, AssemblyAIRegion } from '../types/assemblyai';
import { UnifiedTranscriptionProgress } from '../types';

export const useEnhancedTranscription = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<UnifiedTranscriptionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transcribe = useCallback(async (
    audioFile: File, 
    options: AssemblyAIEnhancedOptions
  ): Promise<EnhancedAssemblyAIResult> => {
    console.log('Enhanced transcription hook called', { fileName: audioFile.name, options });
    
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      // Set up progress tracking
      enhancedAssemblyAIService.setProgressCallback((progressData) => {
        console.log('Enhanced progress callback:', progressData);
        try {
          setProgress(progressData);
        } catch (err) {
          console.error('Error setting enhanced progress state:', err);
        }
      });

      console.log('Calling enhanced AssemblyAI service...');
      const result = await enhancedAssemblyAIService.transcribe(audioFile, options);
      
      console.log('Enhanced transcription completed', { 
        textLength: result.text.length,
        utteranceCount: result.speakerUtterances.length,
        hasLanguageDetection: !!result.languageDetected,
        hasContentSafety: !!result.contentSafety,
        hasEntities: !!result.entities?.length,
        hasSentiment: !!result.sentiment?.length,
        hasChapters: !!result.chapters?.length,
        hasSummary: !!result.summary
      });
      
      setProgress({ stage: 'complete', progress: 100, message: 'Enhanced transcription complete' });
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Enhanced transcription failed';
      console.error('Enhanced transcription error:', { errorMessage, error: err });
      
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setRegion = useCallback((region: AssemblyAIRegion) => {
    enhancedAssemblyAIService.setRegion(region);
  }, []);

  const getCurrentRegion = useCallback((): AssemblyAIRegion => {
    return enhancedAssemblyAIService.getRegion();
  }, []);

  return {
    transcribe,
    setRegion,
    getCurrentRegion,
    isLoading,
    progress,
    error
  };
};
