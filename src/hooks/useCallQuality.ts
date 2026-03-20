import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

export interface QualityIssue {
  type: string;
  timestamp: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CategoryScore {
  score: number;
  issues: string[];
}

export interface CallQualityData {
  overall_score: number;
  categories: {
    audioClarity: CategoryScore;
    connectionStability: CategoryScore;
    interruptions: CategoryScore;
    communication: CategoryScore;
  };
  details: QualityIssue[];
  created_at: string;
}

export function useCallQuality(dialogId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['call-quality', dialogId],
    queryFn: async (): Promise<CallQualityData | null> => {
      if (!dialogId) return null;
      const { data, error } = await supabase
        .from('call_quality_analysis')
        .select('*')
        .eq('dialog_id', dialogId)
        .maybeSingle();
      
      if (error) throw error;
      return data as CallQualityData | null;
    },
    enabled: !!dialogId,
    staleTime: 5 * 60 * 1000,
  });

  const analyzeMutation = useMutation({
    mutationFn: async (utterances: any[]) => {
      const { data, error } = await supabase.functions.invoke('call-quality-analyze', {
        body: { dialogId, utterances }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-quality', dialogId] });
      toast.success('Call quality analysis complete');
    },
    onError: (err: Error) => {
      toast.error(`Call quality analysis failed: ${err.message}`);
    }
  });

  return {
    qualityData: query.data,
    isLoading: query.isLoading,
    isAnalyzing: analyzeMutation.isPending,
    analyzeQuality: analyzeMutation.mutate,
  };
}
