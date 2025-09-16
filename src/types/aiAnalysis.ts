// Translation interfaces kept for comment translation in AI analysis results

// Basic analysis types - simplified for current usage

export interface AnalysisProgress {
  stage: 'initializing' | 'analyzing_text' | 'checking_guidelines' | 'generating_recommendations' | 'complete' | 'error';
  progress: number;
  message: string;
  currentStep?: string;
}