import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LanguageState {
  commentLanguage: 'original' | 'russian';
  setCommentLanguage: (language: 'original' | 'russian') => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      commentLanguage: 'original',
      setCommentLanguage: (language) => set({ commentLanguage: language }),
    }),
    {
      name: 'voiceqc-language-settings',
    }
  )
);