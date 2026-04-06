import { useCallback } from 'react';
import { useLanguageStore } from '../store/languageStore';
import { en } from './translations/en';
import { ru } from './translations/ru';

const translations = { en, ru } as const;

type NestedKeyOf<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? NestedKeyOf<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

type TranslationKey = NestedKeyOf<typeof en>;

function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? path;
}

export function useTranslation() {
  const { uiLanguage } = useLanguageStore();

  const t = useCallback(
    (key: string): string => {
      const dict = translations[uiLanguage] || translations.en;
      const value = getNestedValue(dict, key);
      if (value === key) {
        // Fallback to English
        return getNestedValue(translations.en, key);
      }
      return value;
    },
    [uiLanguage]
  );

  return { t, language: uiLanguage };
}
