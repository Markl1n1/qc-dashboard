
import { SpeakerUtterance } from '../types';

export interface TokenCalculation {
  inputTokens: number;
  estimatedOutputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  textLength: number;
}

export interface OpenAITokenCalculation extends TokenCalculation {
  model: string;
  costPer1kTokens: number;
}

export interface LemurTokenCalculation extends TokenCalculation {
  costPerInputToken: number;
  costPerOutputToken: number;
}

class TokenCalculatorService {
  // Approximate tokens per character ratios
  private readonly TOKENS_PER_CHAR = 0.25; // ~4 characters per token for English
  private readonly AVERAGE_OUTPUT_TOKENS = 500; // Estimated average output for evaluations
  
  // OpenAI model pricing (per 1k tokens)
  private readonly OPENAI_MODELS = {
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

  // Lemur pricing (per token)
  private readonly LEMUR_INPUT_COST = 0.000015; // $0.000015 per input token
  private readonly LEMUR_OUTPUT_COST = 0.00006; // $0.00006 per output token

  /**
   * Calculate tokens for a given text
   */
  private calculateTokensFromText(text: string): number {
    return Math.ceil(text.length * this.TOKENS_PER_CHAR);
  }

  /**
   * Convert speaker utterances to conversation text
   */
  private speakerUtterancesToText(utterances: SpeakerUtterance[]): string {
    return utterances
      .map(utterance => `${utterance.speaker}: ${utterance.text}`)
      .join('\n');
  }

  /**
   * Calculate OpenAI tokens and cost for evaluation
   */
  calculateOpenAITokens(
    utterances: SpeakerUtterance[], 
    model: string = 'gpt-5-mini-2025-08-07'
  ): OpenAITokenCalculation {
    const conversationText = this.speakerUtterancesToText(utterances);
    
    // System prompt for evaluation (approximate)
    const systemPromptLength = 1500; // Estimated characters in evaluation system prompt
    const systemPromptTokens = this.calculateTokensFromText(' '.repeat(systemPromptLength));
    
    // Input tokens = system prompt + conversation text
    const conversationTokens = this.calculateTokensFromText(conversationText);
    const inputTokens = systemPromptTokens + conversationTokens;
    
    // Estimated output tokens for evaluation response
    const estimatedOutputTokens = this.AVERAGE_OUTPUT_TOKENS;
    
    const totalTokens = inputTokens + estimatedOutputTokens;
    
    // Get model pricing
    const costPer1kTokens = this.OPENAI_MODELS[model as keyof typeof this.OPENAI_MODELS] || 0.015;
    const estimatedCost = (totalTokens / 1000) * costPer1kTokens;

    return {
      inputTokens,
      estimatedOutputTokens,
      totalTokens,
      estimatedCost,
      textLength: conversationText.length,
      model,
      costPer1kTokens
    };
  }

  /**
   * Calculate Lemur tokens and cost for evaluation
   */
  calculateLemurTokens(utterances: SpeakerUtterance[]): LemurTokenCalculation {
    const conversationText = this.speakerUtterancesToText(utterances);
    
    // For Lemur, we need to consider the prompt template and context
    const promptOverhead = 800; // Estimated characters for Lemur prompt template
    const fullText = conversationText + ' '.repeat(promptOverhead);
    
    const inputTokens = this.calculateTokensFromText(fullText);
    const estimatedOutputTokens = this.AVERAGE_OUTPUT_TOKENS;
    const totalTokens = inputTokens + estimatedOutputTokens;
    
    // Calculate cost using Lemur pricing
    const inputCost = inputTokens * this.LEMUR_INPUT_COST;
    const outputCost = estimatedOutputTokens * this.LEMUR_OUTPUT_COST;
    const estimatedCost = inputCost + outputCost;

    return {
      inputTokens,
      estimatedOutputTokens,
      totalTokens,
      estimatedCost,
      textLength: conversationText.length,
      costPerInputToken: this.LEMUR_INPUT_COST,
      costPerOutputToken: this.LEMUR_OUTPUT_COST
    };
  }

  /**
   * Get available OpenAI models with pricing
   */
  getOpenAIModels() {
    return Object.entries(this.OPENAI_MODELS).map(([id, cost]) => ({
      id,
      name: this.formatModelName(id),
      costPer1kTokens: cost
    }));
  }

  /**
   * Format model ID to display name
   */
  private formatModelName(modelId: string): string {
    const nameMap: Record<string, string> = {
      'gpt-5-2025-08-07': 'GPT-5',
      'gpt-5-mini-2025-08-07': 'GPT-5 Mini',
      'gpt-5-nano-2025-08-07': 'GPT-5 Nano',
      'gpt-4.1-2025-04-14': 'GPT-4.1',
      'o3-2025-04-16': 'O3',
      'o4-mini-2025-04-16': 'O4 Mini',
      'gpt-4.1-mini-2025-04-14': 'GPT-4.1 Mini',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-4o': 'GPT-4o',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo'
    };
    
    return nameMap[modelId] || modelId;
  }
}

export const tokenCalculatorService = new TokenCalculatorService();
