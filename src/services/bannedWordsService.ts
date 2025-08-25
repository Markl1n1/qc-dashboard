import { BannedWord, SupportedLanguage } from '../types/lemurEvaluation';

class BannedWordsService {
  private storageKey = 'lemur_banned_words';

  // Default banned words by language
  private defaultBannedWords: Record<SupportedLanguage, BannedWord[]> = {
    en: [
      {
        id: 'en_profanity_1',
        word: 'damn',
        language: 'en',
        severity: 'warning',
        category: 'profanity',
        replacement: 'darn'
      },
      {
        id: 'en_inappropriate_1',
        word: 'stupid',
        language: 'en',
        severity: 'critical',
        category: 'inappropriate',
        replacement: 'challenging'
      },
      {
        id: 'en_competitive_1',
        word: 'competitor',
        language: 'en',
        severity: 'warning',
        category: 'competitive',
        context: 'When comparing directly'
      }
    ],
    de: [
      {
        id: 'de_profanity_1',
        word: 'scheiße',
        language: 'de',
        severity: 'critical',
        category: 'profanity',
        replacement: 'problematisch'
      },
      {
        id: 'de_inappropriate_1',
        word: 'dumm',
        language: 'de',
        severity: 'critical',
        category: 'inappropriate',
        replacement: 'herausfordernd'
      }
    ],
    pl: [
      {
        id: 'pl_profanity_1',
        word: 'cholera',
        language: 'pl',
        severity: 'critical',
        category: 'profanity'
      },
      {
        id: 'pl_inappropriate_1',
        word: 'głupi',
        language: 'pl',
        severity: 'critical',
        category: 'inappropriate',
        replacement: 'trudny'
      }
    ],
    es: [
      {
        id: 'es_profanity_1',
        word: 'mierda',
        language: 'es',
        severity: 'critical',
        category: 'profanity'
      },
      {
        id: 'es_inappropriate_1',
        word: 'estúpido',
        language: 'es',
        severity: 'critical',
        category: 'inappropriate',
        replacement: 'desafiante'
      }
    ],
    fr: [
      {
        id: 'fr_profanity_1',
        word: 'merde',
        language: 'fr',
        severity: 'critical',
        category: 'profanity'
      },
      {
        id: 'fr_inappropriate_1',
        word: 'stupide',
        language: 'fr',
        severity: 'critical',
        category: 'inappropriate',
        replacement: 'difficile'
      }
    ],
    ru: [
      {
        id: 'ru_profanity_1',
        word: 'черт',
        language: 'ru',
        severity: 'warning',
        category: 'profanity'
      },
      {
        id: 'ru_inappropriate_1',
        word: 'глупый',
        language: 'ru',
        severity: 'critical',
        category: 'inappropriate',
        replacement: 'сложный'
      }
    ]
  };

  getBannedWords(language?: SupportedLanguage): BannedWord[] {
    const stored = this.getStoredBannedWords();
    
    if (language) {
      return stored.filter(word => word.language === language);
    }
    
    return stored;
  }

  addBannedWord(word: BannedWord): void {
    const stored = this.getStoredBannedWords();
    const updated = [...stored.filter(w => w.id !== word.id), word];
    this.saveBannedWords(updated);
  }

  updateBannedWord(wordId: string, updates: Partial<BannedWord>): void {
    const stored = this.getStoredBannedWords();
    const updated = stored.map(word => 
      word.id === wordId ? { ...word, ...updates } : word
    );
    this.saveBannedWords(updated);
  }

  removeBannedWord(wordId: string): void {
    const stored = this.getStoredBannedWords();
    const updated = stored.filter(word => word.id !== wordId);
    this.saveBannedWords(updated);
  }

  detectBannedWords(text: string, language: SupportedLanguage): BannedWord[] {
    const bannedWords = this.getBannedWords(language);
    const detected: BannedWord[] = [];
    
    const normalizedText = text.toLowerCase();
    
    bannedWords.forEach(bannedWord => {
      const regex = new RegExp(`\\b${bannedWord.word.toLowerCase()}\\b`, 'gi');
      if (regex.test(normalizedText)) {
        detected.push(bannedWord);
      }
    });
    
    return detected;
  }

  // Check if banned words are present in utterances
  checkUtterancesForBannedWords(utterances: { speaker: string; text: string }[], language: SupportedLanguage): { utteranceIndex: number; bannedWords: BannedWord[] }[] {
    const results: { utteranceIndex: number; bannedWords: BannedWord[] }[] = [];
    
    utterances.forEach((utterance, index) => {
      const detected = this.detectBannedWords(utterance.text, language);
      if (detected.length > 0) {
        results.push({
          utteranceIndex: index,
          bannedWords: detected
        });
      }
    });
    
    return results;
  }

  private getStoredBannedWords(): BannedWord[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load banned words from storage:', error);
    }
    
    // Return default banned words if nothing stored
    return Object.values(this.defaultBannedWords).flat();
  }

  private saveBannedWords(words: BannedWord[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(words));
    } catch (error) {
      console.error('Failed to save banned words to storage:', error);
    }
  }

  // Initialize with default words if empty
  initializeDefaults(): void {
    const stored = this.getStoredBannedWords();
    if (stored.length === 0) {
      const allDefaults = Object.values(this.defaultBannedWords).flat();
      this.saveBannedWords(allDefaults);
    }
  }

  // Export/Import functionality
  exportBannedWords(): string {
    return JSON.stringify(this.getStoredBannedWords(), null, 2);
  }

  importBannedWords(jsonData: string): void {
    try {
      const words: BannedWord[] = JSON.parse(jsonData);
      this.saveBannedWords(words);
    } catch (error) {
      throw new Error('Invalid JSON format for banned words import');
    }
  }

  // Get statistics
  getStatistics(): Record<SupportedLanguage, { total: number; critical: number; warning: number }> {
    const words = this.getStoredBannedWords();
    const stats: Record<string, { total: number; critical: number; warning: number }> = {};
    
    Object.keys(this.defaultBannedWords).forEach(lang => {
      const langWords = words.filter(w => w.language === lang);
      stats[lang] = {
        total: langWords.length,
        critical: langWords.filter(w => w.severity === 'critical').length,
        warning: langWords.filter(w => w.severity === 'warning').length
      };
    });
    
    return stats as Record<SupportedLanguage, { total: number; critical: number; warning: number }>;
  }
}

export const bannedWordsService = new BannedWordsService();