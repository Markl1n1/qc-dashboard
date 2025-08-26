
import { create } from 'zustand';
import { databaseService } from '../services/databaseService';

interface EnhancedSettingsState {
  // Current settings
  maxTokens: number;
  dataRetentionDays: number;
  maxFileSizeMb: number;
  maxConcurrentTranscriptions: number;
  autoDeleteEnabled: boolean;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadSettings: () => Promise<void>;
  updateMaxTokens: (tokens: number) => Promise<void>;
  updateDataRetentionDays: (days: number) => Promise<void>;
  updateMaxFileSizeMb: (sizeMb: number) => Promise<void>;
  updateMaxConcurrentTranscriptions: (count: number) => Promise<void>;
  updateAutoDeleteEnabled: (enabled: boolean) => Promise<void>;
  cleanupExpiredDialogs: () => Promise<number>;
  updateDialogExpirationDates: () => Promise<number>;
  setError: (error: string | null) => void;
}

export const useEnhancedSettingsStore = create<EnhancedSettingsState>((set, get) => ({
  // Default values
  maxTokens: 1000,
  dataRetentionDays: 30,
  maxFileSizeMb: 100,
  maxConcurrentTranscriptions: 5,
  autoDeleteEnabled: true,
  isLoading: false,
  error: null,

  setError: (error: string | null) => set({ error }),

  loadSettings: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const config = await databaseService.getAllSystemConfig();
      
      set({
        maxTokens: parseInt(config.max_tokens || '1000'),
        dataRetentionDays: parseInt(config.data_retention_days || '30'),
        maxFileSizeMb: parseInt(config.max_file_size_mb || '100'),
        maxConcurrentTranscriptions: parseInt(config.max_concurrent_transcriptions || '5'),
        autoDeleteEnabled: config.auto_delete_enabled === 'true',
        isLoading: false
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load settings',
        isLoading: false 
      });
    }
  },

  updateMaxTokens: async (tokens: number) => {
    try {
      set({ error: null });
      await databaseService.updateSystemConfig('max_tokens', tokens.toString());
      set({ maxTokens: tokens });
    } catch (error) {
      console.error('Error updating max tokens:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update max tokens' });
      throw error;
    }
  },

  updateDataRetentionDays: async (days: number) => {
    try {
      set({ error: null });
      await databaseService.updateSystemConfig('data_retention_days', days.toString());
      
      // Update expiration dates for existing dialogs
      await databaseService.updateDialogExpirationDates();
      
      set({ dataRetentionDays: days });
    } catch (error) {
      console.error('Error updating data retention days:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update data retention days' });
      throw error;
    }
  },

  updateMaxFileSizeMb: async (sizeMb: number) => {
    try {
      set({ error: null });
      await databaseService.updateSystemConfig('max_file_size_mb', sizeMb.toString());
      set({ maxFileSizeMb: sizeMb });
    } catch (error) {
      console.error('Error updating max file size:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update max file size' });
      throw error;
    }
  },

  updateMaxConcurrentTranscriptions: async (count: number) => {
    try {
      set({ error: null });
      await databaseService.updateSystemConfig('max_concurrent_transcriptions', count.toString());
      set({ maxConcurrentTranscriptions: count });
    } catch (error) {
      console.error('Error updating max concurrent transcriptions:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update max concurrent transcriptions' });
      throw error;
    }
  },

  updateAutoDeleteEnabled: async (enabled: boolean) => {
    try {
      set({ error: null });
      await databaseService.updateSystemConfig('auto_delete_enabled', enabled.toString());
      set({ autoDeleteEnabled: enabled });
    } catch (error) {
      console.error('Error updating auto delete enabled:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update auto delete setting' });
      throw error;
    }
  },

  cleanupExpiredDialogs: async () => {
    try {
      set({ error: null });
      const deletedCount = await databaseService.cleanupExpiredDialogs();
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired dialogs:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to cleanup expired dialogs' });
      throw error;
    }
  },

  updateDialogExpirationDates: async () => {
    try {
      set({ error: null });
      const updatedCount = await databaseService.updateDialogExpirationDates();
      return updatedCount;
    } catch (error) {
      console.error('Error updating dialog expiration dates:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update dialog expiration dates' });
      throw error;
    }
  }
}));
