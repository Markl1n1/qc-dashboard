import { supabase } from '../integrations/supabase/client';
import { logger } from './loggingService';
import { aiInstructionsService } from './aiInstructionsService';
import { SpeakerUtterance } from '../types';
import { OpenAIEvaluationResult, OpenAIEvaluationProgress } from '../types/openaiEvaluation';

interface Settings {
  aiConfidenceThreshold: number;
  aiEvaluationModel: string;
  openaiApiKey: string;
}

interface EvaluationParams {
  dialogId: string;
  text: string;
  speakerUtterances: SpeakerUtterance[];
  settings: Settings;
  progressCallback: (progress: OpenAIEvaluationProgress) => void;
}

class OpenAIEvaluationService {
  private apiKey: string | null = null;
  private model: string | null = null;
  private confidenceThreshold: number = 0.75;
  private progressCallback: ((progress: OpenAIEvaluationProgress) => void) | null = null;

  async initialize(): Promise<void> {
    try {
      const config = await this.fetchSettings();
      this.apiKey = config.openaiApiKey;
      this.model = config.aiEvaluationModel;
      this.confidenceThreshold = config.aiConfidenceThreshold;

      if (!this.apiKey) {
        logger.warn('OpenAI API key is not set. OpenAI evaluations will be disabled.');
      }
    } catch (error) {
      logger.error('Failed to initialize OpenAI Evaluation Service', error);
      throw new Error('Failed to initialize OpenAI Evaluation Service');
    }
  }

  setProgressCallback(callback: (progress: OpenAIEvaluationProgress) => void): void {
    this.progressCallback = callback;
  }

  async evaluateConversation(utterances: SpeakerUtterance[], model: string): Promise<OpenAIEvaluationResult> {
    if (!this.apiKey) {
      await this.initialize();
    }

    const startTime = Date.now();
    const text = utterances.map(u => `${u.speaker}: ${u.text}`).join('\n');
    
    try {
      this.progressCallback?.({ stage: 'initializing', message: 'Preparing evaluation', progress: 0 });

      const instructions = await aiInstructionsService.getLatestInstructions('evaluation') || 'Please evaluate this conversation.';
      const prompt = this.constructPrompt(text, utterances, instructions);

      this.progressCallback?.({ stage: 'analyzing', message: 'Prompt ready, sending to OpenAI', progress: 0.1 });

      const evaluation = await this.getOpenAIResponse(prompt, model);

      this.progressCallback?.({ stage: 'processing_response', message: 'Response received from OpenAI', progress: 0.6 });

      const parsedResult = this.parseOpenAIResponse(evaluation);

      this.progressCallback?.({ stage: 'processing_response', message: 'Parsing complete', progress: 0.8 });

      const validatedResult = this.validateResult(parsedResult, this.confidenceThreshold);
      
      // Add missing fields
      const finalResult: OpenAIEvaluationResult = {
        ...validatedResult,
        processingTime: Date.now() - startTime,
        modelUsed: model,
        analysisId: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      logger.info(`OpenAI evaluation completed`);
      this.progressCallback?.({ stage: 'complete', message: 'Evaluation complete', progress: 1 });

      return finalResult;
    } catch (error: any) {
      await this.handleApiError(error, 'evaluate');
      throw error;
    }
  }

  private async fetchSettings(): Promise<Settings> {
    const aiConfidenceThreshold = await supabase.from('system_config').select('value').eq('key', 'ai_confidence_threshold').single();
    const aiEvaluationModel = await supabase.from('system_config').select('value').eq('key', 'ai_evaluation_model').single();
    const openaiApiKey = await supabase.from('system_config').select('value').eq('key', 'openai_api_key').single();

    return {
      aiConfidenceThreshold: aiConfidenceThreshold.data?.value ? parseFloat(aiConfidenceThreshold.data.value) : 0.75,
      aiEvaluationModel: aiEvaluationModel.data?.value || 'gpt-3.5-turbo',
      openaiApiKey: openaiApiKey.data?.value || '',
    };
  }

  async evaluate(params: EvaluationParams): Promise<OpenAIEvaluationResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not set. Cannot perform evaluation.');
    }

    try {
      const { dialogId, text, speakerUtterances, settings, progressCallback } = params;

      progressCallback({ stage: 'initializing', message: 'Preparing evaluation', progress: 0 });

      const instructions = await aiInstructionsService.getLatestInstructions('evaluation') || 'Please evaluate this conversation.';
      const prompt = this.constructPrompt(text, speakerUtterances, instructions);

      progressCallback({ stage: 'analyzing', message: 'Prompt ready, sending to OpenAI', progress: 0.1 });

      const evaluation = await this.getOpenAIResponse(prompt, settings.aiEvaluationModel);

      progressCallback({ stage: 'processing_response', message: 'Response received from OpenAI', progress: 0.6 });

      const parsedResult = this.parseOpenAIResponse(evaluation);

      progressCallback({ stage: 'processing_response', message: 'Parsing complete', progress: 0.8 });

      const validatedResult = this.validateResult(parsedResult, settings.aiConfidenceThreshold);

      progressCallback({ stage: 'complete', message: 'Validation complete', progress: 0.9 });

      logger.info(`OpenAI evaluation completed for dialog ${dialogId}`);
      progressCallback({ stage: 'complete', message: 'Evaluation complete', progress: 1 });

      return validatedResult;
    } catch (error: any) {
      await this.handleApiError(error, 'evaluate');
      throw error;
    }
  }

  private constructPrompt(text: string, speakerUtterances: SpeakerUtterance[], instructions: string): string {
    const speakerLines = speakerUtterances.map(u => `${u.speaker}: ${u.text}`).join('\n');

    return `${instructions}
      
      Transcription:
      ${speakerLines}
      
      Summary:
      ${text}
      `;
  }

  private async getOpenAIResponse(prompt: string, model: string): Promise<any> {
    const url = 'https://api.openai.com/v1/chat/completions';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    const body = JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: body,
      });

      if (!response.ok) {
        throw new Error(`OpenAI API responded with status: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      logger.error('Error during OpenAI API request', error);
      throw error;
    }
  }

  private parseOpenAIResponse(response: any): OpenAIEvaluationResult {
    try {
      const content = response.choices[0].message.content;
      const parsed = JSON.parse(content);

      return {
        overallScore: parsed.overallScore,
        categoryScores: parsed.categoryScores,
        mistakes: parsed.mistakes,
        recommendations: parsed.recommendations,
        summary: parsed.summary,
        confidence: parsed.confidence,
        tokenUsage: {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
          cost: 0
        },
        processingTime: 0,
        modelUsed: '',
        analysisId: ''
      };
    } catch (error: any) {
      logger.error('Failed to parse OpenAI response', error, { response });
      throw new Error('Failed to parse OpenAI response. Please ensure the response is a valid JSON.');
    }
  }

  private validateResult(result: OpenAIEvaluationResult, confidenceThreshold: number): OpenAIEvaluationResult {
    if (result.confidence < confidenceThreshold) {
      logger.warn(`OpenAI evaluation confidence is low (${result.confidence}). Results may be inaccurate.`);
    }

    return result;
  }

  private async handleApiError(error: any, context: string): Promise<never> {
    logger.error(`OpenAI API error in ${context}`, error);
    
    if (error.response?.status === 401) {
      throw new Error('Invalid OpenAI API key. Please check your settings.');
    }
    
    if (error.response?.status === 429) {
      throw new Error('OpenAI API rate limit exceeded. Please try again later.');
    }
    
    if (error.response?.status >= 500) {
      throw new Error('OpenAI service is temporarily unavailable. Please try again later.');
    }
    
    throw new Error(error.message || `OpenAI evaluation failed: ${context}`);
  }
}

export const openaiEvaluationService = new OpenAIEvaluationService();
