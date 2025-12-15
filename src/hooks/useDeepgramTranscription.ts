
import { useState, useCallback } from 'react';
import { deepgramService, DeepgramOptions, TranscriptionStats } from '../services/deepgramService';
import { UnifiedTranscriptionProgress, SpeakerUtterance } from '../types';

export interface DeepgramTranscriptionResult {
  text: string;
  speakerUtterances: SpeakerUtterance[];
  audioDurationMinutes?: number;
  stats?: TranscriptionStats;
}

export const useDeepgramTranscription = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<UnifiedTranscriptionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastStats, setLastStats] = useState<TranscriptionStats | null>(null);

  const transcribe = useCallback(async (
    audioFile: File, 
    options: DeepgramOptions
  ): Promise<DeepgramTranscriptionResult> => {
    const hookStartTime = Date.now();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎙️ [HOOK] useDeepgramTranscription called');
    console.log('📁 [HOOK] File:', audioFile.name, `(${(audioFile.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log('⚙️ [HOOK] Options:', {
      model: options.model,
      language: options.language,
      diarization: options.speaker_labels,
      languageDetection: options.language_detection
    });
    
    setIsLoading(true);
    setError(null);
    setProgress(null);
    setLastStats(null);

    try {
      // Set up progress tracking
      deepgramService.setProgressCallback((progressData) => {
        console.log('📊 [HOOK] Progress update:', progressData);
        try {
          setProgress(progressData);
        } catch (err) {
          console.error('❌ [HOOK] Error setting progress state:', err);
        }
      });

      console.log('🚀 [HOOK] Calling Deepgram service...');
      const result = await deepgramService.transcribe(audioFile, options);
      
      const hookDuration = Date.now() - hookStartTime;
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ [HOOK] Transcription completed successfully');
      console.log('📊 [HOOK] Results summary:', { 
        textLength: result.text.length,
        utteranceCount: result.speakerUtterances.length,
        audioDurationMinutes: result.audioDurationMinutes?.toFixed(2),
        hookProcessingTime: `${hookDuration}ms`
      });
      
      if (result.stats) {
        console.log('📈 [HOOK] Full statistics:', result.stats);
        setLastStats(result.stats);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      setProgress({ stage: 'complete', progress: 100, message: 'Transcription complete!' });
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
      const hookDuration = Date.now() - hookStartTime;
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ [HOOK] Transcription error:', { 
        errorMessage, 
        errorType: err instanceof Error ? err.name : typeof err,
        file: audioFile.name,
        hookDuration: `${hookDuration}ms`
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
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
    error,
    lastStats
  };
};
