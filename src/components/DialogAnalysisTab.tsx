import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Play, Loader2 } from 'lucide-react';
import { DialogData } from '../types/unified';

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
  const renderProgressIndicator = () => {
    if (!isAnalyzing) return null;
    
    return (
      <div className="mt-4 p-4 border rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="font-medium">Starting AI analysis...</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300 animate-pulse" 
            style={{ width: '30%' }} 
          />
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Quality Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={onStartAnalysis} 
          disabled={isAnalyzing || !dialog.speakerTranscription} 
          size="lg"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Start AI Analysis
            </>
          )}
        </Button>
        {!dialog.speakerTranscription && (
          <p className="text-sm text-muted-foreground mt-2">
            Transcription required before analysis can be performed.
          </p>
        )}
        
        {renderProgressIndicator()}
      </CardContent>
    </Card>
  );
};

export default DialogAnalysisTab;