
import { useState, useCallback } from 'react';
import { deepgramService } from '../services/deepgramService';
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
    console.warn('🎯 [useTranscription] TRANSCRIPTION HOOK CALLED');
    console.warn('🎯 [useTranscription] File:', audioFile.name, 'Options:', options);
    
    setIsLoading(true);
    setError(null);
    setProgress(null);
    console.warn('🎯 [useTranscription] State reset - isLoading: true, error: null, progress: null');

    try {
      console.warn('🎯 [useTranscription] Setting up progress callback');
      
      // Set up progress tracking with enhanced logging
      deepgramService.setProgressCallback((progressData) => {
        console.warn('🎯 [useTranscription] Progress callback received:', progressData);
        try {
          setProgress(progressData);
          console.warn('🎯 [useTranscription] Progress state updated successfully');
        } catch (err) {
          console.error('❌ [useTranscription] CRITICAL ERROR in progress callback:', err);
        }
      });

      // Convert transcription options to Deepgram format
      const deepgramOptions = {
        model: options.model || 'nova-2',
        speaker_labels: options.speakerLabels || false,
        language_detection: true,
        language: options.language,
        smart_formatting: true,
        profanity_filter: false
      };
      console.warn('🎯 [useTranscription] Deepgram options prepared:', deepgramOptions);

      console.warn('🎯 [useTranscription] Calling deepgramService.transcribe...');
      const result = await deepgramService.transcribe(audioFile, deepgramOptions);
      
      console.warn('🎯 [useTranscription] Transcription completed successfully');
      console.warn('🎯 [useTranscription] Result text length:', result.text.length);
      console.warn('🎯 [useTranscription] Speaker utterances count:', result.speakerUtterances.length);
      
      setProgress({ stage: 'complete', progress: 100, message: 'Transcription complete' });
      
      return {
        text: result.text,
        speakerUtterances: result.speakerUtterances
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
      console.error('❌ [useTranscription] TRANSCRIPTION ERROR:', errorMessage);
      console.error('❌ [useTranscription] Error object:', err);
      console.error('❌ [useTranscription] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
      console.warn('🎯 [useTranscription] isLoading set to false');
    }
  }, []);

  const loadModel = useCallback(async (options: TranscriptionOptions): Promise<void> => {
    console.warn('🎯 [useTranscription] loadModel called - not required for Deepgram');
  }, []);

  console.warn('🎯 [useTranscription] Hook returning functions and state');
  
  return {
    transcribe,
    loadModel,
    isLoading,
    progress,
    error,
    isModelLoaded: () => {
      console.warn('🎯 [useTranscription] isModelLoaded called - returning true');
      return true;
    },
    getCurrentModel: () => {
      console.warn('🎯 [useTranscription] getCurrentModel called');
      return 'deepgram-nova-2';
    },
    getModelInfo: (modelName: string) => {
      console.warn('🎯 [useTranscription] getModelInfo called for:', modelName);
      return { name: modelName, size: 'cloud' };
    },
    getAllModelInfo: () => {
      console.warn('🎯 [useTranscription] getAllModelInfo called');
      return [{ name: 'deepgram-nova-2', size: 'cloud' }];
    }
  };
};
