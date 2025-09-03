import { create } from 'zustand';
import { databaseService } from '../services/databaseService';

interface EnhancedSettingsState {
  // Current settings
  maxTokens: number;
  dataRetentionDays: number;
  maxFileSizeMb: number;
  maxConcurrentTranscriptions: number;
  autoDeleteEnabled: boolean;
  aiConfidenceThreshold: number;
  aiReasoningEffort: string;
  aiMaxTokensGpt5: number;
  aiMaxTokensGpt5Mini: number;
  signupPasscode: string;
  
  // Deepgram model language assignments
  deepgramNova2Languages: string[];
  deepgramNova3Languages: string[];
  
  // System config object for easier access
  systemConfig: Record<string, string> | null;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadSettings: () => Promise<void>;
  loadSystemConfig: () => Promise<void>;
  updateSystemConfig: (config: Record<string, string>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  updateMaxTokens: (tokens: number) => Promise<void>;
  updateDataRetentionDays: (days: number) => Promise<void>;
  updateMaxFileSizeMb: (sizeMb: number) => Promise<void>;
  updateMaxConcurrentTranscriptions: (count: number) => Promise<void>;
  updateAutoDeleteEnabled: (enabled: boolean) => Promise<void>;
  updateAiConfidenceThreshold: (threshold: number) => Promise<void>;
  updateAiReasoningEffort: (effort: string) => Promise<void>;
  updateAiMaxTokensGpt5: (tokens: number) => Promise<void>;
  updateAiMaxTokensGpt5Mini: (tokens: number) => Promise<void>;
  updateSignupPasscode: (passcode: string) => Promise<void>;
  updateDeepgramLanguages: (nova2Languages: string[], nova3Languages: string[]) => Promise<void>;
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
  aiConfidenceThreshold: 0.8,
  aiReasoningEffort: 'medium',
  aiMaxTokensGpt5: 2000,
  aiMaxTokensGpt5Mini: 1000,
  signupPasscode: '',
  deepgramNova2Languages: [],
  deepgramNova3Languages: [],
  systemConfig: null,
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
        aiConfidenceThreshold: parseFloat(config.ai_confidence_threshold || '0.8'),
        aiReasoningEffort: config.ai_reasoning_effort || 'medium',
        aiMaxTokensGpt5: parseInt(config.ai_max_tokens_gpt5 || '2000'),
        aiMaxTokensGpt5Mini: parseInt(config.ai_max_tokens_gpt5_mini || '1000'),
        signupPasscode: config.signup_passcode || '',
        deepgramNova2Languages: config.deepgram_nova2_languages ? JSON.parse(config.deepgram_nova2_languages) : ['en'],
        deepgramNova3Languages: config.deepgram_nova3_languages ? JSON.parse(config.deepgram_nova3_languages) : ['es','fr','de','it','pt','ru','zh','ja','ko','ar'],
        systemConfig: config,
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

  loadSystemConfig: async () => {
    // Alias for loadSettings to maintain compatibility
    const { loadSettings } = get();
    await loadSettings();
  },

  updateSystemConfig: async (config: Record<string, string>) => {
    try {
      set({ isLoading: true, error: null });
      
      // Update each config value in the database
      for (const [key, value] of Object.entries(config)) {
        await databaseService.updateSystemConfig(key, value);
      }
      
      // Reload settings to get the updated values
      const { loadSettings } = get();
      await loadSettings();
      
      set({ isLoading: false });
    } catch (error) {
      console.error('Error updating system config:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update system config',
        isLoading: false 
      });
      throw error;
    }
  },

  resetToDefaults: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const defaults = {
        max_tokens: '1000',
        data_retention_days: '30',
        max_file_size_mb: '100',
        max_concurrent_transcriptions: '5',
        auto_delete_enabled: 'true',
        ai_confidence_threshold: '0.8',
        ai_reasoning_effort: 'medium',
        ai_max_tokens_gpt5_mini: '1000',
        ai_max_tokens_gpt5: '2000',
        signup_passcode: ''
      };
      
      // Update each default value
      for (const [key, value] of Object.entries(defaults)) {
        await databaseService.updateSystemConfig(key, value);
      }
      
      // Reload settings
      const { loadSettings } = get();
      await loadSettings();
      
      set({ isLoading: false });
    } catch (error) {
      console.error('Error resetting to defaults:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to reset to defaults',
        isLoading: false 
      });
      throw error;
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

  updateAiConfidenceThreshold: async (threshold: number) => {
    try {
      set({ error: null });
      await databaseService.updateSystemConfig('ai_confidence_threshold', threshold.toString());
      set({ aiConfidenceThreshold: threshold });
    } catch (error) {
      console.error('Error updating AI confidence threshold:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update AI confidence threshold' });
      throw error;
    }
  },


  updateAiReasoningEffort: async (effort: string) => {
    try {
      set({ error: null });
      await databaseService.updateSystemConfig('ai_reasoning_effort', effort);
      set({ aiReasoningEffort: effort });
    } catch (error) {
      console.error('Error updating AI reasoning effort:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update AI reasoning effort' });
      throw error;
    }
  },

  updateAiMaxTokensGpt5: async (tokens: number) => {
    try {
      set({ error: null });
      await databaseService.updateSystemConfig('ai_max_tokens_gpt5', tokens.toString());
      set({ aiMaxTokensGpt5: tokens });
    } catch (error) {
      console.error('Error updating AI max tokens for GPT-5:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update AI max tokens for GPT-5' });
      throw error;
    }
  },

  updateAiMaxTokensGpt5Mini: async (tokens: number) => {
    try {
      set({ error: null });
      await databaseService.updateSystemConfig('ai_max_tokens_gpt5_mini', tokens.toString());
      set({ aiMaxTokensGpt5Mini: tokens });
    } catch (error) {
      console.error('Error updating AI max tokens for GPT-5 Mini:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update AI max tokens for GPT-5 Mini' });
      throw error;
    }
  },

  updateSignupPasscode: async (passcode: string) => {
    try {
      set({ error: null });
      await databaseService.updateSystemConfig('signup_passcode', passcode);
      set({ signupPasscode: passcode });
    } catch (error) {
      console.error('Error updating signup passcode:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update signup passcode' });
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

  updateDeepgramLanguages: async (nova2Languages: string[], nova3Languages: string[]) => {
    try {
      set({ error: null, isLoading: true });
      
      // Update both language configurations
      await databaseService.updateSystemConfig('deepgram_nova2_languages', JSON.stringify(nova2Languages));
      await databaseService.updateSystemConfig('deepgram_nova3_languages', JSON.stringify(nova3Languages));
      
      set({ 
        deepgramNova2Languages: nova2Languages,
        deepgramNova3Languages: nova3Languages,
        isLoading: false 
      });
    } catch (error) {
      console.error('Error updating Deepgram language assignments:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update Deepgram language assignments',
        isLoading: false 
      });
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
