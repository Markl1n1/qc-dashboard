export interface EvaluationMistake {
  category: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  example: string;
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
