
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OpenAIEvaluationResult } from '../types/openaiEvaluation';
import { Dialog as BaseDialog, TokenEstimation } from '../types';

// Use the Dialog interface from types/index.ts to ensure consistency
export interface Dialog extends BaseDialog {}

interface DialogStore {
  dialogs: Dialog[];
  addDialog: (dialog: Dialog) => void;
  updateDialog: (id: string, updates: Partial<Dialog>) => void;
  updateOpenAIEvaluation: (id: string, evaluation: OpenAIEvaluationResult) => void;
  deleteDialog: (id: string) => void;
  getDialog: (id: string) => Dialog | undefined;
  clearDialogs: () => void;
  stopProcessing: (id: string) => void;
  processDialog: (id: string) => void;
}

export const useDialogStore = create<DialogStore>()(
  persist(
    (set, get) => ({
      dialogs: [],
      
      addDialog: (dialog: Dialog) => {
        set((state) => ({
          dialogs: [dialog, ...state.dialogs]
        }));
      },

      updateDialog: (id: string, updates: Partial<Dialog>) => {
        set((state) => ({
          dialogs: state.dialogs.map((dialog) =>
            dialog.id === id ? { ...dialog, ...updates } : dialog
          )
        }));
      },

      updateOpenAIEvaluation: (id: string, evaluation: OpenAIEvaluationResult) => {
        set((state) => ({
          dialogs: state.dialogs.map((dialog) => {
            if (dialog.id === id) {
              // Add OpenAI token estimation
              const tokenEstimation: TokenEstimation = dialog.tokenEstimation || {
                audioLengthMinutes: 0,
                estimatedCost: 0
              };
              
              tokenEstimation.openAI = {
                estimatedInputTokens: 0, // Will be updated when we have the estimation
                actualInputTokens: evaluation.tokenUsage.input,
                outputTokens: evaluation.tokenUsage.output,
                totalTokens: evaluation.tokenUsage.input + evaluation.tokenUsage.output,
                cost: evaluation.tokenUsage.cost || 0
              };

              return { 
                ...dialog, 
                openaiEvaluation: evaluation,
                tokenEstimation
              };
            }
            return dialog;
          })
        }));
      },

      deleteDialog: (id: string) => {
        set((state) => ({
          dialogs: state.dialogs.filter((dialog) => dialog.id !== id)
        }));
      },

      getDialog: (id: string) => {
        return get().dialogs.find((dialog) => dialog.id === id);
      },

      clearDialogs: () => {
        set({ dialogs: [] });
      },

      stopProcessing: (id: string) => {
        set((state) => ({
          dialogs: state.dialogs.map((dialog) =>
            dialog.id === id 
              ? { ...dialog, status: 'failed' as const, error: 'Processing stopped by user' }
              : dialog
          )
        }));
      },

      processDialog: (id: string) => {
        set((state) => ({
          dialogs: state.dialogs.map((dialog) =>
            dialog.id === id 
              ? { ...dialog, status: 'processing' as const }
              : dialog
          )
        }));
      },
    }),
    {
      name: 'dialog-store',
    }
  )
);
