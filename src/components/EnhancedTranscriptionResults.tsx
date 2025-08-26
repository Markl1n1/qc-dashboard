
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { 
  Users, 
  Globe, 
  Shield, 
  Brain, 
  FileText, 
  AlertTriangle,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import { EnhancedAssemblyAIResult } from '../services/enhancedAssemblyAIService';

interface EnhancedTranscriptionResultsProps {
  result: EnhancedAssemblyAIResult;
  onDownload?: (format: 'json' | 'txt' | 'srt') => void;
  onTogglePII?: () => void;
  showPII?: boolean;
}

const EnhancedTranscriptionResults: React.FC<EnhancedTranscriptionResultsProps> = ({
  result,
  onDownload,
  onTogglePII,
  showPII = true
}) => {
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'POSITIVE': return 'text-green-600';
      case 'NEGATIVE': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Transcription */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Transcription Results
            </CardTitle>
            <div className="flex items-center gap-2">
              {result.piiRedactedUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onTogglePII}
                  className="flex items-center gap-2"
                >
                  {showPII ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showPII ? 'Hide' : 'Show'} PII
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload?.('txt')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48 w-full rounded border p-4">
            <p className="text-sm leading-relaxed">{result.text}</p>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Language Detection */}
      {result.languageDetected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Language Detection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{result.languageDetected.code.toUpperCase()}</p>
                <p className="text-sm text-muted-foreground">Detected Language</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{Math.round(result.languageDetected.confidence * 100)}%</p>
                <p className="text-sm text-muted-foreground">Confidence</p>
              </div>
            </div>
            <Progress value={result.languageDetected.confidence * 100} className="mt-2" />
          </CardContent>
        </Card>
      )}

      {/* Speaker Diarization */}
      {result.speakerUtterances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Speaker Diarization ({result.speakerUtterances.length} utterances)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 w-full">
              <div className="space-y-2">
                {result.speakerUtterances.map((utterance, index) => (
                  <div key={index} className="flex gap-3 p-2 rounded-lg bg-muted/50">
                    <Badge variant="outline" className="shrink-0">
                      {utterance.speaker}
                    </Badge>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span>{formatTime(utterance.start)} - {formatTime(utterance.end)}</span>
                        <span>•</span>
                        <span>{Math.round(utterance.confidence * 100)}% confidence</span>
                      </div>
                      <p className="text-sm">{utterance.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Content Safety */}
      {result.contentSafety && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Content Safety Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.contentSafety.results?.length > 0 ? (
              <div className="space-y-3">
                {result.contentSafety.results.map((item: any, index: number) => (
                  <div key={index} className="space-y-2">
                    <p className="text-sm font-medium">{item.text}</p>
                    <div className="flex flex-wrap gap-2">
                      {item.labels?.map((label: any, labelIndex: number) => (
                        <Badge 
                          key={labelIndex}
                          variant={label.severity > 0.7 ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {label.label} ({Math.round(label.confidence * 100)}%)
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No content safety issues detected</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Entities */}
      {result.entities && result.entities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Detected Entities ({result.entities.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.entities.map((entity: any, index: number) => (
                <div key={index} className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline">{entity.entity_type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(entity.start)} - {formatTime(entity.end)}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{entity.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sentiment Analysis */}
      {result.sentiment && result.sentiment.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Sentiment Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 w-full">
              <div className="space-y-2">
                {result.sentiment.map((item: any, index: number) => (
                  <div key={index} className="p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-1">
                      <Badge 
                        variant="outline" 
                        className={getSentimentColor(item.sentiment)}
                      >
                        {item.sentiment}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        <span>{formatTime(item.start)} - {formatTime(item.end)}</span>
                        <span className="ml-2">{Math.round(item.confidence * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-sm">{item.text}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Chapters */}
      {result.chapters && result.chapters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Auto-Generated Chapters ({result.chapters.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {result.chapters.map((chapter: any, index: number) => (
                <div key={index} className="border-l-4 border-primary pl-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{chapter.headline}</h4>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(chapter.start)} - {formatTime(chapter.end)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{chapter.gist}</p>
                  <p className="text-sm">{chapter.summary}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {result.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              AI Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{result.summary}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EnhancedTranscriptionResults;
