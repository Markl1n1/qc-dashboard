import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Play, Loader2, CheckCircle } from 'lucide-react';
import { DialogData } from '../types/unified';
import { useBackgroundAnalysis } from '../hooks/useBackgroundAnalysis';
import { useTranslation } from '../i18n';

interface DialogAnalysisTabProps {
  dialog: DialogData;
  isAnalyzing: boolean;
  onStartAnalysis: () => void;
}

const DialogAnalysisTab: React.FC<DialogAnalysisTabProps> = ({
  dialog,
  isAnalyzing,
  onStartAnalysis
}) => {
  const { t } = useTranslation();
  const { addAnalysis } = useBackgroundAnalysis();

  const handleStartAnalysis = () => {
    addAnalysis(dialog.id, dialog.fileName);
    onStartAnalysis();
  };

  const hasExistingAnalysis = dialog.openaiEvaluation;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('analysis.aiQualityAnalysis')}</CardTitle>
          {hasExistingAnalysis && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {t('analysis.analysisComplete')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {hasExistingAnalysis && (
            <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-200">
                {t('analysis.analysisCompleted')}
              </p>
            </div>
          )}
          
          <Button 
            onClick={handleStartAnalysis} 
            disabled={isAnalyzing || !dialog.speakerTranscription} 
            size="lg"
            variant={hasExistingAnalysis ? "outline" : "default"}
          >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('analysis.analyzing')}
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              {hasExistingAnalysis ? t('analysis.rerunAnalysis') : t('analysis.startAnalysis')}
            </>
          )}
          </Button>
          
          {isAnalyzing && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                {t('analysis.backgroundRunning')}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300">
                {t('analysis.notificationOnComplete')}
              </p>
            </div>
          )}

          {!dialog.speakerTranscription && (
            <p className="text-sm text-muted-foreground">
              {t('dialog.transcriptionRequired')}
            </p>
          )}
          
          {isAnalyzing && (
            <div className="mt-4 p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="font-medium">{t('analysis.startingAnalysis')}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 animate-pulse" 
                  style={{ width: '30%' }} 
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DialogAnalysisTab;
