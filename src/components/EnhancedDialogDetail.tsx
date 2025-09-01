import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ExternalLink } from 'lucide-react';
import { SpeakerUtterance } from '../types';

interface DetectedIssue {
  rule_category?: string;
  comment?: string;
  utterance?: string;
  category?: string;
  description?: string;
  mistakeName?: string;
}

interface EnhancedDialogDetailProps {
  mistakes: DetectedIssue[];
  utterances: SpeakerUtterance[];
  onNavigateToSpeaker: (utteranceText: string) => void;
  currentTab: string;
  onTabChange: (tab: string) => void;
}

const EnhancedDialogDetail: React.FC<EnhancedDialogDetailProps> = ({
  mistakes,
  utterances,
  onNavigateToSpeaker,
  currentTab,
  onTabChange
}) => {
  const [highlightedIssue, setHighlightedIssue] = useState<string | null>(null);

  const handleNavigateToUtterance = (utteranceText: string) => {
    setHighlightedIssue(utteranceText);
    onNavigateToSpeaker(utteranceText);
    onTabChange('transcription');
  };

  return (
    <div className="space-y-4">
      {mistakes.map((mistake, index) => (
        <div 
          key={index} 
          className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          id={`issue-${index}`}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-medium">
                Rule Category
              </Badge>
              <span className="text-sm font-medium text-foreground">
                {mistake.rule_category || mistake.category || 'Unknown'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-medium">
                Comment
              </Badge>
              <span className="text-sm text-foreground">
                {mistake.comment || mistake.description || mistake.mistakeName || 'No description'}
              </span>
            </div>
            
            {mistake.utterance && (
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="font-medium">
                  Utterance
                </Badge>
                <div className="flex-1">
                  <div className="bg-muted p-3 rounded-lg text-sm">
                    "{mistake.utterance}"
                  </div>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="mt-2 h-auto p-0 text-primary hover:underline"
                    onClick={() => handleNavigateToUtterance(mistake.utterance!)}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View in Speaker Dialog
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default EnhancedDialogDetail;