import { useCallback } from 'react';
import { audioCleanupService } from '../services/audioCleanupService';

/**
 * Hook for managing transcription cleanup operations
 */
export const useTranscriptionCleanup = () => {
  const cleanupAfterTranscription = useCallback(async (fileName: string, success: boolean) => {
    try {
      console.log(`🗑️ Cleaning up after transcription: ${fileName} (success: ${success})`);
      await audioCleanupService.cleanupSingleFile(fileName);
    } catch (error) {
      console.warn('⚠️ Non-critical cleanup error:', error);
    }
  }, []);

  const cleanupMergedFiles = useCallback(async (sourceFiles: string[], mergedFile: string, transcriptionSuccess: boolean) => {
    try {
      console.log(`🗑️ Cleaning up merged audio files (success: ${transcriptionSuccess})`);
      
      // Clean up source files first
      if (sourceFiles.length > 0) {
        await audioCleanupService.cleanupMultipleFiles(sourceFiles);
      }
      
      // Then clean up merged file
      if (mergedFile) {
        await audioCleanupService.cleanupSingleFile(mergedFile);
      }
    } catch (error) {
      console.warn('⚠️ Non-critical cleanup error:', error);
    }
  }, []);

  return {
    cleanupAfterTranscription,
    cleanupMergedFiles
  };
};