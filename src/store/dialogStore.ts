
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LeMUREvaluationResult } from '../types/lemurEvaluation';
import { OpenAIEvaluationResult } from '../types/openaiEvaluation';
import { Dialog as BaseDialog, TokenEstimation } from '../types';

// Use the Dialog interface from types/index.ts to ensure consistency
export interface Dialog extends BaseDialog {}

interface DialogStore {
  dialogs: Dialog[];
  addDialog: (dialog: Dialog) => void;
  updateDialog: (id: string, updates: Partial<Dialog>) => void;
  updateLeMUREvaluation: (id: string, evaluation: LeMUREvaluationResult) => void;
  updateOpenAIEvaluation: (id: string, evaluation: OpenAIEvaluationResult) => void;
  deleteDialog: (id: string) => void;
  getDialog: (id: string) => Dialog | undefined;
  clearDialogs: () => void;
  stopProcessing: (id: string) => void;
  processDialog: (id: string) => void;
}

const calculateQualityScore = (evaluation: LeMUREvaluationResult): number => {
  // Define weights for different mistake levels
  const mistakeWeights = {
    critical: 10,
    major: 7,
    minor: 3,
  };

  // Calculate total deductions based on mistakes
  let totalDeductions = 0;
  evaluation.mistakes.forEach((mistake) => {
    totalDeductions += mistakeWeights[mistake.level] || 0;
  });

  // Ensure the quality score is within the 0-100 range
  const qualityScore = Math.max(0, 100 - totalDeductions);
  return qualityScore;
};

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

      updateLeMUREvaluation: (id: string, evaluation: LeMUREvaluationResult) => {
        set((state) => {
          const dialog = state.dialogs.find(d => d.id === id);
          if (!dialog) return state;

          // Calculate quality score based on LeMUR evaluation results
          const qualityScore = calculateQualityScore(evaluation);
          
          // Add LeMUR token estimation if available
          const tokenEstimation: TokenEstimation = dialog.tokenEstimation || {
            audioLengthMinutes: 0,
            estimatedCost: 0
          };
          
          if (evaluation.tokenUsage) {
            tokenEstimation.lemur = {
              inputTokens: evaluation.tokenUsage.input,
              outputTokens: evaluation.tokenUsage.output,
              totalTokens: evaluation.tokenUsage.input + evaluation.tokenUsage.output,
              cost: evaluation.tokenUsage.cost || 0
            };
          }
          
          return {
            dialogs: state.dialogs.map((d) =>
              d.id === id 
                ? { 
                    ...d, 
                    lemurEvaluation: evaluation,
                    qualityScore: qualityScore,
                    status: 'completed' as const,
                    tokenEstimation
                  } 
                : d
            )
          };
        });
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
