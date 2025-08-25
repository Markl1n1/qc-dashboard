export type TranscriptionProvider = 'assemblyai';

export interface AssemblyAIConfig {
  speaker_labels?: boolean;
  speakers_expected?: number;
  language_detection?: boolean;
  zeroDataRetention?: boolean;
}

export interface UnifiedTranscriptionProgress {
  stage: 'uploading' | 'queued' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
}

export interface SpeakerUtterance {
  speaker: string;
  text: string;
  confidence: number;
  start: number;
  end: number;
}

export interface Dialog {
  id: string;
  fileName: string;
  transcription?: string;
  speakerTranscription?: SpeakerUtterance[];
  status: 'processing' | 'completed' | 'failed';
  assignedAgent: string;
  assignedSupervisor: string;
  uploadDate: string;
  error?: string;
  tokenEstimation?: {
    audioLengthMinutes: number;
    estimatedCost: number;
  };
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
}
