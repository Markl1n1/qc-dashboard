import { TranslationQueueItem, TranslationProgress } from '../types';
import { simpleTranslationService } from './simpleTranslationService';
import { useDialogStore } from '../store/dialogStore';

class BackgroundTranslationService {
  private static instance: BackgroundTranslationService;
  private queue: TranslationQueueItem[] = [];
  private isProcessing = false;
  private maxConcurrent = 2; // Process 2 translations simultaneously
  private activeTranslations = new Set<string>();

  private constructor() {}

  static getInstance(): BackgroundTranslationService {
    if (!BackgroundTranslationService.instance) {
      BackgroundTranslationService.instance = new BackgroundTranslationService();
    }
    return BackgroundTranslationService.instance;
  }

  // Add dialog to translation queue
  addToQueue(dialogId: string, priority: number = 0) {
    // Check if already in queue or being processed
    if (this.queue.find(item => item.dialogId === dialogId) || this.activeTranslations.has(dialogId)) {
      return;
    }

    this.queue.push({
      dialogId,
      priority,
      createdAt: new Date()
    });

    // Sort by priority (higher first) then by creation time
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    this.processQueue();
  }

  // Remove dialog from queue
  removeFromQueue(dialogId: string) {
    this.queue = this.queue.filter(item => item.dialogId !== dialogId);
  }

  // Check if dialog is in queue or being processed
  isInQueue(dialogId: string): boolean {
    return this.queue.some(item => item.dialogId === dialogId) || this.activeTranslations.has(dialogId);
  }

  // Get queue position for dialog
  getQueuePosition(dialogId: string): number {
    const index = this.queue.findIndex(item => item.dialogId === dialogId);
    return index >= 0 ? index + 1 : 0;
  }

  // Process translation queue
  private async processQueue() {
    if (this.isProcessing || this.activeTranslations.size >= this.maxConcurrent) {
      return;
    }

    const nextItem = this.queue.shift();
    if (!nextItem) {
      return;
    }

    this.activeTranslations.add(nextItem.dialogId);
    
    try {
      await this.translateDialog(nextItem.dialogId);
    } catch (error) {
      console.error(`Background translation failed for dialog ${nextItem.dialogId}:`, error);
    } finally {
      this.activeTranslations.delete(nextItem.dialogId);
      
      // Continue processing queue
      setTimeout(() => this.processQueue(), 100);
    }
  }

  // Translate dialog in background
  private async translateDialog(dialogId: string) {
    const store = useDialogStore.getState();
    const dialog = store.getDialog(dialogId);
    
    if (!dialog || !dialog.transcription || !dialog.speakerTranscription) {
      return;
    }

    // Check if already translated to Russian
    if (dialog.russianTranscription && dialog.russianSpeakerTranscription) {
      return;
    }

    // Update dialog status
    store.updateDialog(dialogId, {
      translationStatus: 'processing',
      translationProgress: 0,
      isTranslating: true
    });

    try {
      // Set up progress tracking
      simpleTranslationService.setProgressCallback((progress: TranslationProgress) => {
        store.updateDialog(dialogId, {
          translationProgress: progress.progress
        });
      });

      // Translate full text and speaker utterances together
      const result = await simpleTranslationService.translateToRussian(
        dialog.transcription,
        dialog.speakerTranscription,
        'en'
      );

      const translatedText = result.text;
      const translatedUtterances = result.utterances;

      // Save translated content
      store.updateDialog(dialogId, {
        russianTranscription: translatedText,
        russianSpeakerTranscription: translatedUtterances,
        translationStatus: 'completed',
        translationProgress: 100,
        isTranslating: false,
        currentLanguage: 'original' // Default to original language
      });

      console.log('Translation completed and saved:', {
        hasRussianTranscription: !!translatedText,
        hasRussianSpeakerTranscription: !!translatedUtterances,
        textLength: translatedText?.length,
        utterancesCount: translatedUtterances?.length
      });

    } catch (error) {
      console.error('Translation failed:', error);
      store.updateDialog(dialogId, {
        translationStatus: 'failed',
        isTranslating: false,
        error: error instanceof Error ? error.message : 'Translation failed'
      });
    }
  }

  // Get queue status
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      activeTranslations: this.activeTranslations.size,
      totalActive: this.queue.length + this.activeTranslations.size
    };
  }

  // Clear queue
  clearQueue() {
    this.queue = [];
  }
}

export const backgroundTranslationService = BackgroundTranslationService.getInstance();