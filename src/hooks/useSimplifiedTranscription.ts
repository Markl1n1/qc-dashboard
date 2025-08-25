
import { useState, useCallback } from 'react';
import { simplifiedAssemblyAIService, SimplifiedAssemblyAIOptions } from '../services/simplifiedAssemblyAIService';
import { UnifiedTranscriptionProgress, SpeakerUtterance } from '../types';

export interface SimpleTranscriptionOptions {
  speakerLabels?: boolean;
  language?: string;
}

export const useSimplifiedTranscription = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<UnifiedTranscriptionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transcribe = useCallback(async (audioFile: File, options: SimpleTranscriptionOptions): Promise<{ text: string; speakerUtterances: SpeakerUtterance[] }> => {
    console.log('useSimplifiedTranscription.transcribe called', { fileName: audioFile.name, options });
    
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      // Set up progress tracking
      simplifiedAssemblyAIService.setProgressCallback((progressData) => {
        console.log('Progress callback received in hook:', progressData);
        try {
          setProgress(progressData);
        } catch (err) {
          console.error('Error setting progress state:', err);
        }
      });

      const assemblyOptions: SimplifiedAssemblyAIOptions = {
        speaker_labels: options.speakerLabels || false,
        language_detection: true,
        language_code: options.language,
      };

      console.log('Calling simplified service transcribe');
      const result = await simplifiedAssemblyAIService.transcribe(audioFile, assemblyOptions);
      
      console.log('Transcription completed in hook', { 
        textLength: result.text.length,
        utteranceCount: result.speakerUtterances.length 
      });
      
      setProgress({ stage: 'complete', progress: 100, message: 'Transcription complete' });
      
      return {
        text: result.text,
        speakerUtterances: result.speakerUtterances
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
      console.error('Transcription error in hook:', { errorMessage, error: err });
      
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
      console.log('useSimplifiedTranscription finished, isLoading set to false');
    }
  }, []);

  return {
    transcribe,
    isLoading,
    progress,
    error
  };
};
