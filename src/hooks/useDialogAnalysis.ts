import { useCallback } from 'react';
import { useEvaluateDialog } from './useEvaluateDialog';
import { useAnalysisResults } from './useAnalysisResults';
import { DialogData } from '../types/unified';
import { toast } from 'sonner';

export const useDialogAnalysis = (dialogId: string) => {
  const evaluateDialogMutation = useEvaluateDialog();
  const { data: analysisData, isLoading: isAnalysisLoading } = useAnalysisResults(dialogId);

  const startAnalysis = useCallback(async (dialog: DialogData) => {
    if (!dialog.speakerTranscription || dialog.speakerTranscription.length === 0) {
      toast.error('No transcription available for analysis');
      return;
    }

    evaluateDialogMutation.mutate({
      dialogId: dialog.id,
      utterances: dialog.speakerTranscription,
      modelId: 'gpt-5-mini'
    });
  }, [evaluateDialogMutation]);

  return {
    startAnalysis,
    analysisData,
    isAnalyzing: evaluateDialogMutation.isPending,
    isAnalysisLoading,
    analysisError: evaluateDialogMutation.error
  };
};