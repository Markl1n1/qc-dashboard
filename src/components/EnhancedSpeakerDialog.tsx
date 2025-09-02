import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Clock, Copy, User, Users, AlertTriangle, ExternalLink } from 'lucide-react';
import { SpeakerUtterance } from '../types';
import { copyToClipboard, formatDialogForCopy } from '../utils/dialogFormatting';
import { toast } from 'sonner';
import { useSpeakerMapping } from '../hooks/useSpeakerMapping';

interface DetectedIssue {
  rule_category?: string;
  comment?: string;
  utterance?: string;
  category?: string;
  description?: string;
  mistakeName?: string;
}

interface EnhancedSpeakerDialogProps {
  utterances: SpeakerUtterance[];
  mistakes?: DetectedIssue[];
  highlightedUtterance?: string | null;
  onNavigateToAnalysis?: (issueIndex: number) => void;
  detectedLanguage?: {
    language: string;
    confidence: number;
  };
  metadata?: {
    duration: number;
    model: string;
  };
  analysisData?: {
    speaker_0?: string;
    speaker_1?: string;
    role_0?: string;
    role_1?: string;
  };
}

const EnhancedSpeakerDialog: React.FC<EnhancedSpeakerDialogProps> = ({
  utterances,
  mistakes = [],
  highlightedUtterance,
  onNavigateToAnalysis,
  detectedLanguage,
  metadata,
  analysisData
}) => {
  const { mapSpeakerName } = useSpeakerMapping(analysisData || null);
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getSpeakerStyle = (speaker: string) => {
    const speakerColors = [
      {
        backgroundColor: 'hsl(210, 100%, 97%)',
        borderColor: 'hsl(210, 100%, 85%)',
        textColor: 'hsl(210, 100%, 25%)'
      },
      {
        backgroundColor: 'hsl(120, 60%, 97%)',
        borderColor: 'hsl(120, 60%, 85%)',
        textColor: 'hsl(120, 60%, 25%)'
      },
      {
        backgroundColor: 'hsl(280, 60%, 97%)',
        borderColor: 'hsl(280, 60%, 85%)',
        textColor: 'hsl(280, 60%, 25%)'
      },
      {
        backgroundColor: 'hsl(30, 100%, 97%)',
        borderColor: 'hsl(30, 100%, 85%)',
        textColor: 'hsl(30, 100%, 25%)'
      }
    ];

    const cleanSpeaker = speaker
      .replace(/^Speaker\s+Speaker\s*/, '')
      .replace(/^Speaker\s*/, '');
    
    const speakerIndex = parseInt(cleanSpeaker) || 0;
    const colorIndex = speakerIndex % speakerColors.length;
    return speakerColors[colorIndex];
  };

  const mergeConsecutiveUtterances = (utterances: SpeakerUtterance[]): SpeakerUtterance[] => {
    if (!utterances || utterances.length === 0) return [];

    const merged: SpeakerUtterance[] = [];
    let current = { 
      ...utterances[0], 
      speaker: utterances[0].speaker
        .replace(/^Speaker\s+Speaker\s*/, 'Speaker ')
        .replace(/^Speaker\s+/, 'Speaker ')
    };

    for (let i = 1; i < utterances.length; i++) {
      const next = { 
        ...utterances[i], 
        speaker: utterances[i].speaker
          .replace(/^Speaker\s+Speaker\s*/, 'Speaker ')
          .replace(/^Speaker\s+/, 'Speaker ')
      };
      
      if (current.speaker === next.speaker) {
        current.text = `${current.text}\n${next.text}`;
        current.end = next.end;
        current.confidence = Math.min(current.confidence, next.confidence);
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    
    merged.push(current);
    return merged;
  };

  const getUtteranceMistakes = (utteranceText: string) => {
    return mistakes.filter(mistake => {
      if (!mistake.utterance) return false;
      
      // Clean both texts for comparison
      const cleanUtteranceText = utteranceText.toLowerCase().replace(/\s+/g, ' ').trim();
      const cleanMistakeText = mistake.utterance.toLowerCase().replace(/\s+/g, ' ').trim();
      
      // Use more precise matching - only exact and strict substring matches
      return (
        // Exact match
        cleanUtteranceText === cleanMistakeText ||
        // Mistake text is contained in utterance (for merged utterances)
        cleanUtteranceText.includes(cleanMistakeText) ||
        // Utterance text is contained in mistake (rare case)
        (cleanMistakeText.length > cleanUtteranceText.length && 
         cleanMistakeText.includes(cleanUtteranceText))
      );
    });
  };

  const checkFuzzyMatch = (text1: string, text2: string): boolean => {
    // For shorter mistake text, use more lenient matching
    const minLength = Math.min(text1.length, text2.length);
    if (minLength < 20) {
      // For short texts, check if they share significant words
      const words1 = text1.split(' ').filter(w => w.length > 3);
      const words2 = text2.split(' ').filter(w => w.length > 3);
      const commonWords = words1.filter(w => words2.includes(w));
      return commonWords.length >= Math.min(2, Math.min(words1.length, words2.length));
    }
    
    // For longer texts, use substring matching
    const shorter = text1.length < text2.length ? text1 : text2;
    const longer = text1.length < text2.length ? text2 : text1;
    
    // Check if 70% of the shorter text appears in the longer text
    const threshold = Math.floor(shorter.length * 0.7);
    for (let i = 0; i <= shorter.length - threshold; i++) {
      const substring = shorter.substring(i, i + threshold);
      if (longer.includes(substring)) {
        return true;
      }
    }
    return false;
  };

  const checkWordMatch = (text1: string, text2: string): boolean => {
    const words1 = text1.split(' ').filter(w => w.length > 2);
    const words2 = text2.split(' ').filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return false;
    
    const commonWords = words1.filter(w => words2.includes(w));
    // Require at least 50% word overlap for shorter texts
    const minWords = Math.min(words1.length, words2.length);
    return commonWords.length >= Math.max(1, Math.floor(minWords * 0.5));
  };

  const mergedUtterances = mergeConsecutiveUtterances(utterances);

  const handleCopyDialog = async () => {
    const formattedText = formatDialogForCopy(mergedUtterances);
    const success = await copyToClipboard(formattedText);
    if (success) {
      toast.success('Dialog copied to clipboard');
    } else {
      toast.error('Failed to copy dialog');
    }
  };

  const speakerStats = mergedUtterances.reduce((acc, utterance) => {
    const speaker = utterance.speaker;
    if (!acc[speaker]) {
      acc[speaker] = { count: 0, totalDuration: 0 };
    }
    acc[speaker].count++;
    acc[speaker].totalDuration += utterance.end - utterance.start;
    return acc;
  }, {} as Record<string, { count: number; totalDuration: number }>);

  return (
    <div className="space-y-4">
      {/* Metadata Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Transcription Results
              <Badge variant="outline">{mergedUtterances.length} segments</Badge>
              {mistakes.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {mistakes.length} issues
                </Badge>
              )}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleCopyDialog}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Dialog
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            {detectedLanguage && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Language</Badge>
                <span>{detectedLanguage.language}</span>
                <span className="text-foreground/70">
                  ({Math.round(detectedLanguage.confidence * 100)}% confidence)
                </span>
              </div>
            )}
            {metadata && (
              <>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(metadata.duration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{metadata.model}</Badge>
                </div>
              </>
            )}
          </div>

          {/* Speaker Statistics */}
          <div className="mt-4 flex flex-wrap gap-4">
            {Object.entries(speakerStats).map(([speaker, stats]) => {
              const style = getSpeakerStyle(speaker);
              
              return (
                <div
                  key={speaker}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: style.backgroundColor,
                    borderColor: style.borderColor,
                    color: style.textColor
                  }}
                >
                  <User className="h-4 w-4" />
                  <span className="font-medium">{mapSpeakerName(speaker)}</span>
                  <Badge variant="outline" className="text-xs font-bold" style={{ color: style.textColor, borderColor: style.borderColor }}>
                    {stats.count} segments
                  </Badge>
                  <span className="text-xs font-medium">
                    {formatTime(stats.totalDuration)} talk time
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Conversation Display */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-96 w-full">
            <div className="p-6 space-y-4">
              {mergedUtterances.map((utterance, index) => {
                const style = getSpeakerStyle(utterance.speaker);
                const utteranceMistakes = getUtteranceMistakes(utterance.text);
                const isHighlighted = highlightedUtterance && utterance.text.includes(highlightedUtterance);
                
                return (
                  <div
                    key={index}
                    className={`flex gap-4 p-4 rounded-lg border-l-4 transition-all hover:shadow-sm ${
                      isHighlighted ? 'ring-2 ring-primary shadow-lg' : ''
                    } ${utteranceMistakes.length > 0 ? 'border-red-200 bg-red-50/50' : ''}`}
                    style={{
                      backgroundColor: isHighlighted ? 'hsl(var(--primary) / 0.1)' : 
                                      utteranceMistakes.length > 0 ? 'hsl(var(--destructive) / 0.05)' : 
                                      style.backgroundColor,
                      borderLeftColor: utteranceMistakes.length > 0 ? 'hsl(var(--destructive))' : style.borderColor
                    }}
                  >
                    <div className="flex-shrink-0 flex items-start">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center relative"
                        style={{ backgroundColor: style.borderColor }}
                      >
                        <User className="h-4 w-4" style={{ color: style.textColor }} />
                        {utteranceMistakes.length > 0 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                            <AlertTriangle className="h-2 w-2 text-destructive-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span 
                          className="font-medium text-sm"
                          style={{ color: style.textColor }}
                        >
                          {mapSpeakerName(utterance.speaker)}
                        </span>
                        <span className="text-xs text-foreground/70">
                          {formatTime(utterance.start)} - {formatTime(utterance.end)}
                        </span>
                        <Badge variant="outline" className="text-xs font-bold" style={{ color: style.textColor, borderColor: style.borderColor }}>
                          {Math.round(utterance.confidence * 100)}%
                        </Badge>
                        {utteranceMistakes.length > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {utteranceMistakes.length} issue{utteranceMistakes.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm leading-relaxed" style={{ color: style.textColor }}>
                        {utterance.text.split('\n').map((line, lineIndex) => (
                          <div key={lineIndex} className="mb-1">
                            {line}
                          </div>
                        ))}
                      </div>

                      {/* Show mistakes for this utterance */}
                      {utteranceMistakes.length > 0 && onNavigateToAnalysis && (
                        <div className="mt-3 pt-3 border-t border-destructive/20">
                          <div className="text-xs font-medium text-destructive mb-2">
                            Issues in this utterance:
                          </div>
                          <div className="space-y-2">
                            {utteranceMistakes.map((mistake, mistakeIndex) => (
                              <div key={mistakeIndex} className="text-xs bg-destructive/10 p-2 rounded border border-destructive/20">
                                <div className="font-medium">{mistake.rule_category || 'Issue'}</div>
                                <div className="text-muted-foreground">
                                  {typeof mistake.comment === 'object' && mistake.comment ? 
                                    ((mistake.comment as any).original || (mistake.comment as any).russian || '') : 
                                    (mistake.comment || mistake.description || '')
                                  }
                                </div>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs text-destructive hover:underline mt-1"
                                  onClick={() => {
                                    const issueIndex = mistakes.findIndex(m => 
                                      m.utterance === mistake.utterance && m.comment === mistake.comment
                                    );
                                    if (issueIndex !== -1) {
                                      onNavigateToAnalysis(issueIndex);
                                    }
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  View in Analysis Results
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedSpeakerDialog;