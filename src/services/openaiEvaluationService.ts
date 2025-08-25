
import { SpeakerUtterance } from '../types';
import { OpenAIEvaluationResult, OpenAIEvaluationProgress, OpenAIModel, OPENAI_MODELS, OpenAIEvaluationMistake } from '../types/openaiEvaluation';
import { supabase } from '../integrations/supabase/client';

class OpenAIEvaluationService {
  private progressCallback: ((progress: OpenAIEvaluationProgress) => void) | null = null;
  private lastAttemptedModel: string = '';

  setProgressCallback(callback: (progress: OpenAIEvaluationProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: OpenAIEvaluationProgress['stage'], progress: number, message: string, currentStep?: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message, currentStep });
    }
  }

  getAvailableModels(): OpenAIModel[] {
    return OPENAI_MODELS;
  }

  async evaluateConversation(
    utterances: SpeakerUtterance[],
    modelId: string = 'gpt-5-mini-2025-08-07'
  ): Promise<OpenAIEvaluationResult> {
    const startTime = Date.now();
    
    try {
      this.updateProgress('initializing', 0, 'Preparing evaluation request...');

      const model = OPENAI_MODELS.find(m => m.id === modelId);
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }

      // Store the attempted model for error reporting
      this.lastAttemptedModel = model.name;

      this.updateProgress('analyzing', 20, 'Sending request to OpenAI...');

      const { data, error } = await supabase.functions.invoke('openai-evaluate', {
        body: {
          utterances,
          modelId
        }
      });

      if (error) {
        const errorMessage = `OpenAI API error: ${error.message}. Model attempted: ${this.lastAttemptedModel}`;
        throw new Error(errorMessage);
      }

      this.updateProgress('processing_response', 60, 'Processing OpenAI response...');

      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error(`No response content from OpenAI. Model attempted: ${this.lastAttemptedModel}`);
      }

      let evaluationData;
      try {
        evaluationData = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response as JSON:', content);
        throw new Error(`Invalid JSON response from OpenAI. Model attempted: ${this.lastAttemptedModel}`);
      }

      this.updateProgress('processing_response', 80, 'Formatting results...');

      // Get token usage from the response
      const tokenEstimation = data.tokenEstimation;
      const inputTokens = tokenEstimation?.actualInputTokens || 0;
      const outputTokens = tokenEstimation?.outputTokens || 0;
      const cost = ((inputTokens + outputTokens) / 1000) * model.costPer1kTokens;

      // Ensure mistakes have required fields
      const mistakes: OpenAIEvaluationMistake[] = (evaluationData.mistakes || []).map((mistake: any, index: number) => ({
        id: mistake.id || `mistake_${index}`,
        level: mistake.level || 'minor',
        category: mistake.category || 'other',
        subcategory: mistake.subcategory,
        mistakeName: mistake.mistakeName || mistake.description?.substring(0, 50) || 'Unnamed mistake',
        description: mistake.description || 'No description provided',
        text: mistake.text || '',
        position: mistake.position || 0,
        speaker: mistake.speaker || 'Agent',
        suggestion: mistake.suggestion || 'No suggestion provided',
        impact: mistake.impact || 'low',
        confidence: mistake.confidence || 75,
        timestamp: mistake.timestamp
      }));

      const result: OpenAIEvaluationResult = {
        overallScore: evaluationData.overallScore || 0,
        categoryScores: evaluationData.categoryScores || {},
        mistakes,
        recommendations: evaluationData.recommendations || [],
        summary: evaluationData.summary || 'No summary provided',
        confidence: evaluationData.confidence || 75,
        processingTime: Date.now() - startTime,
        tokenUsage: {
          input: inputTokens,
          output: outputTokens,
          cost
        },
        modelUsed: model.name,
        analysisId: `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      this.updateProgress('complete', 100, 'Evaluation completed successfully');
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Unknown error occurred. Model attempted: ${this.lastAttemptedModel}`;
      console.error('OpenAI evaluation failed:', errorMessage);
      this.updateProgress('error', 0, `Evaluation failed: ${errorMessage}`);
      
      throw new Error(errorMessage);
    }
  }

  validateApiKey(): boolean {
    // API key validation is now handled by the edge function
    return true;
  }

  getLastAttemptedModel(): string {
    return this.lastAttemptedModel;
  }
}

export const openaiEvaluationService = new OpenAIEvaluationService();
