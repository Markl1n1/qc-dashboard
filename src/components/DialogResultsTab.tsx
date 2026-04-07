import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { DialogData, OpenAIEvaluationResult } from '../types/unified';
import { OptimizedAnalysisSummaryCards, OptimizedEnhancedDialogDetail } from './LazyComponents';
import { useTranslation } from '../i18n';

interface DialogResultsTabProps {
  dialog: DialogData;
  analysisData?: OpenAIEvaluationResult | null | undefined;
  onNavigateToSpeaker: (utteranceText: string) => void;
  onNavigateToAnalysis: (issueIndex: number) => void;
}

const DialogResultsTab: React.FC<DialogResultsTabProps> = ({
  dialog,
  analysisData,
  onNavigateToSpeaker,
  onNavigateToAnalysis
}) => {
  const { t } = useTranslation();
  const evaluationData = analysisData || dialog.openaiEvaluation;

  if (!evaluationData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            {t('analysis.noResults')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {evaluationData.mistakes && evaluationData.mistakes.length > 0 && (
        <OptimizedAnalysisSummaryCards mistakes={evaluationData.mistakes} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('analysis.overallScore')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-3xl font-bold text-primary">
                {evaluationData.overallScore || evaluationData.score}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {t('analysis.confidence')}: {Math.round((evaluationData.confidence || 0) * 100)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {evaluationData.categoryScores && 
       Object.keys(evaluationData.categoryScores).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('analysis.categoryScores')}</CardTitle>
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

      {evaluationData.recommendations && evaluationData.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('analysis.recommendations')}</CardTitle>
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

      {evaluationData.mistakes && evaluationData.mistakes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('analysis.detectedIssues')} ({evaluationData.mistakes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <OptimizedEnhancedDialogDetail 
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
