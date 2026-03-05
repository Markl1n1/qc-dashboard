
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  maxTokens: number;
  setMaxTokens: (tokens: number) => void;
  noiseReduction: boolean;
  setNoiseReduction: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      maxTokens: 1000,
      setMaxTokens: (tokens: number) => set({ maxTokens: tokens }),
      noiseReduction: true,
      setNoiseReduction: (enabled: boolean) => set({ noiseReduction: enabled }),
    }),
    {
      name: 'voiceqc-settings',
    }
  )
);
