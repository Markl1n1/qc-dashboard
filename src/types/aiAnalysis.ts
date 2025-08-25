export interface APIProvider {
  name: string;
  type: 'openai' | 'google' | 'huggingface' | 'libretranslate' | 'grok' | 'deepseek';
  enabled: boolean;
  priority: number;
}

export interface TranslationProvider extends APIProvider {
  supportedLanguages: string[];
  costPerUnit?: number;
}

export interface TranslationResult {
  text: string;
  provider: string;
  confidence: number;
  cost?: number;
  processingTime: number;
}

export interface MultiProviderTranslationResult {
  primary: TranslationResult;
  alternatives?: TranslationResult[];
  backTranslation?: string;
  qualityScore: number;
}

export interface QualityGuideline {
  id: string;
  name: string;
  category: 'communication' | 'process' | 'technical' | 'customer_satisfaction';
  description: string;
  weight: number; // 0-1
  criteria: string[];
  examples: {
    good: string[];
    bad: string[];
  };
}

export interface AnalysisConfiguration {
  guidelines: QualityGuideline[];
  enabledCategories: string[];
  scoringWeights: Record<string, number>;
  mistakeThresholds: {
    minor: number;
    moderate: number;
    critical: number;
  };
  customInstructions?: string;
}

export interface DialogAnalysisResult {
  overallScore: number;
  categoryScores: Record<string, number>;
  mistakes: EnhancedMistake[];
  recommendations: string[];
  sentiment: {
    agent: 'positive' | 'neutral' | 'negative';
    customer: 'positive' | 'neutral' | 'negative';
  };
  conversationFlow: ConversationFlowAnalysis;
  summary: string;
  confidence: number;
  processingTime: number;
}

export interface EnhancedMistake {
  id: string;
  level: 1 | 2 | 3;
  category: string;
  subcategory?: string;
  description: string;
  text: string;
  position: number;
  speaker: 'Agent' | 'Customer';
  suggestion: string;
  impact: 'low' | 'medium' | 'high';
  guideline?: string;
  confidence: number;
}

export interface ConversationFlowAnalysis {
  opening: {
    score: number;
    issues: string[];
  };
  problemIdentification: {
    score: number;
    timeToIdentify: number;
    clarity: number;
  };
  resolution: {
    score: number;
    effectiveness: number;
    customerSatisfaction: number;
  };
  closing: {
    score: number;
    followUpOffered: boolean;
    customerConfirmation: boolean;
  };
}

export interface AnalysisProgress {
  stage: 'initializing' | 'analyzing_text' | 'checking_guidelines' | 'generating_recommendations' | 'complete' | 'error';
  progress: number;
  message: string;
  currentStep?: string;
}

export interface APIKeyConfig {
  openai?: string;
  google?: string;
  libretranslate?: string;
  grok?: string;
  deepseek?: string;
  assemblyai?: string;
  isValid: boolean;
  lastValidated?: string;
}

export interface AnalysisProvider {
  name: string;
  type: 'openai' | 'grok' | 'deepseek';
  enabled: boolean;
  priority: number;
  costPerUnit?: number;
}