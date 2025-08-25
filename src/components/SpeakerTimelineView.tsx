
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Slider } from './ui/slider';
import { Progress } from './ui/progress';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2,
  Users,
  Clock
} from 'lucide-react';
import { SpeakerUtterance } from '../types';

interface SpeakerTimelineViewProps {
  utterances: SpeakerUtterance[];
  audioUrl?: string;
  onUtteranceClick?: (utterance: SpeakerUtterance) => void;
}

const SpeakerTimelineView: React.FC<SpeakerTimelineViewProps> = ({
  utterances,
  audioUrl,
  onUtteranceClick
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState([80]);
  const [selectedSpeakers, setSelectedSpeakers] = useState<Set<string>>(new Set());

  // Get unique speakers
  const speakers = Array.from(new Set(utterances.map(u => u.speaker)));
  
  // Get speaker colors
  const getSpeakerColor = (speaker: string): string => {
    const colors = [
      'bg-blue-500',
      'bg-green-500', 
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-indigo-500'
    ];
    const index = speakers.indexOf(speaker) % colors.length;
    return colors[index];
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const toggleSpeaker = (speaker: string) => {
    const newSelected = new Set(selectedSpeakers);
    if (newSelected.has(speaker)) {
      newSelected.delete(speaker);
    } else {
      newSelected.add(speaker);
    }
    setSelectedSpeakers(newSelected);
  };

  const filteredUtterances = selectedSpeakers.size > 0 
    ? utterances.filter(u => selectedSpeakers.has(u.speaker))
    : utterances;

  const totalDuration = utterances.length > 0 
    ? Math.max(...utterances.map(u => u.end))
    : 0;

  return (
    <div className="space-y-4">
      {/* Audio Controls */}
      {audioUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Audio Playback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Playback Controls */}
              <div className="flex items-center justify-center gap-4">
                <Button variant="outline" size="sm">
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="outline" size="sm">
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <Progress value={(currentTime / duration) * 100} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Volume Control */}
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                <Slider
                  value={volume}
                  onValueChange={setVolume}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-8">
                  {volume[0]}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Speaker Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Speaker Filter ({speakers.length} speakers)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {speakers.map((speaker) => (
              <Button
                key={speaker}
                variant={selectedSpeakers.has(speaker) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleSpeaker(speaker)}
                className="flex items-center gap-2"
              >
                <div 
                  className={`w-3 h-3 rounded-full ${getSpeakerColor(speaker)}`}
                />
                {speaker}
                <Badge variant="secondary" className="ml-1">
                  {utterances.filter(u => u.speaker === speaker).length}
                </Badge>
              </Button>
            ))}
          </div>
          {selectedSpeakers.size > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSpeakers(new Set())}
              >
                Clear Filter
              </Button>
              <span className="text-sm text-muted-foreground">
                Showing {filteredUtterances.length} of {utterances.length} utterances
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Speaker Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Timeline Visual */}
          <div className="mb-4 relative h-20 bg-muted rounded-lg overflow-hidden">
            {filteredUtterances.map((utterance, index) => {
              const startPercent = (utterance.start / totalDuration) * 100;
              const widthPercent = ((utterance.end - utterance.start) / totalDuration) * 100;
              
              return (
                <div
                  key={index}
                  className={`absolute h-6 ${getSpeakerColor(utterance.speaker)} opacity-70 hover:opacity-90 cursor-pointer transition-opacity`}
                  style={{
                    left: `${startPercent}%`,
                    width: `${widthPercent}%`,
                    top: `${speakers.indexOf(utterance.speaker) * 8 + 8}px`
                  }}
                  title={`${utterance.speaker}: ${utterance.text.substring(0, 50)}...`}
                  onClick={() => onUtteranceClick?.(utterance)}
                />
              );
            })}
          </div>

          {/* Utterance List */}
          <ScrollArea className="h-96 w-full">
            <div className="space-y-2">
              {filteredUtterances.map((utterance, index) => (
                <div 
                  key={index} 
                  className="flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onUtteranceClick?.(utterance)}
                >
                  <div className="flex items-center gap-2 shrink-0">
                    <div 
                      className={`w-3 h-3 rounded-full ${getSpeakerColor(utterance.speaker)}`}
                    />
                    <Badge variant="outline" className="text-xs">
                      {utterance.speaker}
                    </Badge>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span>{formatTime(utterance.start)} - {formatTime(utterance.end)}</span>
                      <span>•</span>
                      <span>{Math.round(utterance.confidence * 100)}% confidence</span>
                      <span>•</span>
                      <span>{Math.round(utterance.end - utterance.start)}s</span>
                    </div>
                    <p className="text-sm leading-relaxed">{utterance.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default SpeakerTimelineView;
