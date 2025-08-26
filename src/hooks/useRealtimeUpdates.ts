
import { useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useEnhancedDialogStore } from '../store/enhancedDialogStore';

export const useRealtimeUpdates = () => {
  const { loadDialogs } = useEnhancedDialogStore();

  useEffect(() => {
    const channel = supabase
      .channel('dialog-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dialogs'
        },
        (payload) => {
          console.log('Dialog change detected:', payload);
          loadDialogs(); // Refresh the dialogs list
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dialog_analysis'
        },
        (payload) => {
          console.log('Analysis change detected:', payload);
          loadDialogs(); // Refresh to update analysis data
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDialogs]);
};
