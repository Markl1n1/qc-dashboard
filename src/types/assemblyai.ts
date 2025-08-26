
export type AssemblyAIRegion = 'us' | 'eu';

export type AssemblyAIModel = 'universal-2' | 'nano';

export type PIIPolicy = 'remove' | 'mask' | 'entity_type';

export interface AssemblyAIRegionalConfig {
  region: AssemblyAIRegion;
  endpoint: string;
  name: string;
  description: string;
}

export interface AssemblyAIEnhancedOptions {
  // Core options
  speaker_labels?: boolean;
  speakers_expected?: number;
  language_detection?: boolean;
  language_code?: string;
  speech_model?: AssemblyAIModel;
  disfluencies?: boolean;
  
  // Advanced content analysis
  content_safety_labels?: boolean;
  pii_policy?: PIIPolicy;
  entity_detection?: boolean;
  sentiment_analysis?: boolean;
  auto_chapters?: boolean;
  summarization?: boolean;
  
  // Audio processing
  filter_profanity?: boolean;
  dual_channel?: boolean;
  boost_param?: string;
  
  // Custom vocabulary
  custom_spelling?: Array<{ from: string; to: string }>;
  
  // Regional settings
  region?: AssemblyAIRegion;
  
  // Data retention
  delete_after_seconds?: number;
}

export interface AssemblyAITranscriptResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  utterances?: Array<{
    speaker: string;
    text: string;
    confidence: number;
    start: number;
    end: number;
  }>;
  language_code?: string;
  language_confidence?: number;
  language_detected?: string;
  error?: string;
  
  // Enhanced features
  content_safety_labels?: {
    status: string;
    results: Array<{
      text: string;
      labels: Array<{
        label: string;
        confidence: number;
        severity: number;
      }>;
    }>;
  };
  
  pii_redacted_audio_url?: string;
  entities?: Array<{
    entity_type: string;
    text: string;
    start: number;
    end: number;
  }>;
  
  sentiment_analysis_results?: Array<{
    text: string;
    start: number;
    end: number;
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    confidence: number;
  }>;
  
  chapters?: Array<{
    gist: string;
    headline: string;
    summary: string;
    start: number;
    end: number;
  }>;
  
  summary?: string;
}

export interface AssemblyAIApiKey {
  id: string;
  key: string;
  name: string;
  region: AssemblyAIRegion;
  isActive: boolean;
  usageCount: number;
  lastUsed?: Date;
  quotaExceeded?: boolean;
  errorCount: number;
}
