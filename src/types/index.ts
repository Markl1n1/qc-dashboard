import { LeMUREvaluationResult } from './lemurEvaluation';
import { OpenAIEvaluationResult } from './openaiEvaluation';
import { SalesAnalysisResult } from './salesAnalysis';
import { TranslationProgress } from './translation';

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  url?: string;
}

export interface SpeakerUtterance {
  speaker: 'Agent' | 'Customer';
  text: string;
  confidence: number;
  start: number;
  end: number;
}

export interface Dialog {
  id: string;
  name: string;
  createdAt: string;
  status: 'uploading' | 'transcribing' | 'processing' | 'completed' | 'failed';
  files: FileInfo[];
  originalText?: string;
  speakerUtterances: SpeakerUtterance[];
  translations?: Record<string, {
    raw: string;
    speakers: SpeakerUtterance[];
  }>;
  translationProgress?: TranslationProgress;
  lemurEvaluation?: LeMUREvaluationResult;
  openaiEvaluation?: OpenAIEvaluationResult;
  salesAnalysis?: SalesAnalysisResult;
  qualityScore?: number;
  error?: string;
  tokenEstimation?: {
    assemblyAI?: {
      audioLengthMinutes: number;
      estimatedCost: number;
    };
    openAI?: {
      estimatedInputTokens: number;
      actualInputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cost: number;
    };
    lemur?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cost: number;
    };
  };
}
