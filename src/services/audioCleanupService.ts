import { supabase } from '../integrations/supabase/client';

export class AudioCleanupService {
  private static instance: AudioCleanupService;
  private cleanupQueue: string[] = [];

  static getInstance(): AudioCleanupService {
    if (!AudioCleanupService.instance) {
      AudioCleanupService.instance = new AudioCleanupService();
    }
    return AudioCleanupService.instance;
  }

  /**
   * Add file to cleanup queue
   */
  queueForCleanup(fileName: string): void {
    console.log('🗑️ Queuing file for cleanup:', fileName);
    this.cleanupQueue.push(fileName);
  }

  /**
   * Clean up audio files from storage
   */
  async cleanupFiles(fileNames: string[]): Promise<void> {
    if (fileNames.length === 0) return;

    try {
      console.log('🗑️ Cleaning up audio files:', fileNames);
      const { error } = await supabase.storage
        .from('audio-files')
        .remove(fileNames);

      if (error) {
        console.error('❌ Failed to cleanup audio files:', error);
        throw error;
      }

      console.log('✅ Successfully cleaned up audio files:', fileNames);
    } catch (error) {
      console.error('❌ Error during audio cleanup:', error);
      // Don't throw - cleanup is non-critical
    }
  }

  /**
   * Clean up all queued files
   */
  async cleanupQueuedFiles(): Promise<void> {
    if (this.cleanupQueue.length === 0) return;

    const filesToCleanup = [...this.cleanupQueue];
    this.cleanupQueue = [];

    await this.cleanupFiles(filesToCleanup);
  }

  /**
   * Clean up single audio file after transcription
   */
  async cleanupSingleFile(fileName: string): Promise<void> {
    await this.cleanupFiles([fileName]);
  }

  /**
   * Clean up multiple audio files (used for merged audio scenario)
   */
  async cleanupMultipleFiles(fileNames: string[]): Promise<void> {
    await this.cleanupFiles(fileNames);
  }
}

export const audioCleanupService = AudioCleanupService.getInstance();