import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { DialogData, OpenAIEvaluationResult } from '../types/unified';
import AnalysisSummaryCards from './AnalysisSummaryCards';
import EnhancedDialogDetail from './EnhancedDialogDetail';

interface DialogResultsTabProps {
  dialog: DialogData;
  analysisData?: OpenAIEvaluationResult | null;
  onNavigateToSpeaker: (utteranceText: string) => void;
  onNavigateToAnalysis: (issueIndex: number) => void;
}

const DialogResultsTab: React.FC<DialogResultsTabProps> = ({
  dialog,
  analysisData,
  onNavigateToSpeaker,
  onNavigateToAnalysis
}) => {
  const evaluationData = analysisData || dialog.openaiEvaluation;

  if (!evaluationData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No analysis results available. Please run AI analysis first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {evaluationData.mistakes && evaluationData.mistakes.length > 0 && (
        <AnalysisSummaryCards mistakes={evaluationData.mistakes} />
      )}

      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-3xl font-bold text-primary">
                {evaluationData.overallScore || evaluationData.score}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Confidence: {Math.round((evaluationData.confidence || 0) * 100)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Scores */}
      {evaluationData.categoryScores && 
       Object.keys(evaluationData.categoryScores).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Category Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(evaluationData.categoryScores).map(([category, score]) => (
                <div key={category} className="p-3 border rounded">
                  <div className="text-sm font-medium capitalize mb-1">
                    {category.replace(/_/g, ' ')}
                  </div>
                  <div className="text-2xl font-bold">{String(score)}%</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {evaluationData.recommendations && evaluationData.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-6 space-y-2">
              {evaluationData.recommendations.map((rec, index) => (
                <li key={index} className="text-muted-foreground leading-relaxed">
                  {rec}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Detected Issues */}
      {evaluationData.mistakes && evaluationData.mistakes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detected Issues ({evaluationData.mistakes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <EnhancedDialogDetail 
              mistakes={evaluationData.mistakes} 
              utterances={dialog.speakerTranscription || []} 
              onNavigateToSpeaker={onNavigateToSpeaker}
              onNavigateToAnalysis={onNavigateToAnalysis}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DialogResultsTab;