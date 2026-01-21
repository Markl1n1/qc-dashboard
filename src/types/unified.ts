// Unified type definitions with proper type safety
export interface OpenAIEvaluationSpeaker {
  speaker_0?: string;
  role_0?: string;
  speaker_1?: string;
  role_1?: string;
}

export interface OpenAIEvaluationMistake {
  rule_category: 'Correct' | 'Acceptable' | 'Not Recommended' | 'Mistake' | 'Banned';
  comment: string;
  utterance: string;
}

export interface OpenAIEvaluationResult {
  score: number;
  overallScore?: number;
  mistakes: OpenAIEvaluationMistake[];
  speakers: OpenAIEvaluationSpeaker[];
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

export interface SpeakerUtterance {
  speaker: string;
  text: string;
  confidence: number;
  start: number;
  end: number;
}

export interface DialogData {
  id: string;
  fileName: string;
  status: 'processing' | 'completed' | 'failed' | 'pending';
  assignedAgent: string;
  assignedSupervisor: string;
  uploadDate: string;
  speakerTranscription?: SpeakerUtterance[];
  openaiEvaluation?: OpenAIEvaluationResult | null;
  qualityScore?: number;
  error?: string;
  audioLengthMinutes?: number;
}

export interface AnalysisProgress {
  stage: 'initializing' | 'analyzing' | 'processing_response' | 'complete' | 'error';
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
}