
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  openaiMaxTokens: number;
  setOpenaiMaxTokens: (tokens: number) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      openaiMaxTokens: 1000,
      setOpenaiMaxTokens: (tokens: number) => {
        set({ openaiMaxTokens: tokens });
      },
    }),
    {
      name: 'voiceqc-settings',
    }
  )
);
