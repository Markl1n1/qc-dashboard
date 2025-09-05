
export interface DeepgramConfig {
  model?: 'nova-2-general' | 'nova' | 'enhanced' | 'base' | 'nova-3-general';
  language?: string;
  detect_language?: boolean;
  diarize?: boolean;
  punctuate?: boolean;
  utterances?: boolean;
  smart_format?: boolean;
  profanity_filter?: boolean;
  redact?: string[];
  keywords?: string[];
  search?: string[];
  replace?: Record<string, string>;
  callback?: string;
}

export interface DeepgramOptions {
  language_detection?: boolean;
  speaker_labels?: boolean;
  language?: string;
  model?: string;
  smart_formatting?: boolean;
  profanity_filter?: boolean;
  punctuation?: boolean;
}

export interface DeepgramSpeaker {
  speaker: number;
  speaker_confidence?: number;
}

export interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word?: string;
  speaker?: number;
  speaker_confidence?: number;
}

export interface DeepgramUtterance {
  start: number;
  end: number;
  confidence: number;
  channel: number;
  transcript: string;
  words: DeepgramWord[];
  speaker?: number;
  id: string;
}

export interface DeepgramChannel {
  alternatives: Array<{
    transcript: string;
    confidence: number;
    words: DeepgramWord[];
    paragraphs?: {
      transcript: string;
      paragraphs: Array<{
        sentences: Array<{
          text: string;
          start: number;
          end: number;
        }>;
        start: number;
        end: number;
        num_words: number;
      }>;
    };
  }>;
}

export interface DeepgramResult {
  metadata: {
    transaction_key: string;
    request_id: string;
    sha256: string;
    created: string;
    duration: number;
    channels: number;
    models: string[];
    model_info: Record<string, any>;
  };
  results: {
    channels: DeepgramChannel[];
    utterances?: DeepgramUtterance[];
  };
}

export interface DeepgramTranscriptionResult {
  text: string;
  speakerUtterances: Array<{
    speaker: string;
    text: string;
    confidence: number;
    start: number;
    end: number;
  }>;
  detectedLanguage?: {
    language: string;
    confidence: number;
  };
  metadata?: {
    duration: number;
    channels: number;
    model: string;
  };
}

export interface DeepgramProgress {
  stage: 'uploading' | 'processing' | 'diarizing' | 'complete' | 'error';
  progress: number;
  message: string;
}
