
import { supabase } from '../integrations/supabase/client';
import { logger } from './loggingService';
import { OpenAIEvaluationProgress } from '../types/openaiEvaluation';

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
  private progressCallback?: (progress: OpenAIEvaluationProgress) => void;

  /**
   * Set progress callback for evaluation updates
   */
  setProgressCallback(callback: (progress: OpenAIEvaluationProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Evaluate a conversation using OpenAI
   */
  async evaluateConversation(utterances: any[], model: string = 'gpt-4'): Promise<any> {
    if (!utterances || utterances.length === 0) {
      throw new Error('No utterances provided for evaluation');
    }

    logger.info('Starting OpenAI conversation evaluation', {
      utteranceCount: utterances.length,
      model
    });

    this.progressCallback?.({
      stage: 'initializing',
      progress: 10,
      message: 'Preparing conversation for analysis...',
      currentStep: 'Processing utterances'
    });

    try {
      const startTime = Date.now();

      // Convert utterances to transcript format
      const transcript = utterances.map(u => `${u.speaker}: ${u.text}`).join('\n');

      this.progressCallback?.({
        stage: 'analyzing',
        progress: 30,
        message: 'Analyzing conversation with AI...',
        currentStep: 'Sending to OpenAI API'
      });

      const { data, error } = await supabase.functions
        .invoke('openai-evaluate', {
          body: {
            transcript,
            criteria: ['professionalism', 'clarity', 'helpfulness', 'resolution'],
            context: 'Customer service conversation analysis',
            language: 'en',
            model,
            temperature: 0.3
          }
        });

      if (error) {
        logger.error('OpenAI evaluation failed', error, {
          utteranceCount: utterances.length,
          model
        });
        this.progressCallback?.({
          stage: 'error',
          progress: 0,
          message: `Evaluation failed: ${error.message}`
        });
        throw new Error(`Evaluation failed: ${error.message}`);
      }

      this.progressCallback?.({
        stage: 'processing_response',
        progress: 80,
        message: 'Processing analysis results...',
        currentStep: 'Formatting response'
      });

      const duration = Date.now() - startTime;
      logger.info('OpenAI conversation evaluation completed', {
        duration: `${duration}ms`,
        model
      });

      this.progressCallback?.({
        stage: 'complete',
        progress: 100,
        message: 'Analysis completed successfully!'
      });

      return {
        overallScore: data.overall_score || 0,
        categoryScores: data.scores || {},
        mistakes: data.mistakes || [],
        recommendations: data.suggestions || [],
        summary: data.feedback || '',
        confidence: 85,
        processingTime: duration,
        tokenUsage: data.metadata?.token_usage || { input: 0, output: 0 },
        modelUsed: model,
        analysisId: data.id || Math.random().toString(36)
      };

    } catch (error) {
      logger.error('OpenAI conversation evaluation service error', error as Error, {
        utteranceCount: utterances.length,
        model
      });
      this.progressCallback?.({
        stage: 'error',
        progress: 0,
        message: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      throw error;
    }
  }

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
        .from('dialog_analysis')
        .select('*')
        .eq('dialog_id', dialogId)
        .eq('analysis_type', 'openai')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to get evaluation history', error, { dialogId });
        throw new Error(`Failed to get history: ${error.message}`);
      }

      return data.map(item => ({
        id: item.id,
        scores: item.category_scores || {},
        feedback: item.summary || '',
        suggestions: item.recommendations || [],
        overall_score: item.overall_score || 0,
        metadata: item.token_usage
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
