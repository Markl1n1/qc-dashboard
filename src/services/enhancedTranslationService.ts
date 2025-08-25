import { SpeakerUtterance, TranslationProgress } from '../types';
import { 
  TranslationProvider, 
  TranslationResult, 
  MultiProviderTranslationResult,
  APIKeyConfig 
} from '../types/aiAnalysis';
import { translationService } from './translationService';
// Translation service no longer uses external APIs

class EnhancedTranslationService {
  private progressCallback: ((progress: TranslationProgress) => void) | null = null;
  private cache: Map<string, MultiProviderTranslationResult> = new Map();

  // Provider configurations
  private providers: TranslationProvider[] = [
    {
      name: 'OpenAI GPT-3.5-Turbo',
      type: 'openai',
      enabled: false,
      priority: 1,
      supportedLanguages: ['ru', 'pl', 'de', 'es', 'fr', 'uk', 'bg', 'cs', 'sk'],
      costPerUnit: 0.001
    },
    {
      name: 'Google Translate',
      type: 'google',
      enabled: false,
      priority: 2,
      supportedLanguages: ['ru', 'pl', 'de', 'es', 'fr', 'uk', 'bg', 'cs', 'sk'],
      costPerUnit: 0.02
    },
    {
      name: 'LibreTranslate',
      type: 'libretranslate',
      enabled: false,
      priority: 3,
      supportedLanguages: ['ru', 'pl', 'de', 'es', 'fr', 'uk', 'bg', 'cs', 'sk'],
      costPerUnit: 0
    },
    {
      name: 'Hugging Face (Local)',
      type: 'huggingface',
      enabled: true,
      priority: 4,
      supportedLanguages: ['ru', 'pl', 'de', 'es', 'fr'],
      costPerUnit: 0
    }
  ];

  setProgressCallback(callback: (progress: TranslationProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: TranslationProgress['stage'], progress: number, message: string, currentProvider?: string, currentUtterance?: number, totalUtterances?: number) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message, currentProvider, currentUtterance, totalUtterances });
    }
  }

  setAPIKeys(keys: APIKeyConfig) {
    // No longer using external API keys
    this.updateProviderStatus();
  }

  getAPIKeys(): APIKeyConfig {
    return { isValid: false };
  }

  private updateProviderStatus() {
    const apiKeys = this.getAPIKeys();
    this.providers.forEach(provider => {
      switch (provider.type) {
        case 'openai':
          provider.enabled = Boolean(apiKeys.openai);
          break;
        case 'google':
          provider.enabled = Boolean(apiKeys.google);
          break;
        case 'libretranslate':
          provider.enabled = Boolean(apiKeys.libretranslate);
          break;
        case 'huggingface':
          provider.enabled = true; // Always available
          break;
      }
    });
  }

  async validateAPIKey(provider: 'openai' | 'google' | 'libretranslate', apiKey: string): Promise<boolean> {
    return false; // External APIs no longer supported
  }

  private async validateOpenAIKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async validateGoogleKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2/languages?key=${apiKey}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  private async validateLibreTranslateKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch("https://libretranslate.com/translate", {
        method: "POST",
        body: JSON.stringify({
          q: "Test",
          source: "auto",
          target: "es",
          format: "text",
          api_key: apiKey
        }),
        headers: { "Content-Type": "application/json" }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async translateWithOpenAI(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'en'
  ): Promise<TranslationResult> {
    const apiKeys = this.getAPIKeys();
    if (!apiKeys.openai) throw new Error('OpenAI API key not configured');

    const startTime = Date.now();
    
    const prompt = `Translate the following ${sourceLanguage} text to ${targetLanguage}. 
    This is from a customer service dialog, so maintain the conversational tone and context.
    Only return the translation, no explanations:

    "${text}"`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeys.openai}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const translatedText = data.choices[0]?.message?.content?.trim() || '';

    return {
      text: translatedText,
      provider: 'OpenAI GPT-3.5-Turbo',
      confidence: 0.95,
      cost: this.calculateCost(text, 'openai'),
      processingTime: Date.now() - startTime
    };
  }

  private async translateWithGoogle(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'en'
  ): Promise<TranslationResult> {
    const apiKeys = this.getAPIKeys();
    if (!apiKeys.google) throw new Error('Google API key not configured');

    const startTime = Date.now();
    
    const response = await fetch('https://translation.googleapis.com/language/translate/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: apiKeys.google,
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: 'text'
      })
    });

    if (!response.ok) {
      throw new Error(`Google Translate API error: ${response.statusText}`);
    }

    const data = await response.json();
    const translatedText = data.data.translations[0]?.translatedText || '';

    return {
      text: translatedText,
      provider: 'Google Translate',
      confidence: 0.9,
      cost: this.calculateCost(text, 'google'),
      processingTime: Date.now() - startTime
    };
  }

  private async translateWithLibreTranslate(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'auto'
  ): Promise<TranslationResult> {
    const apiKeys = this.getAPIKeys();
    if (!apiKeys.libretranslate) throw new Error('LibreTranslate API key not configured');

    const startTime = Date.now();
    
    const response = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      body: JSON.stringify({
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: "text",
        alternatives: 3,
        api_key: apiKeys.libretranslate
      }),
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      throw new Error(`LibreTranslate API error: ${response.statusText}`);
    }

    const data = await response.json();
    const translatedText = data.translatedText || '';

    return {
      text: translatedText,
      provider: 'LibreTranslate',
      confidence: 0.85,
      cost: 0,
      processingTime: Date.now() - startTime
    };
  }

  private async translateWithHuggingFace(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'en'
  ): Promise<TranslationResult> {
    const startTime = Date.now();
    
    try {
      const result = await translationService.translateText(text, targetLanguage, sourceLanguage);
      
      return {
        text: result,
        provider: 'Hugging Face (Local)',
        confidence: 0.75,
        cost: 0,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Hugging Face translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private calculateCost(text: string, provider: 'openai' | 'google'): number {
    const wordCount = text.split(/\s+/).length;
    const providerConfig = this.providers.find(p => p.type === provider);
    return (providerConfig?.costPerUnit || 0) * wordCount / 1000;
  }

  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'en',
    useMultipleProviders: boolean = false
  ): Promise<MultiProviderTranslationResult> {
    const cacheKey = `${sourceLanguage}-${targetLanguage}-${text.substring(0, 50)}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    this.updateProgress('translating_text', 0, 'Starting translation...', targetLanguage);

    const availableProviders = this.providers
      .filter(p => p.enabled && p.supportedLanguages.includes(targetLanguage))
      .sort((a, b) => a.priority - b.priority);

    if (availableProviders.length === 0) {
      throw new Error(`No available providers for ${sourceLanguage} → ${targetLanguage} translation`);
    }

    const results: TranslationResult[] = [];
    let primaryResult: TranslationResult | null = null;

    // Try providers in order of priority
    for (let i = 0; i < availableProviders.length; i++) {
      const provider = availableProviders[i];
      
      try {
        this.updateProgress(
          'translating_text',
          (i / availableProviders.length) * 80,
          `Translating with ${provider.name}...`,
          targetLanguage
        );

        let result: TranslationResult;
        
        switch (provider.type) {
          case 'openai':
            result = await this.translateWithOpenAI(text, targetLanguage, sourceLanguage);
            break;
          case 'google':
            result = await this.translateWithGoogle(text, targetLanguage, sourceLanguage);
            break;
          case 'libretranslate':
            result = await this.translateWithLibreTranslate(text, targetLanguage, sourceLanguage);
            break;
          case 'huggingface':
            result = await this.translateWithHuggingFace(text, targetLanguage, sourceLanguage);
            break;
          default:
            continue;
        }

        results.push(result);
        
        if (!primaryResult) {
          primaryResult = result;
        }

        // If we got a good result and not using multiple providers, break
        if (!useMultipleProviders && result.confidence > 0.8) {
          break;
        }

      } catch (error) {
        console.error(`Translation failed with ${provider.name}:`, error);
        continue;
      }
    }

    if (!primaryResult) {
      throw new Error('All translation providers failed');
    }

    // Calculate quality score based on confidence and provider priority
    const qualityScore = Math.min(
      primaryResult.confidence * 100,
      100 - (availableProviders.findIndex(p => p.name === primaryResult.provider) * 10)
    );

    const finalResult: MultiProviderTranslationResult = {
      primary: primaryResult,
      alternatives: results.slice(1),
      qualityScore: qualityScore
    };

    // Cache result
    this.cache.set(cacheKey, finalResult);

    this.updateProgress('complete', 100, 'Translation completed', targetLanguage);
    
    return finalResult;
  }

  async translateSpeakerUtterances(
    utterances: SpeakerUtterance[],
    targetLanguage: string,
    sourceLanguage: string = 'en'
  ): Promise<SpeakerUtterance[]> {
    const translatedUtterances: SpeakerUtterance[] = [];

    for (let i = 0; i < utterances.length; i++) {
      this.updateProgress(
        'translating_speakers',
        (i / utterances.length) * 100,
        `Translating utterance ${i + 1}/${utterances.length}`,
        targetLanguage,
        i + 1,
        utterances.length
      );

      const utterance = utterances[i];
      const result = await this.translateText(utterance.text, targetLanguage, sourceLanguage);

      translatedUtterances.push({
        ...utterance,
        text: result.primary.text
      });
    }

    return translatedUtterances;
  }

  getAvailableProviders(): TranslationProvider[] {
    return this.providers.filter(p => p.enabled);
  }

  clearCache() {
    this.cache.clear();
  }
}

export const enhancedTranslationService = new EnhancedTranslationService();