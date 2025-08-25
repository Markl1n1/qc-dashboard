
import { SpeakerUtterance } from '../types';
import { OpenAIEvaluationResult, OpenAIEvaluationProgress, OpenAIModel, OPENAI_MODELS, OpenAIEvaluationMistake } from '../types/openaiEvaluation';

class OpenAIEvaluationService {
  private readonly apiKey = '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';
  private readonly baseUrl = 'https://api.openai.com/v1';
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

  private generateEvaluationPrompt(utterances: SpeakerUtterance[]): string {
    const conversation = utterances
      .map(u => `${u.speaker}: ${u.text}`)
      .join('\n');

    return `You are an expert call center quality analyst. Analyze this customer service conversation and provide a detailed evaluation.

CONVERSATION:
${conversation}

Please analyze the conversation and respond with a JSON object containing:

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

Focus on:
- Agent communication skills and tone
- Problem resolution effectiveness  
- Compliance with policies
- Customer satisfaction indicators
- Professional behavior

Provide specific, actionable feedback. Only return valid JSON.`;
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

      const prompt = this.generateEvaluationPrompt(utterances);
      
      this.updateProgress('analyzing', 20, 'Sending request to OpenAI...');

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            {
              role: 'system',
              content: 'You are an expert call center quality analyst. Always respond with valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        
        // Enhanced error message with model information
        const errorMessage = `OpenAI API error: ${errorData.error?.message || response.statusText}. Model attempted: ${this.lastAttemptedModel}`;
        throw new Error(errorMessage);
      }

      this.updateProgress('processing_response', 60, 'Processing OpenAI response...');

      const data = await response.json();
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

      // Calculate token usage and cost
      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
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
      
      // NO FALLBACK - Just throw the error with model information
      throw new Error(errorMessage);
    }
  }

  validateApiKey(): boolean {
    return this.apiKey && this.apiKey.length > 20;
  }

  getLastAttemptedModel(): string {
    return this.lastAttemptedModel;
  }
}

export const openaiEvaluationService = new OpenAIEvaluationService();
