
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface Speaker {
  speaker: string;
  text: string;
  confidence?: number;
  start?: number;
  end?: number;
}

interface SecureSpeakerTranscriptionProps {
  speakers: Speaker[];
  highlightWords?: string[];
  className?: string;
}

const SecureSpeakerTranscription: React.FC<SecureSpeakerTranscriptionProps> = ({
  speakers,
  highlightWords = [],
  className = ""
}) => {
  const highlightText = (text: string, words: string[]): React.ReactNode => {
    if (!words.length) return text;
    
    // Create a regex pattern for all highlight words (case insensitive)
    const pattern = new RegExp(`\\b(${words.map(word => 
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('|')})\\b`, 'gi');
    
    const parts = text.split(pattern);
    
    return parts.map((part, index) => {
      const isHighlighted = words.some(word => 
        part.toLowerCase() === word.toLowerCase()
      );
      
      return isHighlighted ? (
        <span 
          key={index} 
          className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded font-medium"
        >
          {part}
        </span>
      ) : (
        part
      );
    });
  };

  const formatTime = (seconds?: number): string => {
    if (typeof seconds !== 'number') return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={className}>
      <div className="space-y-4">
        {speakers.map((speaker, index) => (
          <Card key={index} className="border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-primary">
                  {speaker.speaker}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  {speaker.confidence && (
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(speaker.confidence * 100)}% confidence
                    </Badge>
                  )}
                  {speaker.start !== undefined && (
                    <Badge variant="outline" className="text-xs">
                      {formatTime(speaker.start)}
                      {speaker.end && ` - ${formatTime(speaker.end)}`}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-relaxed">
                {highlightText(speaker.text, highlightWords)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SecureSpeakerTranscription;
