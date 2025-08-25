import { useState, useCallback } from 'react';
import { simpleTranslationService } from '../services/simpleTranslationService';
import { TranslationProgress, SpeakerUtterance } from '../types';

export const useSimpleTranslation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<TranslationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const translateToRussian = useCallback(async (
    rawText: string,
    speakerUtterances: SpeakerUtterance[],
    sourceLanguage: string = 'en'
  ) => {
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      simpleTranslationService.setProgressCallback((progress) => {
        setProgress(progress);
      });

      // Translate full text
      const translatedText = await simpleTranslationService.translateText(rawText, sourceLanguage);
      
      // Translate speaker utterances
      const translatedUtterances = await simpleTranslationService.translateSpeakerUtterances(
        speakerUtterances, 
        sourceLanguage
      );
      
      setProgress({ stage: 'complete', progress: 100, message: 'Translation completed successfully!' });
      
      return {
        text: translatedText,
        utterances: translatedUtterances
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Translation failed';
      setError(errorMessage);
      setProgress({ stage: 'error', progress: 0, message: errorMessage });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCache = useCallback(() => {
    simpleTranslationService.clearCache();
  }, []);

  return {
    translateToRussian,
    isLoading,
    progress,
    error,
    clearCache
  };
};
