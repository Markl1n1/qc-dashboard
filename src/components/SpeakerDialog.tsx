
import React from 'react';
import { SpeakerUtterance } from '../types';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

interface SpeakerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  utterances: SpeakerUtterance[];
  dialogTitle: string;
}

const SpeakerDialog: React.FC<SpeakerDialogProps> = ({ 
  isOpen, 
  onClose, 
  utterances, 
  dialogTitle 
}) => {
  if (!utterances || utterances.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Speaker Analysis - {dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8 text-muted-foreground">
            No speaker-separated transcription available
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Speaker Analysis - {dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {utterances.map((utterance, index) => (
            <Card 
              key={index} 
              className={`${
                utterance.speaker === 'Agent' 
                  ? 'bg-blue-50 border-blue-100' 
                  : 'bg-orange-50 border-orange-100'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    utterance.speaker === 'Agent'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {utterance.speaker}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed">{utterance.text}</p>
                    {utterance.confidence > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Confidence: {(utterance.confidence * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SpeakerDialog;
