export interface User {
  id: string;
  email: string;
  name: string;
  role: 'supervisor' | 'agent';
}

export interface Dialog {
  id: string;
  fileName: string;
  status: 'uploaded' | 'pending' | 'processing' | 'completed' | 'failed';
  assignedAgent: string;
  assignedSupervisor: string;
  rating?: number; // 1-5 scale with 0.1 precision (e.g., 4.2, 3.6)
  uploadDate: string;
  transcription?: string;
  speakerTranscription?: SpeakerUtterance[]; // New field for speaker-separated data
  russianTranscription?: string; // Russian translation of full transcript
  russianSpeakerTranscription?: SpeakerUtterance[]; // Russian translation of speaker data
  translationStatus?: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
  translationProgress?: number; // 0-100
  isTranslating?: boolean;
  currentLanguage?: 'original' | 'russian'; // Which version is currently being displayed
  translations?: {
    transcription?: {
      en?: string;
      de?: string;
      pl?: string;
      es?: string;
      fr?: string;
      ru?: string;
    };
    speakers?: {
      en?: any;
      de?: any;
      pl?: any;
      es?: any;
      fr?: any;
      ru?: any;
    };
    raw?: Record<string, string>; // Full transcript translations
  };
  analysis?: AnalysisResult;
  error?: string;
  // Zero Data Retention tracking
  zdrEnabled?: boolean;
  deletionStatus?: 'pending' | 'completed' | 'failed';
  deletedAt?: string;
  lemurPurged?: boolean;
  transcriptId?: string;
  // Multi-file segment support
  isSegmented?: boolean;
  segmentCount?: number;
  segmentIndex?: number;
  parentDialogId?: string;
  childDialogIds?: string[];
  // LeMUR Evaluation - import from dedicated types file
  lemurEvaluation?: import('./lemurEvaluation').LeMUREvaluationResult;
  qualityScore?: number;
  // OpenAI Evaluation - import from dedicated types file
  openaiEvaluation?: import('./openaiEvaluation').OpenAIEvaluationResult;
}

export interface AnalysisResult {
  overallScore: number; // 1-5 scale
  mistakes: Mistake[];
  summary: string;
  categoryScores?: Record<string, number>;
  sentiment?: {
    agent: 'positive' | 'neutral' | 'negative';
    customer: 'positive' | 'neutral' | 'negative';
  };
  conversationFlow?: any;
  recommendations?: string[];
  confidence?: number;
  processingTime?: number;
}

export interface Mistake {
  id: string;
  level: 1 | 2 | 3;
  category: string;
  description: string;
  text: string;
  position: number;
  suggestion?: string;
}

export interface SpeakerUtterance {
  speaker: 'Agent' | 'Customer';
  text: string;
  confidence: number;
  start: number;
  end: number;
}

export interface Language {
  code: string;
  name: string;
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Russian' },
  { code: 'pl', name: 'Polish' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
];

export const AGENTS = [
  'Agent Smith',
  'Agent Johnson',
  'Agent Williams',
  'Agent Brown',
  'Agent Davis',
  'Agent Miller',
  'Agent Wilson',
  'Agent Moore',
];

export type TranscriptionProvider = 'whisper' | 'assemblyai';

export interface AssemblyAIConfig {
  apiKey: string;
  speech_model?: 'universal' | 'nano';
  speaker_labels?: boolean;
  speakers_expected?: number;
  auto_chapters?: boolean;
  sentiment_analysis?: boolean;
  language_code?: string;
  language_detection?: boolean;
  zeroDataRetention?: boolean;
  deleteAfterProcessing?: boolean;
  deleteLemurData?: boolean;
}

// Unified progress interface that works for both providers
export interface UnifiedTranscriptionProgress {
  stage: 'loading' | 'downloading' | 'uploading' | 'queued' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
}

// Translation progress interface
export interface TranslationProgress {
  stage: 'initializing' | 'translating_text' | 'translating_speakers' | 'complete' | 'error';
  progress: number;
  message: string;
  currentProvider?: string;
  currentUtterance?: number;
  totalUtterances?: number;
}

// Background translation queue item
export interface TranslationQueueItem {
  dialogId: string;
  priority: number;
  createdAt: Date;
}

// Multi-file processing progress
export interface MultiFileProgress {
  currentFileIndex: number;
  totalFiles: number;
  currentFileProgress: number;
  overallProgress: number;
  stage: string;
  message: string;
}
