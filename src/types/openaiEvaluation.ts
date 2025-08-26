
export interface OpenAIEvaluationMistake {
  id: string;
  level: 'minor' | 'major' | 'critical';
  category: string;
  subcategory?: string;
  mistakeName?: string;
  description: string;
  text: string;
  position: number;
  speaker: 'Agent' | 'Customer';
  suggestion: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number;
  timestamp?: number;
}

export interface OpenAIEvaluationResult {
  overallScore: number;
  categoryScores: Record<string, number>;
  mistakes: OpenAIEvaluationMistake[];
  recommendations: string[];
  summary: string;
  confidence: number;
  processingTime: number;
  tokenUsage: {
    input: number;
    output: number;
    cost?: number;
  };
  modelUsed: string;
  analysisId: string;
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
    id: 'gpt-5-2025-08-07',
    name: 'GPT-5',
    description: 'Flagship model with best performance',
    costPer1kTokens: 0.03,
    category: 'flagship',
    recommended: true
  },
  {
    id: 'gpt-5-mini-2025-08-07',
    name: 'GPT-5 Mini',
    description: 'Faster, more cost-efficient GPT-5',
    costPer1kTokens: 0.015,
    category: 'fast',
    recommended: true
  },
  {
    id: 'gpt-5-nano-2025-08-07',
    name: 'GPT-5 Nano',
    description: 'Fastest, cheapest for classification',
    costPer1kTokens: 0.005,
    category: 'fast'
  },
  {
    id: 'gpt-4.1-2025-04-14',
    name: 'GPT-4.1',
    description: 'Reliable GPT-4 flagship model',
    costPer1kTokens: 0.02,
    category: 'flagship'
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
    id: 'gpt-4.1-mini-2025-04-14',
    name: 'GPT-4.1 Mini',
    description: 'Economic version of GPT-4.1',
    costPer1kTokens: 0.008,
    category: 'economic'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini (Legacy)',
    description: 'Fast and cheap legacy model',
    costPer1kTokens: 0.006,
    category: 'economic'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Legacy)',
    description: 'Powerful legacy model',
    costPer1kTokens: 0.025,
    category: 'flagship'
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Most economical option',
    costPer1kTokens: 0.002,
    category: 'economic'
  }
];
