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

export interface TokenEstimation {
  audioLengthMinutes: number;
  estimatedCost: number;
  openAI?: {
    estimatedInputTokens: number;
    actualInputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
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
  tokenEstimation?: TokenEstimation;
  
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
  
  // Analysis properties
  analysis?: AIAnalysis;
  openaiEvaluation?: any;
  qualityScore?: number;
}

export interface MistakeHighlight {
  id: string;
  level: 'minor' | 'major' | 'critical';
  category: string;
  mistakeName: string;
  description: string;
  text: string;
  position: number;
  speaker: string;
  suggestion: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface AIAnalysis {
  overallScore: number;
  categoryScores: {
    communication: number;
    professionalism: number;
    problem_solving: number;
    compliance: number;
    customer_satisfaction: number;
  };
  mistakes: MistakeHighlight[];
  recommendations: string[];
  summary: string;
  confidence: number;
  bannedWordsDetected?: Array<{ word: string; position: number }>;
}
