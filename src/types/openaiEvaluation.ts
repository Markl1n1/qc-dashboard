
export interface EvaluationMistake {
  id?: string;
  category: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  level: 'minor' | 'major' | 'critical';
  example: string;
  mistakeName?: string;
  text?: string;
  position?: number;
  suggestion?: string;
  speaker?: string;
  confidence?: number;
}

export interface OpenAIEvaluationResult {
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
    input?: number;
    output?: number;
    cost?: number;
  };
  processingTime: number;
  modelUsed: string;
  analysisId: string;
}

export type EvaluationStatus = 
  | 'initializing' 
  | 'preparing'
  | 'prompt_ready'
  | 'analyzing' 
  | 'response_received'
  | 'parsing_complete'
  | 'validation_complete'
  | 'processing_response' 
  | 'complete' 
  | 'error';

export interface OpenAIEvaluationProgress {
  stage: EvaluationStatus;
  progress: number;
  message: string;
  currentStep?: string;
}

export interface OpenAIModel {
  id: string;
  name: string;
  category: 'flagship' | 'fast' | 'reasoning' | 'economic';
  description: string;
  costPer1kTokens: number;
  recommended?: boolean;
}

export const OPENAI_MODELS: OpenAIModel[] = [
  {
    id: 'gpt-5-2025-08-07',
    name: 'GPT-5',
    category: 'flagship',
    description: 'Most capable model for complex tasks',
    costPer1kTokens: 0.01,
    recommended: true
  },
  {
    id: 'gpt-5-mini-2025-08-07',
    name: 'GPT-5 Mini',
    category: 'fast',
    description: 'Fast and efficient for well-defined tasks',
    costPer1kTokens: 0.005
  },
  {
    id: 'gpt-5-nano-2025-08-07',
    name: 'GPT-5 Nano',
    category: 'economic',
    description: 'Fastest and cheapest option',
    costPer1kTokens: 0.001
  },
  {
    id: 'gpt-4.1-2025-04-14',
    name: 'GPT-4.1',
    category: 'flagship',
    description: 'Reliable flagship GPT-4 model',
    costPer1kTokens: 0.008
  },
  {
    id: 'o3-2025-04-16',
    name: 'O3',
    category: 'reasoning',
    description: 'Powerful reasoning for complex analysis',
    costPer1kTokens: 0.015
  },
  {
    id: 'o4-mini-2025-04-16',
    name: 'O4 Mini',
    category: 'reasoning',
    description: 'Fast reasoning model',
    costPer1kTokens: 0.008
  }
];
