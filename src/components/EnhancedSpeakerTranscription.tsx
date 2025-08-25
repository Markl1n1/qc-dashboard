import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { AlertTriangle } from 'lucide-react';
import { SpeakerUtterance } from '../types';
import { EvaluationMistake } from '../types/lemurEvaluation';
import { shouldExcludeFromHighlighting } from '../utils/textProcessing';
import DialogCopyButton from './DialogCopyButton';

interface EnhancedSpeakerTranscriptionProps {
  utterances: SpeakerUtterance[];
  mistakes?: EvaluationMistake[];
  highlightedMistake?: string | null;
}

const EnhancedSpeakerTranscription: React.FC<EnhancedSpeakerTranscriptionProps> = ({
  utterances,
  mistakes = [],
  highlightedMistake = null
}) => {
  const highlightMistakes = (text: string, speaker: string) => {
    if (!mistakes.length) return text;
    
    let highlightedText = text;
    const speakerMistakes = mistakes.filter(m => m.speaker === speaker);
    
    // Sort by position to avoid overlapping highlights
    speakerMistakes
      .sort((a, b) => b.text.length - a.text.length)
      .forEach(mistake => {
        if (mistake.text && highlightedText.includes(mistake.text)) {
          // Don't highlight if it's a speaker label or should be excluded
          if (shouldExcludeFromHighlighting(mistake.text)) {
            return;
          }
          
          const isHighlighted = highlightedMistake === mistake.text;
          const highlightClass = isHighlighted 
            ? "bg-yellow-300 text-yellow-900 px-1 rounded border-2 border-yellow-500 font-bold animate-pulse"
            : "bg-red-200 text-red-800 px-1 rounded underline decoration-red-500 decoration-2";
            
          highlightedText = highlightedText.replace(
            mistake.text,
            `<mark class="${highlightClass}">${mistake.text}</mark>`
          );
        }
      });
    
    return highlightedText;
  };

  const getSpeakerMistakeCount = (speaker: string) => {
    return mistakes.filter(m => m.speaker === speaker).length;
  };

  if (!utterances || utterances.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            No speaker-separated transcription available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Speaker Dialog</CardTitle>
          <DialogCopyButton utterances={utterances} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {utterances.map((utterance, index) => {
            const mistakeCount = getSpeakerMistakeCount(utterance.speaker);
            
            return (
              <div 
                key={index} 
                data-utterance-index={index}
                className={`p-4 rounded-lg border ${
                  utterance.speaker === 'Agent' 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-orange-50 border-orange-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={
                        utterance.speaker === 'Agent'
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-orange-100 text-orange-800 border-orange-300'
                      }
                    >
                      {utterance.speaker}
                    </Badge>
                    {mistakeCount > 0 && (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-xs text-red-600">{mistakeCount} issue{mistakeCount > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                  {utterance.confidence > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {(utterance.confidence * 100).toFixed(1)}% confidence
                    </div>
                  )}
                </div>
                <div 
                  className="text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: highlightMistakes(utterance.text, utterance.speaker)
                  }}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedSpeakerTranscription;
