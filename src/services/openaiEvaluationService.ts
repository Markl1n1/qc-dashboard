import { AIInstructionsService } from './aiInstructionsService';
import { EvaluationCategory } from '../types/lemurEvaluation';
import { OpenAIEvaluationResult, EvaluationMistake, EvaluationStatus } from '../types/openaiEvaluation';

export class OpenAIEvaluationService {
  private apiKey: string;
  private aiInstructionsService: AIInstructionsService;
  private progressCallback: ((status: EvaluationStatus, progress: number) => void) | null = null;

  constructor(apiKey: string, aiInstructionsService: AIInstructionsService) {
    this.apiKey = apiKey;
    this.aiInstructionsService = aiInstructionsService;
  }

  private updateProgress(status: EvaluationStatus, progress: number) {
    if (this.progressCallback) {
      this.progressCallback(status, progress);
    }
  }

  private buildEvaluationPrompt(
    transcript: string,
    speakerTranscript: string,
    categories: EvaluationCategory[],
    aiInstructions: string
  ): string {
    const categoryDetails = categories
      .filter(c => c.enabled)
      .map(c => `${c.name} (Weight: ${c.weight})`)
      .join(', ');

    return `
      ${aiInstructions}

      Categories for evaluation (with weights): ${categoryDetails || 'None'}

      Transcript:
      ${transcript}

      Speaker Transcript:
      ${speakerTranscript}

      Please provide:
      1. overallScore: An overall score (0-100).
      2. categoryScores: Scores (0-100) for each category.
      3. mistakes: Specific mistakes made.
      4. recommendations: How to improve.
      5. summary: A brief summary of the evaluation.
      6. confidence: Your confidence in the evaluation (0-100).

      Format the response as a JSON object.
    `;
  }

  private parseEvaluationResult(jsonString: string): {
    overallScore: number;
    categoryScores: Record<string, number>;
    mistakes: EvaluationMistake[];
    recommendations: string[];
    summary: string;
    confidence: number;
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  } {
    try {
      const parsed = JSON.parse(jsonString);
      return {
        overallScore: parsed.overallScore,
        categoryScores: parsed.categoryScores,
        mistakes: parsed.mistakes || [],
        recommendations: parsed.recommendations || [],
        summary: parsed.summary,
        confidence: parsed.confidence,
        tokenUsage: parsed.tokenUsage || {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        }
      };
    } catch (error) {
      console.error('Failed to parse OpenAI response:', error);
      return {
        overallScore: 50,
        categoryScores: {},
        mistakes: [],
        recommendations: [],
        summary: 'No summary available due to parsing error.',
        confidence: 50,
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        }
      };
    }
  }

  async evaluateConversation(
    transcript: string, 
    speakerTranscript: string, 
    categories: EvaluationCategory[] = []
  ): Promise<OpenAIEvaluationResult> {
    const startTime = Date.now();
    this.updateProgress("initializing", 0);

    try {
      this.updateProgress("preparing", 10);
      const aiInstructions = await this.aiInstructionsService.getDefaultInstructions();
      this.updateProgress("prompt_ready", 25);
      
      const prompt = this.buildEvaluationPrompt(transcript, speakerTranscript, categories, aiInstructions);

      this.updateProgress("analyzing", 50);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      this.updateProgress("response_received", 75);
      const data = await response.json();
      this.updateProgress("parsing_complete", 85);
      
      const result = this.parseEvaluationResult(data.choices[0].message.content);
      this.updateProgress("validation_complete", 95);
      this.updateProgress("complete", 100);

      return {
        overallScore: result.overallScore,
        categoryScores: result.categoryScores,
        mistakes: result.mistakes,
        recommendations: result.recommendations,
        summary: result.summary,
        confidence: result.confidence,
        tokenUsage: result.tokenUsage,
        processingTime: Date.now() - startTime,
        modelUsed: 'gpt-4',
        analysisId: `analysis_${Date.now()}`
      };

    } catch (error) {
      console.error('OpenAI evaluation error:', error);
      this.updateProgress("error", 100);
      throw error;
    }
  }

  setProgressCallback(callback: (status: EvaluationStatus, progress: number) => void) {
    this.progressCallback = callback;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
}
