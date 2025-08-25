
import { useState, useCallback } from 'react';
import { deepgramService, DeepgramOptions } from '../services/deepgramService';
import { UnifiedTranscriptionProgress, SpeakerUtterance } from '../types';

export const useDeepgramTranscription = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<UnifiedTranscriptionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transcribe = useCallback(async (
    audioFile: File, 
    options: DeepgramOptions
  ): Promise<{ text: string; speakerUtterances: SpeakerUtterance[] }> => {
    console.log('🎙️ Deepgram transcription hook called', { fileName: audioFile.name, options });
    
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      // Set up progress tracking
      deepgramService.setProgressCallback((progressData) => {
        console.log('📊 Deepgram progress callback:', progressData);
        try {
          setProgress(progressData);
        } catch (err) {
          console.error('❌ Error setting Deepgram progress state:', err);
        }
      });

      console.log('🚀 Calling Deepgram service...');
      const result = await deepgramService.transcribe(audioFile, options);
      
      console.log('✅ Deepgram transcription completed', { 
        textLength: result.text.length,
        utteranceCount: result.speakerUtterances.length
      });
      
      setProgress({ stage: 'complete', progress: 100, message: 'Deepgram transcription complete!' });
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Deepgram transcription failed';
      console.error('❌ Deepgram transcription error:', { errorMessage, error: err });
      
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    transcribe,
    isLoading,
    progress,
    error
  };
};
