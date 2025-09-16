import { useCallback } from 'react';
import { useDeepgramTranscription } from './useDeepgramTranscription';
import { audioCleanupService } from '../services/audioCleanupService';
import { DeepgramOptions } from '../services/deepgramService';
import { SpeakerUtterance } from '../types';

export const useTranscriptionWithCleanup = () => {
  const { transcribe, isLoading, progress, error } = useDeepgramTranscription();

  const transcribeWithCleanup = useCallback(async (
    audioFile: File,
    options: DeepgramOptions
  ): Promise<{ text: string; speakerUtterances: SpeakerUtterance[] }> => {
    try {
      const result = await transcribe(audioFile, options);
      
      // Note: audioCleanupService is already integrated into deepgramService
      // so files are automatically cleaned up after transcription
      
      return result;
    } catch (error) {
      // Cleanup is handled in deepgramService even on error
      throw error;
    }
  }, [transcribe]);

  return {
    transcribe: transcribeWithCleanup,
    isLoading,
    progress,
    error
  };
};