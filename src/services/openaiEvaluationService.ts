import { logger } from './loggingService';
import { databaseService } from './databaseService';
import { aiInstructionsService } from './aiInstructionsService';

export interface OpenAIEvaluationResult {
  overallScore: number;
  strengths: string[];
  areasForImprovement: string[];
  recommendations: string[];
  conversationHighlights: string[];
  rawOutput: string;
  tokenEstimation: {
    actualInputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

interface Settings {
  aiConfidenceThreshold: number;
  aiTemperature: number;
  aiReasoningEffort: string;
  aiMaxTokensGpt5Mini: number;
  aiMaxTokensGpt5: number;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_REASONING_EFFORT = 'medium';
const DEFAULT_MAX_TOKENS_GPT5_MINI = 1000;
const DEFAULT_MAX_TOKENS_GPT5 = 2000;

class OpenAIEvaluationService {

  private async getSettings(): Promise<Settings> {
    try {
      const config = await databaseService.getAllSystemConfig();

      return {
        aiConfidenceThreshold: parseFloat(config.ai_confidence_threshold || DEFAULT_CONFIDENCE_THRESHOLD.toString()),
        aiTemperature: parseFloat(config.ai_temperature || DEFAULT_TEMPERATURE.toString()),
        aiReasoningEffort: config.ai_reasoning_effort || DEFAULT_REASONING_EFFORT,
        aiMaxTokensGpt5Mini: parseInt(config.ai_max_tokens_gpt5_mini || DEFAULT_MAX_TOKENS_GPT5_MINI.toString()),
        aiMaxTokensGpt5: parseInt(config.ai_max_tokens_gpt5 || DEFAULT_MAX_TOKENS_GPT5.toString()),
      };
    } catch (error) {
      console.error('Error fetching settings, using defaults:', error);
      return {
        aiConfidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
        aiTemperature: DEFAULT_TEMPERATURE,
        aiReasoningEffort: DEFAULT_REASONING_EFFORT,
        aiMaxTokensGpt5Mini: DEFAULT_MAX_TOKENS_GPT5_MINI,
        aiMaxTokensGpt5: DEFAULT_MAX_TOKENS_GPT5
      };
    }
  }

  private async getSystemInstructions(): Promise<string> {
    try {
      const instructions = await aiInstructionsService.getLatestInstructions('system');
      
      // If no custom instructions found, use default fallback
      if (!instructions || instructions.trim() === '') {
        return this.getDefaultSystemInstructions();
      }
      
      return instructions.trim();
    } catch (error) {
      console.warn('Failed to fetch system instructions from storage, using default:', error);
      return this.getDefaultSystemInstructions();
    }
  }

  private getDefaultSystemInstructions(): string {
    return `You are an AI assistant specialized in analyzing customer service conversations and evaluating agent performance.

Your task is to:
1. Analyze the conversation objectively
2. Evaluate agent performance based on standard customer service metrics
3. Provide constructive feedback and recommendations
4. Score the interaction on relevant criteria

Always be fair, constructive, and focus on actionable insights that can help improve customer service quality.`;
  }

  private async getEvaluationInstructions(): Promise<string> {
    try {
      const instructions = await aiInstructionsService.getLatestInstructions('evaluation');
      
      if (!instructions || instructions.trim() === '') {
        return this.getDefaultEvaluationInstructions();
      }
      
      return instructions.trim();
    } catch (error) {
      console.warn('Failed to fetch evaluation instructions from storage, using default:', error);
      return this.getDefaultEvaluationInstructions();
    }
  }

  private getDefaultEvaluationInstructions(): string {
    return `Evaluate the agent's performance on the following criteria:

1. Professionalism and Communication
2. Problem Resolution Effectiveness  
3. Customer Empathy and Understanding
4. Process Adherence
5. Response Time and Efficiency

Rate each criterion on a scale of 1-10 and provide specific examples from the conversation to support your ratings.`;
  }

  async evaluateDialog(
    transcript: string,
    agentName?: string,
    customPrompt?: string,
    model: string = 'gpt-5-mini-2025-08-07'
  ): Promise<OpenAIEvaluationResult> {
    try {
      logger.info('Starting OpenAI dialog evaluation', { 
        model, 
        transcriptLength: transcript.length,
        agentName: agentName || 'Unknown'
      });

      // Get system and evaluation instructions from storage
      const systemInstructions = await this.getSystemInstructions();
      const evaluationInstructions = await this.getEvaluationInstructions();

      // Build the prompt using instructions from storage
      const evaluationPrompt = customPrompt || evaluationInstructions;
      
      const fullPrompt = `${evaluationPrompt}

Agent Name: ${agentName || 'Unknown'}

Conversation to evaluate:
${transcript}

Please provide a comprehensive evaluation including:
1. Overall performance score (1-10)
2. Specific strengths observed
3. Areas for improvement
4. Detailed recommendations
5. Key conversation highlights

Format your response as a structured analysis.`;

      const settings = await this.getSettings();
      
      const messages = [
        {
          role: 'system' as const,
          content: systemInstructions // Use instructions from storage
        },
        {
          role: 'user' as const,
          content: fullPrompt
        }
      ];

      const payload = {
        model,
        messages,
        max_output_tokens: model.includes('gpt-5') ? settings.aiMaxTokensGpt5 : settings.aiMaxTokensGpt5Mini,
        temperature: settings.aiTemperature,
        reasoning_effort: settings.aiReasoningEffort
      };

      logger.debug('OpenAI evaluation payload:', payload);

      const res = await fetch('/api/openai-evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.text();
        logger.error('OpenAI evaluation failed', { status: res.status, error });
        throw new Error(`OpenAI evaluation failed: ${error}`);
      }

      const data = await res.json();

      logger.debug('OpenAI evaluation raw response:', data);

      if (!data.choices || data.choices.length === 0) {
        logger.warn('No choices returned from OpenAI, retrying with GPT-5 flagship model');

        if (model !== 'gpt-5-2025-08-07') {
          // Retry with GPT-5 flagship model if initial model fails
          return this.evaluateDialog(transcript, agentName, customPrompt, 'gpt-5-2025-08-07');
        } else {
          throw new Error('No evaluation results returned from OpenAI');
        }
      }

      const evaluation = data.choices[0].message?.content;
      const tokenEstimation = data.tokenEstimation || {
        actualInputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      };

      if (!evaluation) {
        logger.warn('No evaluation content returned from OpenAI, retrying with GPT-5 flagship model');

        if (model !== 'gpt-5-2025-08-07') {
          // Retry with GPT-5 flagship model if initial model fails
          return this.evaluateDialog(transcript, agentName, customPrompt, 'gpt-5-2025-08-07');
        } else {
          throw new Error('No evaluation results returned from OpenAI');
        }
      }

      // Basic parsing logic (improve with more robust parsing if needed)
      const overallScoreMatch = evaluation.match(/Overall performance score: (\d+)/i);
      const strengthsMatch = evaluation.match(/Specific strengths observed:\s*([\s\S]*?)(Areas for improvement:|$)/i);
      const areasForImprovementMatch = evaluation.match(/Areas for improvement:\s*([\s\S]*?)(Detailed recommendations:|$)/i);
      const recommendationsMatch = evaluation.match(/Detailed recommendations:\s*([\s\S]*?)(Key conversation highlights:|$)/i);
      const conversationHighlightsMatch = evaluation.match(/Key conversation highlights:\s*([\s\S]*)/i);

      const overallScore = overallScoreMatch ? parseInt(overallScoreMatch[1], 10) : 0;
      const strengths = strengthsMatch ? strengthsMatch[1].trim().split('\n').filter(line => line.trim() !== '') : [];
      const areasForImprovement = areasForImprovementMatch ? areasForImprovementMatch[1].trim().split('\n').filter(line => line.trim() !== '') : [];
      const recommendations = recommendationsMatch ? recommendationsMatch[1].trim().split('\n').filter(line => line.trim() !== '') : [];
      const conversationHighlights = conversationHighlightsMatch ? conversationHighlightsMatch[1].trim().split('\n').filter(line => line.trim() !== '') : [];

      const result: OpenAIEvaluationResult = {
        overallScore,
        strengths,
        areasForImprovement,
        recommendations,
        conversationHighlights,
        rawOutput: evaluation,
        tokenEstimation
      };

      logger.info('OpenAI evaluation completed successfully', { overallScore, model, tokenEstimation });
      logger.debug('Parsed evaluation result:', result);

      // Retry with GPT-5 flagship if confidence is low
      if (overallScore < settings.aiConfidenceThreshold * 10 && model !== 'gpt-5-2025-08-07') {
        logger.warn(`Low confidence score (${overallScore}), retrying with GPT-5 flagship model`);
        return this.evaluateDialog(transcript, agentName, customPrompt, 'gpt-5-2025-08-07');
      }

      return result;

    } catch (error) {
      logger.error('Error in OpenAI evaluation:', error);
      
      // Check if the error is a timeout
      if (error.message.includes('timed out')) {
        logger.warn('OpenAI evaluation timed out, retrying with GPT-5 flagship model');
        if (model !== 'gpt-5-2025-08-07') {
          return this.evaluateDialog(transcript, agentName, customPrompt, 'gpt-5-2025-08-07');
        } else {
          throw new Error('OpenAI evaluation timed out');
        }
      }

      throw error;
    }
  }
}

export const openaiEvaluationService = new OpenAIEvaluationService();
