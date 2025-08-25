export interface Dialog {
  id: string;
  fileName: string;
  uploadDate: Date;
  transcription: string;
  speakerTranscription: SpeakerUtterance[];
  error?: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  assignedAgent: string;
  assignedSupervisor: string;
  qualityScore?: number;
  lemurEvaluation?: LeMUREvaluationResult;
  openaiEvaluation?: OpenAIEvaluationResult;
  salesAnalysis?: SalesAnalysisResult;
  currentLanguage?: 'original' | 'russian';
  translations?: {
    russian?: {
      transcription?: string;
      speakers?: SpeakerUtterance[];
    };
  };
}

export interface SpeakerUtterance {
  speaker: string;
  text: string;
  position: number;
}

export interface LeMUREvaluationResult {
  id: string;
  overallScore: number;
  confidence: number;
  summary: string;
  recommendations: string[];
  mistakes: Mistake[];
  bannedWordsDetected: BannedWord[];
  processingTime: number;
  tokenUsage: {
    input: number;
    output: number;
    cost?: number;
  };
  detectedLanguage?: string;
  analysisId?: string;
}

export interface Mistake {
  id: string;
  text: string;
  mistakeName: string;
  description: string;
  suggestion: string;
  category: string;
  level: 'critical' | 'major' | 'minor';
  speaker: string;
  position: number;
  confidence: number;
}

export interface BannedWord {
  word: string;
  count: number;
}

export interface LeMUREvaluationProgress {
  progress: number;
  message: string;
  currentStep?: string;
  estimatedTimeRemaining?: number;
}

export interface EvaluationConfiguration {
  id: string;
  name: string;
  description: string;
  prompt: string;
  categories: Category[];
}

export interface Category {
  id: string;
  name: string;
  weight: number;
  enabled: boolean;
}

export interface OpenAIEvaluationResult {
  id: string;
  overallScore: number;
  confidence: number;
  summary: string;
  recommendations: string[];
  mistakes: Mistake[];
  categoryScores: { [key: string]: number };
  modelUsed: string;
  processingTime: number;
  tokenUsage: {
    input: number;
    output: number;
    cost?: number;
  };
}

export interface OpenAIEvaluationProgress {
  progress: number;
  message: string;
  stage: 'initializing' | 'analyzing' | 'processing_response' | 'complete' | 'error';
}

export interface OpenAIModel {
  id: string;
  name: string;
  description: string;
  costPer1kTokens: number;
  category: 'flagship' | 'fast' | 'reasoning' | 'economic';
  recommended?: boolean;
}

export interface SalesAnalysisResult {
  overallScore: number;
  sentiment: {
    overall: string;
    agent: string;
    customer: string;
  };
  talkRatio: {
    agent: number;
    customer: number;
  };
  salesStages: {
    [stage: string]: {
      score: number;
      feedback: string;
      keyPhases: string[];
      improvements: string[];
    };
  };
  keyMoments: KeyMoment[];
  buyingSignals: BuyingSignal[];
  objections: Objection[];
  actionItems: string[];
  recommendations: string[];
  summary: string;
  confidence: number;
  processingTime: number;
}

export interface KeyMoment {
  type: string;
  speaker: string;
  description: string;
  context: string;
  importance: string;
}

export interface BuyingSignal {
  signal: string;
  context: string;
  strength: string;
  confidence: number;
}

export interface Objection {
  objection: string;
  agentResponse: string;
  category: string;
  handled: boolean;
  effectiveness: number;
}

export interface TranslationProgress {
  progress: number;
  message: string;
  stage: 'initializing' | 'translating_text' | 'translating_speakers' | 'complete' | 'error';
  currentStep?: string;
  estimatedTimeRemaining?: number;
}

export interface TokenEstimation {
  audioLengthMinutes: number;
  estimatedCost: number;
  lemur?: number;
  openAI?: number;
}

export interface UnifiedTranscriptionProgress {
  progress: number;
  message: string;
  stage: 'uploading' | 'processing' | 'transcribing' | 'analyzing' | 'complete' | 'error';
  currentStep?: string;
  estimatedTimeRemaining?: number;
}
