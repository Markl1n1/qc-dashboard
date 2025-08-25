
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Clock, Copy, User, Headphones } from 'lucide-react';
import { SpeakerUtterance } from '../types';
import { copyToClipboard, formatDialogForCopy } from '../utils/dialogFormatting';
import { toast } from 'sonner';

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
}

const DeepgramSpeakerDialog: React.FC<DeepgramSpeakerDialogProps> = ({
  utterances,
  detectedLanguage,
  metadata
}) => {
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getSpeakerStyle = (speaker: string) => {
    // Use different colors for Speaker 0 and Speaker 1
    if (speaker === 'Speaker 0') {
      return {
        backgroundColor: 'hsl(210, 100%, 97%)', // Light blue background
        borderColor: 'hsl(210, 100%, 85%)', // Blue border
        textColor: 'hsl(210, 100%, 25%)', // Dark blue text
        icon: User
      };
    } else if (speaker === 'Speaker 1') {
      return {
        backgroundColor: 'hsl(120, 60%, 97%)', // Light green background  
        borderColor: 'hsl(120, 60%, 85%)', // Green border
        textColor: 'hsl(120, 60%, 25%)', // Dark green text
        icon: Headphones
      };
    } else {
      // Fallback for other speakers (Speaker 2, 3, etc.)
      return {
        backgroundColor: 'hsl(280, 60%, 97%)', // Light purple background
        borderColor: 'hsl(280, 60%, 85%)', // Purple border
        textColor: 'hsl(280, 60%, 25%)', // Dark purple text
        icon: User
      };
    }
  };

  const handleCopyDialog = async () => {
    const formattedText = formatDialogForCopy(utterances);
    const success = await copyToClipboard(formattedText);
    if (success) {
      toast.success('Dialog copied to clipboard');
    } else {
      toast.error('Failed to copy dialog');
    }
  };

  const speakerStats = utterances.reduce((acc, utterance) => {
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
              <User className="h-4 w-4" />
              Speaker Dialog
              <Badge variant="outline">{utterances.length} utterances</Badge>
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
                <span className="text-muted-foreground">
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
              const Icon = style.icon;
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
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{speaker}</span>
                  <Badge variant="outline" className="text-xs">
                    {stats.count} turns
                  </Badge>
                  <span className="text-xs">
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
              {utterances.map((utterance, index) => {
                const style = getSpeakerStyle(utterance.speaker);
                const Icon = style.icon;
                
                return (
                  <div
                    key={index}
                    className="flex gap-4 p-4 rounded-lg border-l-4 transition-all hover:shadow-sm"
                    style={{
                      backgroundColor: style.backgroundColor,
                      borderLeftColor: style.borderColor
                    }}
                  >
                    <div className="flex-shrink-0 mt-1">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: style.borderColor }}
                      >
                        <Icon className="h-4 w-4" style={{ color: style.textColor }} />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span 
                          className="font-medium text-sm"
                          style={{ color: style.textColor }}
                        >
                          {utterance.speaker}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(utterance.start)} - {formatTime(utterance.end)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(utterance.confidence * 100)}%
                        </Badge>
                      </div>
                      
                      <p className="text-sm leading-relaxed" style={{ color: style.textColor }}>
                        {utterance.text}
                      </p>
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

export default DeepgramSpeakerDialog;
