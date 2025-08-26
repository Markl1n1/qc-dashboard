import { logger } from './loggingService';
import { databaseService } from './databaseService';
import { aiInstructionsService } from './aiInstructionsService';
import { SpeakerUtterance } from '../types';
import { OpenAIEvaluationResult, OpenAIEvaluationProgress } from '../types/openaiEvaluation';

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
  private progressCallback?: (progress: OpenAIEvaluationProgress) => void;

  setProgressCallback(callback: (progress: OpenAIEvaluationProgress) => void) {
    this.progressCallback = callback;
  }

  private notifyProgress(stage: OpenAIEvaluationProgress['stage'], progress: number, message: string, currentStep?: string) {
    if (this.progressCallback) {
      this.progressCallback({
        stage,
        progress,
        message,
        currentStep
      });
    }
  }

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

  async evaluateConversation(
    utterances: SpeakerUtterance[],
    model: string = 'gpt-5-mini-2025-08-07'
  ): Promise<OpenAIEvaluationResult> {
    const startTime = Date.now();
    
    try {
      this.notifyProgress('initializing', 10, 'Preparing conversation data...');

      // Convert utterances to transcript format
      const transcript = utterances
        .sort((a, b) => a.start - b.start)
        .map(u => `${u.speaker}: ${u.text}`)
        .join('\n');

      // Extract agent name (first speaker that's not Customer)
      const agentName = utterances.find(u => u.speaker !== 'Customer')?.speaker || 'Agent';

      this.notifyProgress('analyzing', 30, 'Starting AI analysis...');

      // Use the existing evaluateDialog method
      const result = await this.evaluateDialog(transcript, agentName, undefined, model);

      this.notifyProgress('processing_response', 80, 'Processing results...');

      // Convert to the expected format for the UI
      const conversationResult: OpenAIEvaluationResult = {
        overallScore: result.overallScore * 10, // Convert from 1-10 to 1-100
        categoryScores: this.parseCategoryScores(result.rawOutput),
        mistakes: this.parseMistakes(result.rawOutput, utterances),
        recommendations: result.recommendations,
        summary: this.generateSummary(result),
        confidence: 85, // Default confidence
        processingTime: Date.now() - startTime,
        tokenUsage: {
          input: result.tokenEstimation.actualInputTokens,
          output: result.tokenEstimation.outputTokens,
          cost: this.calculateCost(result.tokenEstimation.totalTokens, model)
        },
        modelUsed: model,
        analysisId: `analysis_${Date.now()}`
      };

      this.notifyProgress('complete', 100, 'Analysis completed successfully!');

      return conversationResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.notifyProgress('error', 0, `Analysis failed: ${errorMessage}`);
      throw error;
    }
  }

  private parseCategoryScores(rawOutput: string): Record<string, number> {
    const categories: Record<string, number> = {};
    
    // Try to extract category scores from the raw output
    const lines = rawOutput.split('\n');
    for (const line of lines) {
      const match = line.match(/(\w+(?:\s+\w+)*?):\s*(\d+)(?:\/10|\/100)?/i);
      if (match) {
        const category = match[1].toLowerCase().replace(/\s+/g, '_');
        let score = parseInt(match[2]);
        // Normalize to 100-point scale
        if (score <= 10) score *= 10;
        categories[category] = Math.min(100, Math.max(0, score));
      }
    }

    return categories;
  }

  private parseMistakes(rawOutput: string, utterances: SpeakerUtterance[]): any[] {
    const mistakes: any[] = [];
    
    // Simple parsing - look for common mistake indicators
    const lines = rawOutput.split('\n');
    let mistakeCounter = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('mistake') || line.includes('error') || line.includes('issue')) {
        mistakes.push({
          id: `mistake_${++mistakeCounter}`,
          level: 'minor',
          category: 'general',
          mistakeName: `Issue ${mistakeCounter}`,
          description: lines[i].trim(),
          text: '',
          position: 0,
          speaker: 'Agent',
          suggestion: 'Consider improving this aspect',
          impact: 'medium',
          confidence: 75
        });
      }
    }

    return mistakes;
  }

  private generateSummary(result: any): string {
    const score = result.overallScore;
    if (score >= 8) {
      return 'Excellent performance with strong customer service skills demonstrated throughout the conversation.';
    } else if (score >= 6) {
      return 'Good performance with some areas for improvement identified.';
    } else {
      return 'Performance needs improvement with several areas requiring attention.';
    }
  }

  private calculateCost(totalTokens: number, model: string): number {
    const costPer1k = this.getModelCost(model);
    return (totalTokens / 1000) * costPer1k;
  }

  private getModelCost(model: string): number {
    const costs: Record<string, number> = {
      'gpt-5-2025-08-07': 0.03,
      'gpt-5-mini-2025-08-07': 0.015,
      'gpt-5-nano-2025-08-07': 0.005,
      'gpt-4.1-2025-04-14': 0.02,
      'o3-2025-04-16': 0.04,
      'o4-mini-2025-04-16': 0.01,
      'gpt-4.1-mini-2025-04-14': 0.008,
      'gpt-4o-mini': 0.006,
      'gpt-4o': 0.025,
      'gpt-3.5-turbo': 0.002
    };
    return costs[model] || 0.02;
  }

  async evaluateDialog(
    transcript: string,
    agentName?: string,
    customPrompt?: string,
    model: string = 'gpt-5-mini-2025-08-07'
  ): Promise<{
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
  }> {
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
          content: systemInstructions
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
          return this.evaluateDialog(transcript, agentName, customPrompt, 'gpt-5-2025-08-07');
        } else {
          throw new Error('No evaluation results returned from OpenAI');
        }
      }

      // Basic parsing logic
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

      const result = {
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
      if (error instanceof Error && error.message.includes('timed out')) {
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
