
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Dialog, SpeakerUtterance } from '../types';
import { databaseService, DatabaseDialog } from '../services/databaseService';
import { useAuthStore } from './authStore';

// Guards against request storms (e.g. effects firing repeatedly or rapid re-mounts)
// which otherwise keep `isLoading` true and spam `/dialogs?select=*...`.
const DIALOGS_LOAD_MIN_INTERVAL_MS = 1500;
let dialogsLoadInFlight = false;
let lastDialogsLoadAt = 0;

interface EnhancedDialogStore {
  dialogs: Dialog[];
  isLoading: boolean;
  error: string | null;
  dialogDetailsCache: Map<string, { data: Dialog; timestamp: number }>;
  
  // Dialog operations
  loadDialogs: () => Promise<void>;
  loadDialogDetails: (id: string) => Promise<Dialog | null>;
  addDialog: (dialog: Omit<Dialog, 'id'>) => Promise<string>;
  updateDialog: (id: string, updates: Partial<Dialog>) => Promise<void>;
  deleteDialog: (id: string) => Promise<void>;
  getDialog: (id: string) => Promise<Dialog | null>;
  
  // Transcription operations
  saveTranscription: (dialogId: string, transcription: string, type: 'plain' | 'russian') => Promise<void>;
  saveSpeakerTranscription: (dialogId: string, utterances: SpeakerUtterance[], type: 'speaker' | 'russian_speaker') => Promise<void>;
  
  // Analysis operations
  saveAnalysis: (dialogId: string, analysis: any, type: 'openai') => Promise<void>;
  
  // Local state management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearDialogs: () => void;
}

export const useEnhancedDialogStore = create<EnhancedDialogStore>()(
  persist(
    (set, get) => ({
      dialogs: [],
      isLoading: false, // Must never be restored from persisted state
      error: null,
      dialogDetailsCache: new Map(),

      setLoading: (loading: boolean) => set({ isLoading: loading }),
      
      setError: (error: string | null) => set({ error }),
      
      loadDialogs: async () => {
        const now = Date.now();
        if (dialogsLoadInFlight) return;
        if (now - lastDialogsLoadAt < DIALOGS_LOAD_MIN_INTERVAL_MS) return;

        dialogsLoadInFlight = true;
        lastDialogsLoadAt = now;

        try {
          set({ isLoading: true, error: null });
          
          const dbDialogs = await databaseService.getDialogs();
          
          // Load only essential data for dashboard view (no detailed transcriptions/analyses)
          const dialogs: Dialog[] = dbDialogs.map(dbDialog => 
            databaseService.convertToDialogFormat(dbDialog)
          );

          set({ dialogs, isLoading: false });
        } catch (error) {
          console.error('Error loading dialogs:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to load dialogs', isLoading: false });
        } finally {
          dialogsLoadInFlight = false;
        }
      },

      // New method for loading detailed dialog data on-demand
      loadDialogDetails: async (id: string): Promise<Dialog | null> => {
        try {
          const { dialogDetailsCache } = get();
          const now = Date.now();
          const cacheEntry = dialogDetailsCache.get(id);
          
          // Return cached data if it's less than 5 minutes old
          if (cacheEntry && (now - cacheEntry.timestamp) < 5 * 60 * 1000) {
            return cacheEntry.data;
          }

          const dbDialog = await databaseService.getDialog(id);
          if (!dbDialog) return null;

          // Load transcriptions and analyses in parallel
          const [transcriptions, analyses] = await Promise.all([
            databaseService.getTranscriptions(id),
            databaseService.getAnalysis(id)
          ]);
          
          const dialog = databaseService.convertToDialogFormat(dbDialog, transcriptions, analyses);
          
          // Load speaker utterances in parallel
          const utterancePromises = transcriptions.map(async (transcription) => {
            if (transcription.transcription_type === 'speaker') {
              const utterances = await databaseService.getUtterances(transcription.id);
              dialog.speakerTranscription = databaseService.convertToSpeakerUtterances(utterances);
            } else if (transcription.transcription_type === 'russian_speaker') {
              const utterances = await databaseService.getUtterances(transcription.id);
              dialog.russianSpeakerTranscription = databaseService.convertToSpeakerUtterances(utterances);
            }
          });
          
          await Promise.all(utterancePromises);

          // Cache the detailed data
          dialogDetailsCache.set(id, { data: dialog, timestamp: now });
          set({ dialogDetailsCache });

          return dialog;
        } catch (error) {
          console.error('Error loading dialog details:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to load dialog details' });
          return null;
        }
      },

      addDialog: async (dialogData: Omit<Dialog, 'id'>): Promise<string> => {
        try {
          set({ isLoading: true, error: null });
          
          const user = useAuthStore.getState().user;
          if (!user) throw new Error('User not authenticated');

          const dbDialogData: Omit<DatabaseDialog, 'id' | 'created_at' | 'updated_at' | 'expires_at'> = {
            user_id: user.id,
            file_name: dialogData.fileName,
            status: dialogData.status,
            assigned_agent: dialogData.assignedAgent,
            assigned_supervisor: dialogData.assignedSupervisor,
            upload_date: dialogData.uploadDate,
            error_message: dialogData.error,
            audio_length_minutes: dialogData.tokenEstimation?.audioLengthMinutes,
            estimated_cost: dialogData.tokenEstimation?.estimatedCost || 0,
            quality_score: dialogData.qualityScore,
            is_segmented: dialogData.isSegmented || false,
            parent_dialog_id: dialogData.parentDialogId,
            segment_count: dialogData.segmentCount,
            segment_index: dialogData.segmentIndex,
            current_language: dialogData.currentLanguage || 'original'
          };

          const createdDialog = await databaseService.createDialog(dbDialogData);
          const dialog = databaseService.convertToDialogFormat(createdDialog);
          
          set(state => ({ 
            dialogs: [dialog, ...state.dialogs],
            isLoading: false 
          }));

          return createdDialog.id;
        } catch (error) {
          console.error('Error adding dialog:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to add dialog', isLoading: false });
          throw error;
        }
      },

      updateDialog: async (id: string, updates: Partial<Dialog>) => {
        try {
          set({ error: null });
          
          const dbUpdates: Partial<DatabaseDialog> = {};
          
          if (updates.fileName) dbUpdates.file_name = updates.fileName;
          if (updates.status) dbUpdates.status = updates.status;
          if (updates.assignedAgent) dbUpdates.assigned_agent = updates.assignedAgent;
          if (updates.assignedSupervisor) dbUpdates.assigned_supervisor = updates.assignedSupervisor;
          if (updates.error !== undefined) dbUpdates.error_message = updates.error;
          if (updates.qualityScore !== undefined) dbUpdates.quality_score = updates.qualityScore;
          if (updates.currentLanguage) dbUpdates.current_language = updates.currentLanguage;
          if (updates.audioLengthMinutes !== undefined) dbUpdates.audio_length_minutes = updates.audioLengthMinutes;

          await databaseService.updateDialog(id, dbUpdates);
          
          set(state => ({
            dialogs: state.dialogs.map(dialog =>
              dialog.id === id ? { ...dialog, ...updates } : dialog
            )
          }));
        } catch (error) {
          console.error('Error updating dialog:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to update dialog' });
          throw error;
        }
      },

      deleteDialog: async (id: string) => {
        try {
          set({ error: null });
          
          await databaseService.deleteDialog(id);
          
          set(state => {
            // Remove from cache as well
            const newCache = new Map(state.dialogDetailsCache);
            newCache.delete(id);
            
            return {
              dialogs: state.dialogs.filter(dialog => dialog.id !== id),
              dialogDetailsCache: newCache
            };
          });
        } catch (error) {
          console.error('Error deleting dialog:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to delete dialog' });
          throw error;
        }
      },

      getDialog: async (id: string): Promise<Dialog | null> => {
        // Use the new loadDialogDetails method for consistency
        const { loadDialogDetails } = get();
        return await loadDialogDetails(id);
      },

      saveTranscription: async (dialogId: string, transcription: string, type: 'plain' | 'russian') => {
        try {
          set({ error: null });
          
          await databaseService.createTranscription({
            dialog_id: dialogId,
            transcription_type: type,
            content: transcription,
            language: type === 'russian' ? 'ru' : 'en'
          });

          // Update local state
          set(state => ({
            dialogs: state.dialogs.map(dialog => {
              if (dialog.id === dialogId) {
                const updatedDialog = { ...dialog };
                if (type === 'plain') {
                  updatedDialog.transcription = transcription;
                } else {
                  updatedDialog.russianTranscription = transcription;
                }
                return updatedDialog;
              }
              return dialog;
            })
          }));
        } catch (error) {
          console.error('Error saving transcription:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to save transcription' });
          throw error;
        }
      },

      saveSpeakerTranscription: async (dialogId: string, utterances: SpeakerUtterance[], type: 'speaker' | 'russian_speaker') => {
        try {
          set({ error: null });
          
          const transcription = await databaseService.createTranscription({
            dialog_id: dialogId,
            transcription_type: type,
            language: type === 'russian_speaker' ? 'ru' : 'en'
          });

          const dbUtterances = utterances.map((utterance, index) => ({
            transcription_id: transcription.id,
            speaker: utterance.speaker,
            text: utterance.text,
            confidence: utterance.confidence,
            start_time: utterance.start,
            end_time: utterance.end,
            utterance_order: index
          }));

          await databaseService.createUtterances(dbUtterances);

          // Update local state
          set(state => ({
            dialogs: state.dialogs.map(dialog => {
              if (dialog.id === dialogId) {
                const updatedDialog = { ...dialog };
                if (type === 'speaker') {
                  updatedDialog.speakerTranscription = utterances;
                } else {
                  updatedDialog.russianSpeakerTranscription = utterances;
                }
                return updatedDialog;
              }
              return dialog;
            })
          }));
        } catch (error) {
          console.error('Error saving speaker transcription:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to save speaker transcription' });
          throw error;
        }
      },

      saveAnalysis: async (dialogId: string, analysis: any, type: 'openai') => {
        try {
          set({ error: null });
          
          // Enhanced analysis data with speaker information
          const enhancedMistakes = (analysis as any).mistakes || analysis.mistakes || [];
          const speakersData = (analysis as any).speakers || [];
          
          // Create enhanced mistakes array with speaker information embedded
          const mistakesWithSpeakers = enhancedMistakes.map((mistake: any) => ({
            ...mistake,
            _speakers: speakersData // Embed speaker data in each mistake for reference
          }));
          
          await databaseService.createAnalysis({
            dialog_id: dialogId,
            analysis_type: type,
            overall_score: analysis.overallScore,
            category_scores: analysis.categoryScores,
            mistakes: mistakesWithSpeakers, // Save enhanced mistakes with speaker data
            recommendations: analysis.recommendations,
            summary: analysis.summary,
            confidence: analysis.confidence,
            token_usage: (analysis as any).tokenUsage,
            banned_words_detected: analysis.bannedWordsDetected || [],
            sentiment: (analysis as any).sentiment,
            conversation_flow: (analysis as any).conversationFlow,
            processing_time: (analysis as any).processingTime
          });

          // Update speaker names in utterances if speaker data is available
          if (speakersData && speakersData.length > 0) {
            await databaseService.updateSpeakerNames(dialogId, speakersData);
          }

          // Update local state
          set(state => ({
            dialogs: state.dialogs.map(dialog => {
              if (dialog.id === dialogId) {
                const updatedDialog = { ...dialog };
                updatedDialog.openaiEvaluation = analysis as any;
                
                // Update speaker names in local utterances if available
                if (speakersData.length > 0 && updatedDialog.speakerTranscription) {
                  updatedDialog.speakerTranscription = databaseService.applySpeakerNames(
                    updatedDialog.speakerTranscription, 
                    speakersData
                  );
                }
                
                return updatedDialog;
              }
              return dialog;
            })
          }));
        } catch (error) {
          console.error('Error saving analysis:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to save analysis' });
          throw error;
        }
      },

      clearDialogs: () => set({ dialogs: [], dialogDetailsCache: new Map() }),
      
      // Add method to clear cache for a specific dialog
      clearDialogCache: (id: string) => {
        set(state => {
          const newCache = new Map(state.dialogDetailsCache);
          newCache.delete(id);
          return { dialogDetailsCache: newCache };
        });
      }
    }),
    {
      name: 'enhanced-dialog-store',
      partialize: (state) => ({ dialogs: state.dialogs }),
      /**
       * IMPORTANT:
       * Older persisted snapshots might still contain `isLoading: true` (from a previous version).
       * If we merge that back in, the UI can get stuck on skeleton loaders forever.
       *
       * We explicitly merge only `dialogs` and always reset volatile fields.
       */
      merge: (persistedState, currentState) => {
        const persistedDialogs = (persistedState as any)?.dialogs;

        return {
          ...currentState,
          dialogs: Array.isArray(persistedDialogs) ? persistedDialogs : currentState.dialogs,
          // volatile fields: always reset
          isLoading: false,
          error: null,
          dialogDetailsCache: new Map(),
        };
      },
    }
  )
);
