// Placeholder banned words service
export interface BannedWord {
  word: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
}

export class BannedWordsService {
  private static bannedWords: BannedWord[] = [
    // This would typically be loaded from a database or config
    { word: 'inappropriate', category: 'profanity', severity: 'medium' },
    { word: 'offensive', category: 'inappropriate', severity: 'high' }
  ];

  static async checkForBannedWords(text: string): Promise<BannedWord[]> {
    // Placeholder implementation
    console.log('Checking for banned words in text');
    
    const foundWords: BannedWord[] = [];
    const lowerText = text.toLowerCase();
    
    for (const bannedWord of this.bannedWords) {
      if (lowerText.includes(bannedWord.word.toLowerCase())) {
        foundWords.push(bannedWord);
      }
    }
    
    return foundWords;
  }

  static async getBannedWords(): Promise<BannedWord[]> {
    return [...this.bannedWords];
  }

  static async addBannedWord(word: BannedWord): Promise<void> {
    this.bannedWords.push(word);
  }

  static async removeBannedWord(word: string): Promise<void> {
    this.bannedWords = this.bannedWords.filter(w => w.word !== word);
  }
}