import React from 'react';
import { Card, CardContent } from './ui/card';
import { DialogData } from '../types/unified';
import EnhancedSpeakerDialog from './EnhancedSpeakerDialog';

interface DialogTranscriptionTabProps {
  dialog: DialogData;
  highlightedUtterance: string | null;
  onNavigateToAnalysis: (issueIndex: number) => void;
}

const DialogTranscriptionTab: React.FC<DialogTranscriptionTabProps> = ({
  dialog,
  highlightedUtterance,
  onNavigateToAnalysis
}) => {
  if (!dialog.speakerTranscription || dialog.speakerTranscription.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No transcription available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <EnhancedSpeakerDialog 
        utterances={dialog.speakerTranscription} 
        mistakes={dialog.openaiEvaluation?.mistakes || []} 
        highlightedUtterance={highlightedUtterance} 
        onNavigateToAnalysis={onNavigateToAnalysis}
        detectedLanguage={undefined} 
        metadata={undefined}
        analysisData={dialog.openaiEvaluation as any} 
      />
    </div>
  );
};

export default DialogTranscriptionTab;