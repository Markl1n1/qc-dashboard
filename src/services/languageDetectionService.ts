import { SupportedLanguage, SUPPORTED_LANGUAGES } from '../types/lemurEvaluation';

export interface LanguageDetectionResult {
  primaryLanguage: SupportedLanguage;
  confidence: number;
  detectionMethod: 'assemblyai' | 'heuristic' | 'manual';
  alternativeLanguages?: { language: SupportedLanguage; confidence: number }[];
}

export interface LanguagePromptConfig {
  language: SupportedLanguage;
  systemPromptSuffix: string;
  culturalNotes: string[];
  evaluationEmphasis: string[];
  nativeExamples: boolean;
}

class LanguageDetectionService {
  private readonly languagePromptConfigs: Record<SupportedLanguage, LanguagePromptConfig> = {
    en: {
      language: 'en',
      systemPromptSuffix: 'Focus on professional English communication patterns, clarity, and business etiquette.',
      culturalNotes: [
        'Direct communication is valued',
        'Professional tone should be maintained',
        'Clear and concise language is preferred'
      ],
      evaluationEmphasis: [
        'Grammar and syntax accuracy',
        'Professional vocabulary usage',
        'Clear communication structure'
      ],
      nativeExamples: true
    },
    de: {
      language: 'de',
      systemPromptSuffix: 'Achten Sie auf professionelle deutsche Kommunikationsmuster, formelle Anrede (Sie/Du), und Geschäftsetikette.',
      culturalNotes: [
        'Formal addressing (Sie) is crucial in business',
        'Structured communication is highly valued',
        'Precision and thoroughness are important'
      ],
      evaluationEmphasis: [
        'Correct use of formal/informal addressing',
        'Complex sentence structure handling',
        'Professional German terminology'
      ],
      nativeExamples: true
    },
    pl: {
      language: 'pl',
      systemPromptSuffix: 'Skup się na profesjonalnych polskich wzorcach komunikacji, formalności i etykiecie biznesowej.',
      culturalNotes: [
        'Formal communication is highly respected',
        'Proper case usage is critical',
        'Respectful tone is essential'
      ],
      evaluationEmphasis: [
        'Correct case sensitivity',
        'Formal communication patterns',
        'Professional Polish vocabulary'
      ],
      nativeExamples: true
    },
    es: {
      language: 'es',
      systemPromptSuffix: 'Céntrese en patrones de comunicación profesional en español, formalidad y etiqueta empresarial.',
      culturalNotes: [
        'Respectful and formal tone is important',
        'Regional variations should be considered',
        'Politeness expressions are valued'
      ],
      evaluationEmphasis: [
        'Formal vs informal register usage',
        'Professional Spanish terminology',
        'Cultural communication norms'
      ],
      nativeExamples: true
    },
    fr: {
      language: 'fr',
      systemPromptSuffix: 'Concentrez-vous sur les modèles de communication professionnelle française, la formalité et l\'étiquette commerciale.',
      culturalNotes: [
        'Formal communication protocols are essential',
        'Politeness and courtesy are highly valued',
        'Proper use of vous/tu distinction'
      ],
      evaluationEmphasis: [
        'Formal communication protocols',
        'Professional French terminology',
        'Politeness and courtesy patterns'
      ],
      nativeExamples: true
    },
    ru: {
      language: 'ru',
      systemPromptSuffix: 'Сосредоточьтесь на профессиональных русских образцах общения, формальности и деловом этикете.',
      culturalNotes: [
        'Formal/informal distinctions are crucial',
        'Complex grammar patterns must be respected',
        'Professional terminology is important'
      ],
      evaluationEmphasis: [
        'Complex grammar pattern handling',
        'Formal vs informal communication',
        'Professional Russian vocabulary'
      ],
      nativeExamples: true
    }
  };

  private readonly languagePatterns: Record<SupportedLanguage, RegExp[]> = {
    en: [
      /\b(the|and|is|are|was|were|have|has|will|would|could|should)\b/gi,
      /\b(thank you|please|hello|goodbye|yes|no)\b/gi
    ],
    de: [
      /\b(der|die|das|und|ist|sind|war|waren|haben|hat|wird|würde|könnte|sollte)\b/gi,
      /\b(danke|bitte|hallo|auf wiedersehen|ja|nein|sie|ich|wir)\b/gi
    ],
    pl: [
      /\b(i|a|w|na|z|do|po|dla|że|to|jest|są|był|była|było|mieć|ma)\b/gi,
      /\b(dziękuję|proszę|cześć|do widzenia|tak|nie)\b/gi
    ],
    es: [
      /\b(el|la|los|las|y|es|son|fue|fueron|tiene|tengo|será|sería|podría)\b/gi,
      /\b(gracias|por favor|hola|adiós|sí|no)\b/gi
    ],
    fr: [
      /\b(le|la|les|et|est|sont|était|étaient|avoir|a|sera|serait|pourrait)\b/gi,
      /\b(merci|s'il vous plaît|bonjour|au revoir|oui|non)\b/gi
    ],
    ru: [
      /\b(и|в|на|с|по|для|что|это|есть|был|была|было|иметь|имеет)\b/gi,
      /\b(спасибо|пожалуйста|привет|до свидания|да|нет)\b/gi
    ]
  };

  /**
   * Map internal language codes to AssemblyAI language codes
   */
  getAssemblyAILanguageCode(languageCode: string): string | null {
    const languageMap: Record<string, string> = {
      'en_us': 'en_us',
      'en': 'en_us',
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
      'pl': 'pl',
      'ru': 'ru',
      'uk': 'uk'
    };
    
    return languageMap[languageCode] || null;
  }

  /**
   * Detect language from AssemblyAI transcription result
   */
  detectFromAssemblyAI(transcriptionResult: any): LanguageDetectionResult | null {
    if (transcriptionResult?.language_code) {
      const detectedLang = transcriptionResult.language_code.substring(0, 2) as SupportedLanguage;
      
      if (this.isSupportedLanguage(detectedLang)) {
        return {
          primaryLanguage: detectedLang,
          confidence: transcriptionResult.language_confidence || 0.95,
          detectionMethod: 'assemblyai'
        };
      }
    }
    return null;
  }

  /**
   * Detect language using heuristic text analysis
   */
  detectFromText(text: string): LanguageDetectionResult {
    const scores: Record<SupportedLanguage, number> = {
      en: 0, de: 0, pl: 0, es: 0, fr: 0, ru: 0
    };

    // Count pattern matches for each language
    Object.entries(this.languagePatterns).forEach(([lang, patterns]) => {
      patterns.forEach(pattern => {
        const matches = text.match(pattern) || [];
        scores[lang as SupportedLanguage] += matches.length;
      });
    });

    // Find the language with highest score
    const sortedLanguages = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([lang, score]) => ({ language: lang as SupportedLanguage, score }));

    const totalMatches = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const primaryLanguage = sortedLanguages[0];
    
    // Calculate confidence based on score distribution
    const confidence = totalMatches > 0 
      ? Math.min(0.95, primaryLanguage.score / totalMatches)
      : 0.5; // Low confidence fallback

    return {
      primaryLanguage: primaryLanguage.language,
      confidence,
      detectionMethod: 'heuristic',
      alternativeLanguages: sortedLanguages.slice(1, 3).map(({ language, score }) => ({
        language,
        confidence: totalMatches > 0 ? score / totalMatches : 0
      }))
    };
  }

  /**
   * Create manual language selection result
   */
  createManualSelection(language: SupportedLanguage): LanguageDetectionResult {
    return {
      primaryLanguage: language,
      confidence: 1.0,
      detectionMethod: 'manual'
    };
  }

  /**
   * Comprehensive language detection with fallbacks
   */
  detectLanguage(
    text: string, 
    assemblyAIResult?: any, 
    manualOverride?: SupportedLanguage
  ): LanguageDetectionResult {
    // Priority 1: Manual override
    if (manualOverride && this.isSupportedLanguage(manualOverride)) {
      return this.createManualSelection(manualOverride);
    }

    // Priority 2: AssemblyAI detection
    const assemblyAIDetection = this.detectFromAssemblyAI(assemblyAIResult);
    if (assemblyAIDetection && assemblyAIDetection.confidence > 0.8) {
      return assemblyAIDetection;
    }

    // Priority 3: Heuristic analysis
    const heuristicDetection = this.detectFromText(text);
    
    // If AssemblyAI had low confidence, combine with heuristic
    if (assemblyAIDetection && heuristicDetection.confidence > 0.6) {
      return {
        primaryLanguage: heuristicDetection.primaryLanguage,
        confidence: Math.max(assemblyAIDetection.confidence, heuristicDetection.confidence),
        detectionMethod: 'heuristic',
        alternativeLanguages: [
          { language: assemblyAIDetection.primaryLanguage, confidence: assemblyAIDetection.confidence },
          ...(heuristicDetection.alternativeLanguages || [])
        ]
      };
    }

    return heuristicDetection;
  }

  /**
   * Get language-specific prompt configuration
   */
  getPromptConfig(language: SupportedLanguage): LanguagePromptConfig {
    return this.languagePromptConfigs[language] || this.languagePromptConfigs.en;
  }

  /**
   * Get all supported languages with metadata
   */
  getSupportedLanguages() {
    return SUPPORTED_LANGUAGES;
  }

  /**
   * Validate if language is supported
   */
  isSupportedLanguage(language: string): language is SupportedLanguage {
    return SUPPORTED_LANGUAGES.some(lang => lang.code === language);
  }

  /**
   * Get language name from code
   */
  getLanguageName(code: SupportedLanguage): string {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === code)?.name || code;
  }
}

export const languageDetectionService = new LanguageDetectionService();
