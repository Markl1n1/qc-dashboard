import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ResizableScrollArea } from './ui/resizable-scroll-area';
import { Clock, Copy, User, Users } from 'lucide-react';
import { SpeakerUtterance } from '../types';
import { copyToClipboard, formatDialogForCopy } from '../utils/dialogFormatting';
import { toast } from 'sonner';
import { useSpeakerMapping } from '../hooks/useSpeakerMapping';

interface DeepgramSpeakerDialogProps {
  utterances: SpeakerUtterance[];
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

const DeepgramSpeakerDialog: React.FC<DeepgramSpeakerDialogProps> = ({
  utterances,
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
    // Color scheme for different speakers using numeric assignment
    const speakerColors = [
      {
        backgroundColor: 'hsl(210, 100%, 97%)', // Light blue
        borderColor: 'hsl(210, 100%, 85%)',
        textColor: 'hsl(210, 100%, 25%)'
      },
      {
        backgroundColor: 'hsl(120, 60%, 97%)', // Light green
        borderColor: 'hsl(120, 60%, 85%)',
        textColor: 'hsl(120, 60%, 25%)'
      },
      {
        backgroundColor: 'hsl(280, 60%, 97%)', // Light purple
        borderColor: 'hsl(280, 60%, 85%)',
        textColor: 'hsl(280, 60%, 25%)'
      },
      {
        backgroundColor: 'hsl(30, 100%, 97%)', // Light orange
        borderColor: 'hsl(30, 100%, 85%)',
        textColor: 'hsl(30, 100%, 25%)'
      }
    ];

    // Extract speaker number for color assignment (no more duplication cleanup needed)
    const speakerIndex = parseInt(speaker.replace(/\D/g, '')) || 0;

    // Use modulo to cycle through colors if we have more speakers than colors
    const colorIndex = speakerIndex % speakerColors.length;
    return speakerColors[colorIndex];
  };

  // Helper to normalize text: remove any hard line/paragraph breaks
  const normalize = (t: string) =>
    (t || '')
      // Replace HTML <br> variants with spaces
      .replace(/<br\s*\/?>/gi, ' ')
      // Replace all common line terminators with spaces: \r, \n, NEL, LS, PS
      .replace(/[\r\n\u0085\u2028\u2029]+/g, ' ')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      // Normalize non-breaking spaces
      .replace(/\u00A0/g, ' ')
      .trim();

  // Merge consecutive utterances from the same speaker (no more duplication cleanup)
  const mergeConsecutiveUtterances = (utterances: SpeakerUtterance[]): SpeakerUtterance[] => {
    if (!utterances || utterances.length === 0) return [];

    const merged: SpeakerUtterance[] = [];
    let current = {
      ...utterances[0],
      text: normalize(utterances[0].text)
    };

    for (let i = 1; i < utterances.length; i++) {
      const next = {
        ...utterances[i],
        text: normalize(utterances[i].text)
      };

      if (current.speaker === next.speaker) {
        // Merge with current utterance - single continuous paragraph
        current.text = normalize(`${current.text} ${next.text}`);
        current.end = next.end; // Update end time to the latest
        current.confidence = Math.min(current.confidence, next.confidence); // Use lower confidence
      } else {
        // Different speaker, add current to merged and start new one
        merged.push(current);
        current = { ...next };
      }
    }

    // Add the last utterance
    merged.push(current);
    return merged;
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
                  <Badge
                    variant="outline"
                    className="text-xs font-bold"
                    style={{ color: style.textColor, borderColor: style.borderColor }}
                  >
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
          <ResizableScrollArea storageKey="deepgram-speaker-dialog">
            <div className="p-6 space-y-4">
              {mergedUtterances.map((utterance, index) => {
                const style = getSpeakerStyle(utterance.speaker);

                return (
                  <div
                    key={index}
                    className="flex gap-4 p-4 rounded-lg border-l-4 transition-all hover:shadow-sm"
                    style={{
                      backgroundColor: style.backgroundColor,
                      borderLeftColor: style.borderColor
                    }}
                  >
                    <div className="flex-shrink-0 flex items-start">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: style.borderColor }}
                      >
                        <User className="h-4 w-4" style={{ color: style.textColor }} />
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
                        <Badge
                          variant="outline"
                          className="text-xs font-bold"
                          style={{ color: style.textColor, borderColor: style.borderColor }}
                        >
                          {Math.round(utterance.confidence * 100)}%
                        </Badge>
                      </div>

                      <div
                        className="text-sm leading-relaxed"
                        style={{ color: style.textColor, whiteSpace: 'normal' }}
                      >
                        {utterance.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ResizableScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeepgramSpeakerDialog;
