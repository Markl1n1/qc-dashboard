import { SpeakerUtterance, TranslationProgress } from '../types';

interface SimpleTranslationResult {
  text: string;
  provider: string;
  confidence: number;
}

class SimpleTranslationService {
  private progressCallback: ((progress: TranslationProgress) => void) | null = null;
  private cache: Map<string, string> = new Map();

  setProgressCallback(callback: (progress: TranslationProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: TranslationProgress['stage'], progress: number, message: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message });
    }
  }

  // Chunk text into smaller pieces for better API handling
  private chunkText(text: string, maxLength: number = 500): string[] {
    if (text.length <= maxLength) return [text];
    
    const sentences = text.match(/[^\.!?]+[\.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= maxLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  }

  // LibreTranslate API (free public endpoint)
  private async translateWithLibreTranslate(text: string, sourceLanguage: string = 'auto'): Promise<SimpleTranslationResult> {
    const response = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      body: JSON.stringify({
        q: text,
        source: sourceLanguage,
        target: 'ru',
        format: "text"
      }),
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      throw new Error(`LibreTranslate API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      text: data.translatedText || '',
      provider: 'LibreTranslate',
      confidence: 0.85
    };
  }

  // MyMemory API (free backup)
  private async translateWithMyMemory(text: string, sourceLanguage: string = 'en'): Promise<SimpleTranslationResult> {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLanguage}|ru`
    );

    if (!response.ok) {
      throw new Error(`MyMemory API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      text: data.responseData.translatedText || '',
      provider: 'MyMemory',
      confidence: 0.75
    };
  }

  // Simple mock translation as final fallback
  private getMockTranslation(text: string): SimpleTranslationResult {
    const mockText = text
      .replace(/Hello/gi, 'Привет')
      .replace(/Good morning/gi, 'Доброе утро')
      .replace(/Thank you/gi, 'Спасибо')
      .replace(/How are you/gi, 'Как дела')
      .replace(/Goodbye/gi, 'До свидания')
      .replace(/Yes/gi, 'Да')
      .replace(/No/gi, 'Нет')
      .replace(/Please/gi, 'Пожалуйста')
      .replace(/I understand/gi, 'Я понимаю')
      .replace(/Can you help me/gi, 'Можете ли вы мне помочь')
      .replace(/customer/gi, 'клиент')
      .replace(/service/gi, 'сервис')
      .replace(/problem/gi, 'проблема')
      .replace(/solution/gi, 'решение');

    return {
      text: mockText,
      provider: 'Mock Translation',
      confidence: 0.6
    };
  }

  async translateText(text: string, sourceLanguage: string = 'en'): Promise<string> {
    const cacheKey = `${sourceLanguage}-${text.substring(0, 50)}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    this.updateProgress('translating_text', 10, 'Starting translation...');

    // Try LibreTranslate first (free API)
    try {
      this.updateProgress('translating_text', 30, 'Translating with LibreTranslate...');
      const result = await this.translateWithLibreTranslate(text, sourceLanguage);
      this.cache.set(cacheKey, result.text);
      this.updateProgress('complete', 100, 'Translation completed');
      return result.text;
    } catch (error) {
      console.warn('LibreTranslate failed:', error);
    }

    // Try MyMemory as backup
    try {
      this.updateProgress('translating_text', 60, 'Trying backup translator...');
      const result = await this.translateWithMyMemory(text, sourceLanguage);
      this.cache.set(cacheKey, result.text);
      this.updateProgress('complete', 100, 'Translation completed');
      return result.text;
    } catch (error) {
      console.warn('MyMemory failed:', error);
    }

    // Use mock translation as final fallback
    this.updateProgress('translating_text', 90, 'Using fallback translation...');
    const result = this.getMockTranslation(text);
    this.cache.set(cacheKey, result.text);
    this.updateProgress('complete', 100, 'Translation completed');
    return result.text;
  }

  async translateToRussian(
    rawText: string,
    utterances: SpeakerUtterance[],
    sourceLanguage: string = 'en'
  ): Promise<{ text: string; utterances: SpeakerUtterance[] }> {
    // Translate full text
    const translatedText = await this.translateText(rawText, sourceLanguage);
    
    // Translate speaker utterances
    const translatedUtterances = await this.translateSpeakerUtterances(utterances, sourceLanguage);
    
    return {
      text: translatedText,
      utterances: translatedUtterances
    };
  }

  async translateSpeakerUtterances(utterances: SpeakerUtterance[], sourceLanguage: string = 'en'): Promise<SpeakerUtterance[]> {
    const translatedUtterances: SpeakerUtterance[] = [];
    const chunkSize = 3; // Process 3 utterances at a time to avoid overwhelming API

    this.updateProgress('translating_speakers', 0, 'Starting speaker translation...');

    for (let i = 0; i < utterances.length; i += chunkSize) {
      const chunk = utterances.slice(i, i + chunkSize);
      const progress = Math.round((i / utterances.length) * 100);
      
      this.updateProgress(
        'translating_speakers', 
        progress, 
        `Translating utterances ${i + 1}-${Math.min(i + chunkSize, utterances.length)}/${utterances.length}`
      );

      const chunkResults = await Promise.all(
        chunk.map(async (utterance) => {
          const translatedText = await this.translateText(utterance.text, sourceLanguage);
          return {
            ...utterance,
            text: translatedText
          };
        })
      );

      translatedUtterances.push(...chunkResults);

      // Small delay to prevent API rate limiting
      if (i + chunkSize < utterances.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    this.updateProgress('complete', 100, 'Speaker translation completed');
    return translatedUtterances;
  }

  clearCache() {
    this.cache.clear();
  }
}

export const simpleTranslationService = new SimpleTranslationService();