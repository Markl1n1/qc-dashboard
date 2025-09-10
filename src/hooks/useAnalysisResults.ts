import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDatabaseDialogs } from './useDatabaseDialogs';

export function useAnalysisResults(dialogId: string) {
  const queryClient = useQueryClient();
  const { getDialog } = useDatabaseDialogs();

  return useQuery({
    queryKey: ['analysis', dialogId],
    queryFn: async () => {
      console.log('🔍 Fetching analysis data for dialog:', dialogId);
      const dialog = await getDialog(dialogId);
      
      if (!dialog?.openaiEvaluation) {
        console.log('⚠️ No analysis data found');
        return null;
      }
      
      console.log('✅ Analysis data loaded from database');
      return dialog.openaiEvaluation;
    },
    // Instant render on first load after analysis completion (cache priming)
    initialData: () => {
      const cachedData = queryClient.getQueryData(['analysis', dialogId]);
      if (cachedData) {
        console.log('⚡️ Using cached analysis data for instant render');
      }
      return cachedData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes (was cacheTime)
  });
}