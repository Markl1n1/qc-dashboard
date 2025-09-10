import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

interface EvaluationPayload {
  dialogId: string;
  utterances: any[];
  modelId: string;
}

interface EvaluationResult {
  success: boolean;
  analysis?: any;
  error?: string;
}

export function useEvaluateDialog() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (payload: EvaluationPayload): Promise<EvaluationResult> => {
      console.log('🚀 Starting AI analysis for dialog:', payload.dialogId);
      
      const { data, error } = await supabase.functions.invoke('openai-evaluate-background', {
        body: payload
      });

      if (error) {
        throw new Error(`AI analysis failed: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'AI analysis failed');
      }

      // Return the analysis result for cache priming
      return data;
    },
    onSuccess: (result, { dialogId }) => {
      console.log('✅ Analysis completed successfully:', result);
      
      // Prime the cache with the analysis result
      if (result.analysis) {
        queryClient.setQueryData(['analysis', dialogId], result.analysis);
        console.log('💾 Analysis data cached successfully');
      }
      
      // Navigate to the Analysis Results tab
      navigate(`/dialogs/${dialogId}?tab=results`);
      
      toast.success('AI analysis completed successfully!');
    },
    onError: (error: Error) => {
      console.error('❌ Analysis failed:', error);
      toast.error(`Analysis failed: ${error.message}`);
    }
  });
}