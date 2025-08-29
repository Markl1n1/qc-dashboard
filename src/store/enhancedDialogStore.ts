
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Dialog, SpeakerUtterance, AIAnalysis } from '../types';
import { databaseService, DatabaseDialog } from '../services/databaseService';
import { useAuthStore } from './authStore';

interface EnhancedDialogStore {
  dialogs: Dialog[];
  isLoading: boolean;
  error: string | null;
  
  // Dialog operations
  loadDialogs: () => Promise<void>;
  addDialog: (dialog: Omit<Dialog, 'id'>) => Promise<string>;
  updateDialog: (id: string, updates: Partial<Dialog>) => Promise<void>;
  deleteDialog: (id: string) => Promise<void>;
  getDialog: (id: string) => Promise<Dialog | null>;
  
  // Transcription operations
  saveTranscription: (dialogId: string, transcription: string, type: 'plain' | 'russian') => Promise<void>;
  saveSpeakerTranscription: (dialogId: string, utterances: SpeakerUtterance[], type: 'speaker' | 'russian_speaker') => Promise<void>;
  
  // Analysis operations
  saveAnalysis: (dialogId: string, analysis: AIAnalysis, type: 'openai') => Promise<void>;
  
  // Local state management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearDialogs: () => void;
}

export const useEnhancedDialogStore = create<EnhancedDialogStore>()(
  persist(
    (set, get) => ({
      dialogs: [],
      isLoading: false,
      error: null,

      setLoading: (loading: boolean) => set({ isLoading: loading }),
      
      setError: (error: string | null) => set({ error }),

      loadDialogs: async () => {
        try {
          set({ isLoading: true, error: null });
          
          const dbDialogs = await databaseService.getDialogs();
          const dialogs: Dialog[] = [];

          for (const dbDialog of dbDialogs) {
            // Load transcriptions and analyses for each dialog
            const transcriptions = await databaseService.getTranscriptions(dbDialog.id);
            const analyses = await databaseService.getAnalysis(dbDialog.id);
            
            const dialog = databaseService.convertToDialogFormat(dbDialog, transcriptions, analyses);
            
            // Load speaker utterances if available
            const speakerTranscription = transcriptions.find(t => t.transcription_type === 'speaker');
            if (speakerTranscription) {
              const utterances = await databaseService.getUtterances(speakerTranscription.id);
              dialog.speakerTranscription = databaseService.convertToSpeakerUtterances(utterances);
            }

            const russianSpeakerTranscription = transcriptions.find(t => t.transcription_type === 'russian_speaker');
            if (russianSpeakerTranscription) {
              const utterances = await databaseService.getUtterances(russianSpeakerTranscription.id);
              dialog.russianSpeakerTranscription = databaseService.convertToSpeakerUtterances(utterances);
            }

            dialogs.push(dialog);
          }

          set({ dialogs, isLoading: false });
        } catch (error) {
          console.error('Error loading dialogs:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to load dialogs', isLoading: false });
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
          
          set(state => ({
            dialogs: state.dialogs.filter(dialog => dialog.id !== id)
          }));
        } catch (error) {
          console.error('Error deleting dialog:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to delete dialog' });
          throw error;
        }
      },

      getDialog: async (id: string): Promise<Dialog | null> => {
        try {
          const dbDialog = await databaseService.getDialog(id);
          if (!dbDialog) return null;

          const transcriptions = await databaseService.getTranscriptions(id);
          const analyses = await databaseService.getAnalysis(id);
          
          const dialog = databaseService.convertToDialogFormat(dbDialog, transcriptions, analyses);
          
          // Load speaker utterances
          for (const transcription of transcriptions) {
            if (transcription.transcription_type === 'speaker') {
              const utterances = await databaseService.getUtterances(transcription.id);
              dialog.speakerTranscription = databaseService.convertToSpeakerUtterances(utterances);
            } else if (transcription.transcription_type === 'russian_speaker') {
              const utterances = await databaseService.getUtterances(transcription.id);
              dialog.russianSpeakerTranscription = databaseService.convertToSpeakerUtterances(utterances);
            }
          }

          return dialog;
        } catch (error) {
          console.error('Error getting dialog:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to get dialog' });
          return null;
        }
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

      saveAnalysis: async (dialogId: string, analysis: AIAnalysis, type: 'openai') => {
        try {
          set({ error: null });
          
          await databaseService.createAnalysis({
            dialog_id: dialogId,
            analysis_type: type,
            overall_score: analysis.overallScore,
            category_scores: analysis.categoryScores,
            mistakes: analysis.mistakes,
            recommendations: analysis.recommendations,
            summary: analysis.summary,
            confidence: analysis.confidence,
            token_usage: (analysis as any).tokenUsage,
            banned_words_detected: analysis.bannedWordsDetected || [],
            sentiment: (analysis as any).sentiment,
            conversation_flow: (analysis as any).conversationFlow,
            processing_time: (analysis as any).processingTime
          });

          // Update local state
          set(state => ({
            dialogs: state.dialogs.map(dialog => {
              if (dialog.id === dialogId) {
                const updatedDialog = { ...dialog };
                updatedDialog.openaiEvaluation = analysis as any;
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

      clearDialogs: () => set({ dialogs: [] })
    }),
    {
      name: 'enhanced-dialog-store',
      partialize: (state) => ({ dialogs: state.dialogs })
    }
  )
);
