
import { supabase } from '../integrations/supabase/client';
import { logger } from './loggingService';

interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
  preserveFormatting?: boolean;
}

interface TranslationResult {
  id: string;
  translatedText: string;
  confidence: number;
  detectedLanguage?: string;
  metadata?: any;
}

export class EnhancedTranslationService {
  private readonly maxTextLength = 10000;
  private readonly supportedLanguages = [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'
  ];

  /**
   * Translate text with enhanced error handling and validation
   */
  async translateText(request: TranslationRequest): Promise<TranslationResult> {
    this.validateTranslationRequest(request);

    logger.info('Starting translation', {
      textLength: request.text.length,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage
    });

    try {
      const startTime = Date.now();

      const { data, error } = await supabase.functions
        .invoke('translate-text', {
          body: {
            text: request.text,
            source_language: request.sourceLanguage,
            target_language: request.targetLanguage,
            context: request.context,
            preserve_formatting: request.preserveFormatting !== false
          }
        });

      if (error) {
        logger.error('Translation failed', error, {
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage,
          textLength: request.text.length
        });
        throw new Error(`Translation failed: ${error.message}`);
      }

      const duration = Date.now() - startTime;
      logger.info('Translation completed', {
        duration: `${duration}ms`,
        confidence: data.confidence,
        detectedLanguage: data.detected_language
      });

      return {
        id: data.id || Math.random().toString(36),
        translatedText: data.translated_text || '',
        confidence: data.confidence || 0,
        detectedLanguage: data.detected_language,
        metadata: data.metadata
      };

    } catch (error) {
      logger.error('Translation service error', error as Error, {
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage
      });
      throw error;
    }
  }

  /**
   * Batch translate multiple texts
   */
  async batchTranslate(
    texts: string[], 
    sourceLanguage: string, 
    targetLanguage: string
  ): Promise<TranslationResult[]> {
    if (!texts || texts.length === 0) {
      throw new Error('At least one text is required for batch translation');
    }

    if (texts.length > 50) {
      throw new Error('Maximum 50 texts allowed per batch');
    }

    logger.info('Starting batch translation', {
      textCount: texts.length,
      sourceLanguage,
      targetLanguage
    });

    const results: TranslationResult[] = [];
    const errors: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      try {
        const result = await this.translateText({
          text: texts[i],
          sourceLanguage,
          targetLanguage
        });
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Text ${i + 1}: ${errorMessage}`);
        logger.warn('Batch translation item failed', {
          textIndex: i,
          error: errorMessage
        });
      }
    }

    if (errors.length > 0) {
      logger.warn('Batch translation completed with errors', {
        successCount: results.length,
        errorCount: errors.length,
        errors: errors.slice(0, 5) // Log first 5 errors
      });
    } else {
      logger.info('Batch translation completed successfully', {
        translatedCount: results.length
      });
    }

    return results;
  }

  private validateTranslationRequest(request: TranslationRequest): void {
    if (!request.text?.trim()) {
      throw new Error('Text is required and cannot be empty');
    }

    if (request.text.length > this.maxTextLength) {
      throw new Error(`Text exceeds maximum length of ${this.maxTextLength} characters`);
    }

    if (!request.sourceLanguage?.trim()) {
      throw new Error('Source language is required');
    }

    if (!request.targetLanguage?.trim()) {
      throw new Error('Target language is required');
    }

    if (!this.supportedLanguages.includes(request.sourceLanguage)) {
      throw new Error(`Unsupported source language: ${request.sourceLanguage}`);
    }

    if (!this.supportedLanguages.includes(request.targetLanguage)) {
      throw new Error(`Unsupported target language: ${request.targetLanguage}`);
    }

    if (request.sourceLanguage === request.targetLanguage) {
      throw new Error('Source and target languages cannot be the same');
    }

    if (request.context && request.context.length > 1000) {
      throw new Error('Context exceeds maximum length of 1,000 characters');
    }
  }
}

export const enhancedTranslationService = new EnhancedTranslationService();
