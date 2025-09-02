import React, { useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ExternalLink, Languages } from 'lucide-react';
import { SpeakerUtterance } from '../types';
import { useLanguageStore } from '../store/languageStore';

interface DetectedIssue {
  rule_category?: string;
  comment?: string | { original?: string; russian?: string };
  utterance?: string;
  category?: string;
  description?: string;
  mistakeName?: string;
  comment_original?: string;
  comment_russian?: string;
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
  const { commentLanguage, setCommentLanguage } = useLanguageStore();

  const handleNavigateToUtterance = (utteranceText: string) => {
    setHighlightedIssue(utteranceText);
    onNavigateToSpeaker(utteranceText);
    onTabChange('transcription');
  };

  const getDisplayComment = (issue: DetectedIssue): string => {
    // Handle new format with original/russian object
    if (typeof issue.comment === 'object' && issue.comment) {
      if (commentLanguage === 'russian' && issue.comment.russian) {
        return issue.comment.russian;
      }
      return issue.comment.original || '';
    }
    
    // Handle database format with separate columns
    if (commentLanguage === 'russian' && issue.comment_russian) {
      return issue.comment_russian;
    }
    if (issue.comment_original) {
      return issue.comment_original;
    }
    
    // Fallback to legacy format
    return typeof issue.comment === 'string' ? issue.comment : '';
  };

  const hasRussianComments = mistakes.some(issue => {
    if (typeof issue.comment === 'object' && issue.comment?.russian) return true;
    if (issue.comment_russian) return true;
    return false;
  });

  if (!mistakes || mistakes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No detected issues in this conversation.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Detected Issues ({mistakes.length})</h3>
        {hasRussianComments && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCommentLanguage(commentLanguage === 'original' ? 'russian' : 'original')}
              className="flex items-center gap-2"
            >
              <Languages size={16} />
              {commentLanguage === 'original' ? 'Show Russian' : 'Show Original'}
            </Button>
          </div>
        )}
      </div>
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
                {getDisplayComment(mistake) || mistake.description || mistake.mistakeName || 'No description'}
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