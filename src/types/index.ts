export type TranscriptionProvider = 'deepgram';


export interface UnifiedTranscriptionProgress {
  stage: 'uploading' | 'queued' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
}

export interface TranslationProgress {
  stage: 'translating_text' | 'translating_speakers' | 'complete' | 'error';
  progress: number;
  message: string;
  currentProvider?: string;
  currentUtterance?: number;
  totalUtterances?: number;
}

export interface TranslationQueueItem {
  dialogId: string;
  priority: number;
  createdAt: Date;
}

export interface SpeakerUtterance {
  speaker: string;
  text: string;
  confidence: number;
  start: number;
  end: number;
}

export interface SimplifiedTokenEstimation {
  audioLengthMinutes: number;
  estimatedCost: number;
  totalTokens?: number;
  cost?: number;
}

export interface Dialog {
  id: string;
  fileName: string;
  transcription?: string;
  speakerTranscription?: SpeakerUtterance[];
  status: 'processing' | 'completed' | 'failed' | 'pending';
  assignedAgent: string;
  assignedSupervisor: string;
  uploadDate: string;
  error?: string;
  tokenEstimation?: SimplifiedTokenEstimation;
  
  // Translation properties
  russianTranscription?: string;
  russianSpeakerTranscription?: SpeakerUtterance[];
  isTranslating?: boolean;
  translationStatus?: 'processing' | 'completed' | 'failed';
  translationProgress?: number;
  currentLanguage?: 'original' | 'russian';
  translations?: {
    speakers?: {
      ru?: SpeakerUtterance[];
    };
  };
  
  // Segmentation properties
  isSegmented?: boolean;
  parentDialogId?: string;
  childDialogIds?: string[];
  segmentCount?: number;
  segmentIndex?: number;
  
  // Analysis properties - use unified types
  openaiEvaluation?: import('./unified').OpenAIEvaluationResult | null;
  qualityScore?: number;
}

// Remove over-engineered interfaces - replaced by unified types
export type { OpenAIEvaluationResult } from './unified';
