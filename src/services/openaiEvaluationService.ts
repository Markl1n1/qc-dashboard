
import { supabase } from '../integrations/supabase/client';
import { logger } from './loggingService';

interface EvaluationRequest {
  transcript: string;
  criteria: string[];
  context?: string;
  language?: string;
}

interface EvaluationResult {
  id: string;
  scores: Record<string, number>;
  feedback: string;
  suggestions: string[];
  overall_score: number;
  metadata?: any;
}

export class OpenAIEvaluationService {
  /**
   * Evaluate a transcript using OpenAI
   */
  async evaluateTranscript(request: EvaluationRequest): Promise<EvaluationResult> {
    this.validateRequest(request);

    logger.info('Starting OpenAI evaluation', {
      transcriptLength: request.transcript.length,
      criteriaCount: request.criteria.length,
      language: request.language || 'en'
    });

    try {
      const startTime = Date.now();

      const { data, error } = await supabase.functions
        .invoke('openai-evaluate', {
          body: {
            transcript: request.transcript,
            criteria: request.criteria,
            context: request.context,
            language: request.language || 'en',
            model: 'gpt-4',
            temperature: 0.3
          }
        });

      if (error) {
        logger.error('OpenAI evaluation failed', error, {
          transcriptLength: request.transcript.length,
          criteriaCount: request.criteria.length
        });
        throw new Error(`Evaluation failed: ${error.message}`);
      }

      const duration = Date.now() - startTime;
      logger.info('OpenAI evaluation completed', {
        duration: `${duration}ms`,
        overallScore: data.overall_score
      });

      return {
        id: data.id || Math.random().toString(36),
        scores: data.scores || {},
        feedback: data.feedback || '',
        suggestions: data.suggestions || [],
        overall_score: data.overall_score || 0,
        metadata: data.metadata
      };

    } catch (error) {
      logger.error('OpenAI evaluation service error', error as Error, {
        transcriptLength: request.transcript.length
      });
      throw error;
    }
  }

  /**
   * Get evaluation history for a dialog
   */
  async getEvaluationHistory(dialogId: string): Promise<EvaluationResult[]> {
    if (!dialogId?.trim()) {
      throw new Error('Dialog ID is required');
    }

    try {
      const { data, error } = await supabase
        .from('evaluations')
        .select('*')
        .eq('dialog_id', dialogId)
        .eq('evaluation_type', 'openai')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to get evaluation history', error, { dialogId });
        throw new Error(`Failed to get history: ${error.message}`);
      }

      return data.map(item => ({
        id: item.id,
        scores: item.scores || {},
        feedback: item.feedback || '',
        suggestions: item.suggestions || [],
        overall_score: item.overall_score || 0,
        metadata: item.metadata
      }));

    } catch (error) {
      logger.error('Error getting evaluation history', error as Error, { dialogId });
      throw error;
    }
  }

  private validateRequest(request: EvaluationRequest): void {
    if (!request.transcript?.trim()) {
      throw new Error('Transcript is required and cannot be empty');
    }

    if (request.transcript.length > 50000) {
      throw new Error('Transcript exceeds maximum length of 50,000 characters');
    }

    if (!request.criteria || request.criteria.length === 0) {
      throw new Error('At least one evaluation criterion is required');
    }

    if (request.criteria.some(criterion => !criterion?.trim())) {
      throw new Error('All evaluation criteria must be non-empty strings');
    }

    if (request.context && request.context.length > 5000) {
      throw new Error('Context exceeds maximum length of 5,000 characters');
    }
  }
}

export const openaiEvaluationService = new OpenAIEvaluationService();
