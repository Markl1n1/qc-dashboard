// Placeholder types for missing lemurEvaluation types
export interface LemurEvaluation {
  id: string;
  name: string;
  prompt: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface LemurModel {
  id: string;
  name: string;
  description?: string;
}

export interface EvaluationRule {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  pattern?: string;
  enabled: boolean;
  ruleType?: string;
  category?: string;
  language?: string;
  required?: boolean;
  priority?: string;
  culturalContext?: string;
  weight?: string;
  examples?: {
    good?: string[];
    bad?: string[];
  };
}

export interface EvaluationCategory {
  id: string;
  name: string;
  description: string;
  rules: EvaluationRule[];
  enabled?: boolean;
  weight?: number;
  color?: string;
}

export interface EvaluationConfiguration {
  id: string;
  name: string;
  description?: string;
  categories: EvaluationCategory[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
  createdAt?: string;
  rules?: EvaluationRule[];
  scoringMethod?: string;
}

export interface EvaluationMistake {
  id: string;
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestion?: string;
  timestamp?: number;
  speaker?: string;
  text?: string;
}

export interface SupportedLanguage {
  code: string;
  name: string;
}

export type SupportedLanguageCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'nl' | 'pl' | 'ru';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'ru', name: 'Russian' }
];

export const DEFAULT_RULE_CATEGORIES: EvaluationCategory[] = [
  {
    id: 'communication',
    name: 'Communication',
    description: 'Communication effectiveness and clarity',
    rules: [],
    enabled: true,
    weight: 1.0,
    color: '#3B82F6'
  },
  {
    id: 'professionalism',
    name: 'Professionalism',
    description: 'Professional conduct and etiquette',
    rules: [],
    enabled: true,
    weight: 1.0,
    color: '#10B981'
  }
];