import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';

interface BackgroundAnalysis {
  dialogId: string;
  dialogName: string;
  startTime: number;
}

export const useBackgroundAnalysis = () => {
  const [runningAnalyses, setRunningAnalyses] = useState<BackgroundAnalysis[]>([]);

  const addAnalysis = (dialogId: string, dialogName: string) => {
    setRunningAnalyses(prev => [
      ...prev.filter(a => a.dialogId !== dialogId), // Remove if already exists
      { dialogId, dialogName, startTime: Date.now() }
    ]);
  };

  const removeAnalysis = (dialogId: string) => {
    setRunningAnalyses(prev => prev.filter(a => a.dialogId !== dialogId));
  };

  // Listen for analysis completion events
  useEffect(() => {
    const channel = supabase
      .channel('background-analysis-completion')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dialog_analysis'
        },
        (payload) => {
          const dialogId = payload.new.dialog_id;
          if (dialogId) {
            // Remove from running analyses
            setRunningAnalyses(prev => prev.filter(a => a.dialogId !== dialogId));
            
            // Show completion notification
            const analysis = runningAnalyses.find(a => a.dialogId === dialogId);
            if (analysis) {
              // Will be handled by individual dialog components
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [runningAnalyses]);

  return {
    runningAnalyses,
    addAnalysis,
    removeAnalysis
  };
};