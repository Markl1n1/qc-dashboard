export interface SalesAnalysisResult {
  overallScore: number;
  talkRatio: {
    agent: number;
    customer: number;
  };
  salesStages: {
    opening: SalesStageScore;
    needsAssessment: SalesStageScore;
    productPresentation: SalesStageScore;
    objectionHandling: SalesStageScore;
    closing: SalesStageScore;
  };
  sentiment: {
    agent: SentimentOverTime[];
    customer: SentimentOverTime[];
    overall: 'positive' | 'neutral' | 'negative';
  };
  keyMoments: KeyMoment[];
  actionItems: string[];
  buyingSignals: BuyingSignal[];
  objections: Objection[];
  compliance: ComplianceCheck[];
  recommendations: string[];
  summary: string;
  confidence: number;
  processingTime: number;
  transcriptId: string;
}

export interface SalesStageScore {
  score: number; // 0-100
  feedback: string;
  timeSpent: number; // seconds
  keyPhases: string[];
  improvements: string[];
}

export interface SentimentOverTime {
  timestamp: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  context: string;
}

export interface KeyMoment {
  timestamp: number;
  type: 'objection' | 'buying_signal' | 'competitive_mention' | 'pricing_discussion' | 'decision_point';
  description: string;
  importance: 'high' | 'medium' | 'low';
  speaker: 'Agent' | 'Customer';
  context: string;
}

export interface BuyingSignal {
  timestamp: number;
  signal: string;
  confidence: number;
  context: string;
  strength: 'strong' | 'moderate' | 'weak';
}

export interface Objection {
  timestamp: number;
  objection: string;
  category: 'price' | 'timing' | 'authority' | 'need' | 'competition' | 'other';
  handled: boolean;
  agentResponse: string;
  effectiveness: number; // 0-100
}

export interface ComplianceCheck {
  requirement: string;
  met: boolean;
  evidence?: string;
  timestamp?: number;
  importance: 'critical' | 'important' | 'recommended';
}

export interface SalesAnalysisProgress {
  stage: 'initializing' | 'uploading_transcript' | 'analyzing_conversation' | 'extracting_insights' | 'complete' | 'error';
  progress: number;
  message: string;
  currentStep?: string;
}