
import { useEffect } from 'react';
import { useEnhancedDialogStore } from '../store/enhancedDialogStore';
import { useAuthStore } from '../store/authStore';

export const useDatabaseDialogs = () => {
  const { isAuthenticated } = useAuthStore();
  const {
    dialogs,
    isLoading,
    error,
    loadDialogs,
    addDialog,
    updateDialog,
    deleteDialog,
    getDialog,
    saveTranscription,
    saveSpeakerTranscription,
    saveAnalysis,
    clearDialogs
  } = useEnhancedDialogStore();

  useEffect(() => {
    if (isAuthenticated) {
      loadDialogs();
    } else {
      clearDialogs();
    }
  }, [isAuthenticated, loadDialogs, clearDialogs]);

  return {
    dialogs,
    isLoading,
    error,
    loadDialogs,
    addDialog,
    updateDialog,
    deleteDialog,
    getDialog,
    saveTranscription,
    saveSpeakerTranscription,
    saveAnalysis,
    clearDialogs
  };
};
