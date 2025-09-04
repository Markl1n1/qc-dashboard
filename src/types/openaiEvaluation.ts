
export interface OpenAIEvaluationMistake {
  rule_category: 'Correct' | 'Acceptable' | 'Not Recommended' | 'Mistake' | 'Banned';
  comment: string;
  utterance: string;
}

export interface OpenAIEvaluationSpeaker {
  speaker_0?: string;
  role_0?: string;
  speaker_1?: string;
  role_1?: string;
}

export interface OpenAIEvaluationResult {
  score: number;
  mistakes: OpenAIEvaluationMistake[];
  speakers: OpenAIEvaluationSpeaker[];
  // Additional fields for internal use
  overallScore?: number;
  categoryScores?: Record<string, number>;
  recommendations?: string[];
  summary?: string;
  confidence?: number;
  processingTime?: number;
  tokenUsage?: {
    input: number;
    output: number;
    cost?: number;
  };
  modelUsed?: string;
  analysisId?: string;
}

export interface OpenAIEvaluationProgress {
  stage: 'initializing' | 'analyzing' | 'processing_response' | 'complete' | 'error';
  progress: number;
  message: string;
  currentStep?: string;
  estimatedTimeRemaining?: number;
}

export interface OpenAIModel {
  id: string;
  name: string;
  description: string;
  costPer1kTokens: number;
  category: 'flagship' | 'fast' | 'reasoning' | 'economic';
  recommended?: boolean;
}

export const OPENAI_MODELS: OpenAIModel[] = [
  {
    id: 'gpt-5',
    name: 'GPT-5',
    description: 'Flagship model with best performance',
    costPer1kTokens: 0.03,
    category: 'flagship',
    recommended: true
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    description: 'Faster, more cost-efficient GPT-5',
    costPer1kTokens: 0.015,
    category: 'fast',
    recommended: true
  },
  {
    id: 'o3-2025-04-16',
    name: 'O3',
    description: 'Powerful reasoning model',
    costPer1kTokens: 0.04,
    category: 'reasoning'
  },
  {
    id: 'o4-mini-2025-04-16',
    name: 'O4 Mini',
    description: 'Fast reasoning model',
    costPer1kTokens: 0.01,
    category: 'reasoning',
    recommended: true
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Most economical option',
    costPer1kTokens: 0.002,
    category: 'economic'
  }
];
