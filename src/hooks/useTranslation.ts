
import { useState, useCallback } from 'react';
import { translationService, TranslationOptions } from '../services/translationService';
import { TranslationProgress, SpeakerUtterance } from '../types';

export const useTranslation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<TranslationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const translateDialog = useCallback(async (
    rawText: string,
    speakerUtterances: SpeakerUtterance[],
    options: TranslationOptions
  ) => {
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      translationService.setProgressCallback((progress) => {
        setProgress(progress);
      });

      const result = await translationService.translateDialog(rawText, speakerUtterances, options);
      
      setProgress({ stage: 'complete', progress: 100, message: 'All translations completed' });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Translation failed';
      setError(errorMessage);
      setProgress({ stage: 'error', progress: 0, message: errorMessage });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const translateText = useCallback(async (
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'en'
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      translationService.setProgressCallback((progress) => {
        setProgress(progress);
      });

      const result = await translationService.translateText(text, targetLanguage, sourceLanguage);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Translation failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    translateDialog,
    translateText,
    isLoading,
    progress,
    error,
    clearCache: translationService.clearCache.bind(translationService),
  };
};
