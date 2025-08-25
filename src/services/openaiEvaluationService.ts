
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

  private async getMaxTokens(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'openai_max_tokens')
        .single();

      if (data && !error) {
        return parseInt(data.value) || 1000;
      }
    } catch (error) {
      console.error('Error fetching max tokens from config:', error);
    }
    return 1000; // Default value
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

      this.lastAttemptedModel = model.name;

      // Get max tokens from settings
      const maxTokens = await this.getMaxTokens();

      this.updateProgress('analyzing', 20, 'Sending request to OpenAI...');

      // First attempt with default model (gpt-5-mini)
      let result = await this.performEvaluation(utterances, modelId, maxTokens);

      // Check confidence for hybrid evaluation
      if (result.confidence < 80 && modelId === 'gpt-5-mini-2025-08-07') {
        this.updateProgress('analyzing', 50, 'Low confidence detected, retrying with GPT-5...');
        console.log('Low confidence detected, retrying with GPT-5 model');
        
        // Retry with GPT-5 flagship model
        const flagshipResult = await this.performEvaluation(utterances, 'gpt-5-2025-08-07', maxTokens);
        
        // Use the flagship result if it has better confidence
        if (flagshipResult.confidence >= result.confidence) {
          result = flagshipResult;
          result.modelUsed += ' (Hybrid: upgraded from GPT-5 Mini due to low confidence)';
        }
      }

      this.updateProgress('complete', 100, 'Evaluation completed successfully');
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Unknown error occurred. Model attempted: ${this.lastAttemptedModel}`;
      console.error('OpenAI evaluation failed:', errorMessage);
      this.updateProgress('error', 0, `Evaluation failed: ${errorMessage}`);
      
      throw new Error(errorMessage);
    }
  }

  private async performEvaluation(
    utterances: SpeakerUtterance[], 
    modelId: string, 
    maxTokens: number
  ): Promise<OpenAIEvaluationResult> {
    const startTime = Date.now();
    const model = OPENAI_MODELS.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Create conversation text for user content
    const conversationText = utterances
      .map((u: any) => `${u.speaker}: ${u.text}`)
      .join('\n');

    // System prompt with evaluation instructions
    const systemPrompt = `You are an expert call center quality analyst. Analyze customer service conversations and provide detailed evaluation.

EVALUATION CRITERIA:
- Communication: Clarity, tone, active listening, empathy
- Professionalism: Courtesy, appropriate language, patience
- Problem Solving: Understanding issues, providing solutions, follow-up
- Compliance: Following procedures, data protection, policies
- Customer Satisfaction: Meeting needs, resolving concerns

RESPONSE FORMAT:
Respond with valid JSON only in this exact structure:
{
  "overallScore": number (0-100),
  "categoryScores": {
    "communication": number (0-100),
    "professionalism": number (0-100),
    "problem_solving": number (0-100),
    "compliance": number (0-100),
    "customer_satisfaction": number (0-100)
  },
  "mistakes": [
    {
      "id": "unique_id",
      "level": "minor|major|critical",
      "category": "communication|professionalism|problem_solving|compliance|other",
      "mistakeName": "Brief mistake name",
      "description": "Detailed description of the mistake",
      "text": "Exact text from conversation",
      "position": utterance_index,
      "speaker": "Agent|Customer", 
      "suggestion": "How to improve",
      "impact": "low|medium|high",
      "confidence": number (0-100)
    }
  ],
  "recommendations": ["list", "of", "improvement", "suggestions"],
  "summary": "Overall summary of the conversation quality",
  "confidence": number (0-100)
}

Focus on actionable feedback and specific examples from the conversation.`;

    const { data, error } = await supabase.functions.invoke('openai-evaluate', {
      body: {
        model: modelId,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Please evaluate this customer service conversation:\n\n${conversationText}`
          }
        ],
        max_output_tokens: maxTokens
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

    return result;
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
