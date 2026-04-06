import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LanguageState {
  commentLanguage: 'original' | 'russian';
  uiLanguage: 'en' | 'ru';
  setCommentLanguage: (language: 'original' | 'russian') => void;
  setUiLanguage: (language: 'en' | 'ru') => void;
  toggleUiLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      commentLanguage: 'original',
      uiLanguage: 'en',
      setCommentLanguage: (language) => set({ commentLanguage: language }),
      setUiLanguage: (language) => set({ uiLanguage: language }),
      toggleUiLanguage: () => set({ uiLanguage: get().uiLanguage === 'en' ? 'ru' : 'en' }),
    }),
    {
      name: 'voiceqc-language-settings',
    }
  )
);
