
export interface EvaluationMistake {
  id: string;
  level: 'minor' | 'major' | 'critical';
  category: string;
  subcategory?: string;
  mistakeName?: string; // Short 3-4 word name for compact format
  description: string;
  text: string;
  position: number;
  speaker: 'Agent' | 'Customer';
  suggestion: string;
  impact: 'low' | 'medium' | 'high';
  ruleId?: string;
  confidence: number;
  timestamp?: number;
}

export interface EvaluationCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  weight?: number;
  enabled: boolean;
}

export interface EvaluationRule {
  id: string;
  name: string;
  category: string;
  description: string;
  weight: number; // 0-1
  ruleType: 'global' | 'language-specific'; // NEW: Rule classification
  language?: SupportedLanguage; // Required if ruleType is 'language-specific'
  culturalContext?: string; // Additional context for language-specific rules
  required: boolean; // Must be followed
  examples: {
    good: string[];
    bad: string[];
  };
  priority: 'high' | 'medium' | 'low';
}

export interface BannedWord {
  id: string;
  word: string;
  language: string;
  context?: string; // When this word is problematic
  severity: 'warning' | 'critical';
  replacement?: string; // Suggested alternative
  category: 'profanity' | 'inappropriate' | 'company_policy' | 'competitive' | 'other';
}

export interface EvaluationConfiguration {
  id: string;
  name: string;
  description: string;
  rules: EvaluationRule[];
  bannedWords: BannedWord[];
  categories: EvaluationCategory[];
  enabledLanguages: string[];
  mistakeWeights: {
    minor: number;
    major: number;
    critical: number;
  };
  scoringMethod: 'weighted' | 'penalty' | 'hybrid';
  customInstructions?: string;
  promptContextId?: string; // NEW: ID of the prompt context to use
  createdAt: string;
  updatedAt: string;
}

export interface LeMUREvaluationResult {
  overallScore: number; // 0-100
  categoryScores: Record<string, number>;
  mistakes: EvaluationMistake[];
  ruleCompliance: Record<string, boolean>;
  bannedWordsDetected: BannedWord[];
  recommendations: string[];
  summary: string;
  confidence: number;
  processingTime: number;
  tokenUsage: {
    input: number;
    output: number;
    cost?: number;
  };
  configurationUsed: string;
  analysisId: string;
  detectedLanguage?: SupportedLanguage; // NEW: Track detected language
}

export interface LeMUREvaluationProgress {
  stage: 'initializing' | 'preprocessing' | 'analyzing' | 'post_processing' | 'complete' | 'error';
  progress: number;
  message: string;
  currentStep?: string;
  estimatedTimeRemaining?: number;
}

export interface LeMURPromptTemplate {
  systemPrompt: string;
  evaluationPrompt: string;
  outputFormat: string;
  model: 'claude-3-5-sonnet' | 'claude-3-haiku' | 'claude-3-opus'; // Only actual LeMUR API model names
  maxTokens: number;
  temperature: number;
  language?: SupportedLanguage; // NEW: Target language for the prompt
}

export interface TokenUsageEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  model: string;
}

// Language-specific evaluation configurations
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'pl', name: 'Polish' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'ru', name: 'Russian' }
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

// Default evaluation categories (can be customized)
export const DEFAULT_RULE_CATEGORIES: EvaluationCategory[] = [
  { id: 'critical', name: 'Critical', color: '0 100% 50%', enabled: true }, // Red
  { id: 'mistake', name: 'Mistake', color: '16 100% 66%', enabled: true }, // Orange Red
  { id: 'not_recommended', name: 'Not Recommended', color: '39 100% 50%', enabled: true }, // Orange
  { id: 'allowed', name: 'Allowed', color: '120 73% 75%', enabled: true }, // Light Green
  { id: 'correct', name: 'Correct', color: '120 100% 50%', enabled: true } // Green
];

// Mistake level configurations with enhanced semantic tokens
export const MISTAKE_LEVELS = {
  minor: {
    name: 'Minor',
    description: 'Small improvement opportunity',
    color: 'hsl(var(--chart-1))',
    weight: 1,
    impact: 'low' as const
  },
  major: {
    name: 'Major',
    description: 'Rule violation or significant mistake',
    color: 'hsl(var(--chart-2))',
    weight: 3,
    impact: 'medium' as const
  },
  critical: {
    name: 'Critical',
    description: 'Banned word or critical policy violation',
    color: 'hsl(var(--destructive))',
    weight: 10,
    impact: 'high' as const
  }
} as const;
