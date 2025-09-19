import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

interface EvaluationPayload {
  dialogId: string;
  utterances: import('../types/unified').SpeakerUtterance[];
  modelId: string;
}

interface EvaluationResult {
  success: boolean;
  analysis?: import('../types/unified').OpenAIEvaluationResult;
  error?: string;
}

export function useEvaluateDialog() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

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
      
      // Always provide toast notification with navigation link
      const currentPath = location.pathname;
      if (currentPath.includes(`/dialog/${dialogId}`)) {
        // User is on the dialog page - navigate to results tab
        navigate(`/dialog/${dialogId}?tab=results`);
        toast.success('AI analysis completed successfully!', {
          action: {
            label: 'View Results',
            onClick: () => navigate(`/dialog/${dialogId}?tab=results`)
          }
        });
      } else {
        // User is elsewhere - show toast with navigation option
        toast.success('AI analysis completed!', {
          description: `Analysis for dialog ${dialogId} is ready`,
          action: {
            label: 'View Results',
            onClick: () => navigate(`/dialog/${dialogId}?tab=results`)
          },
          duration: 10000 // Longer duration for navigation toast
        });
      }
    },
    onError: (error: Error) => {
      console.error('❌ Analysis failed:', error);
      toast.error(`Analysis failed: ${error.message}`);
    }
  });
}