// Placeholder types for evaluation categories
export interface EvaluationCategory {
  id: string;
  name: string;
  description: string;
  weight: number;
  enabled: boolean;
}

export interface CategoryScore {
  categoryId: string;
  score: number;
  maxScore: number;
  feedback?: string;
}