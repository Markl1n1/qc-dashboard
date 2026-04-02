import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { PhoneCall, Volume2, Wifi, MessageSquareWarning, AlertTriangle, CheckCircle, Info, Loader2, BarChart3 } from 'lucide-react';
import { useCallQuality, QualityIssue, CategoryScore } from '../hooks/useCallQuality';
import { DialogData } from '../types/unified';
import AudioSignalQualityCard from './AudioSignalQualityCard';

interface CallQualityTabProps {
  dialog: DialogData;
  audioQualityMetrics?: Record<string, any> | null;
  onNavigateToSpeaker?: (timestamp: number) => void;
}

const categoryMeta: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  audioClarity: { label: 'Audio Clarity', icon: <Volume2 className="h-4 w-4" />, description: 'Speech recognition confidence' },
  connectionStability: { label: 'Connection Stability', icon: <Wifi className="h-4 w-4" />, description: 'Silence gaps & dropouts' },
  interruptions: { label: 'Interruptions', icon: <MessageSquareWarning className="h-4 w-4" />, description: 'Speaker overlaps' },
  communication: { label: 'Communication', icon: <PhoneCall className="h-4 w-4" />, description: 'Hearing issues, repetitions' },
};

function getScoreColor(score: number) {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreBg(score: number) {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getScoreBadge(score: number) {
  if (score >= 80) return { variant: 'default' as const, label: 'Good' };
  if (score >= 60) return { variant: 'secondary' as const, label: 'Fair' };
  return { variant: 'destructive' as const, label: 'Poor' };
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'high': return <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />;
    case 'medium': return <Info className="h-4 w-4 text-yellow-500 shrink-0" />;
    default: return <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const CallQualityTab: React.FC<CallQualityTabProps> = ({ dialog, onNavigateToSpeaker }) => {
  const { qualityData, isLoading, isAnalyzing, analyzeQuality } = useCallQuality(dialog.id);

  const handleAnalyze = () => {
    if (!dialog.speakerTranscription?.length) {
      return;
    }
    analyzeQuality(dialog.speakerTranscription.map(u => ({
      speaker: u.speaker,
      text: u.text,
      confidence: u.confidence,
      start_time: u.start,
      end_time: u.end,
    })));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-muted-foreground">Loading call quality data...</span>
      </div>
    );
  }

  if (!qualityData) {
    return (
      <div className="text-center py-12 space-y-4">
        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <div>
          <p className="text-muted-foreground mb-2">No call quality analysis yet</p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            Analyze audio clarity, connection stability, interruptions, and communication issues
          </p>
        </div>
        <Button 
          onClick={handleAnalyze} 
          disabled={isAnalyzing || !dialog.speakerTranscription?.length}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <PhoneCall className="h-4 w-4 mr-2" />
              Analyze Call Quality
            </>
          )}
        </Button>
      </div>
    );
  }

  const { overall_score, categories, details } = qualityData;
  const badge = getScoreBadge(overall_score);

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`text-4xl font-bold ${getScoreColor(overall_score)}`}>
                {overall_score}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Call Quality Score</span>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Based on audio metrics and communication analysis
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Re-analyze'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Category Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(categories).map(([key, cat]) => {
          const meta = categoryMeta[key];
          if (!meta) return null;
          const category = cat as CategoryScore;
          return (
            <Card key={key}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {meta.icon}
                  {meta.label}
                  <span className={`ml-auto text-lg font-bold ${getScoreColor(category.score)}`}>
                    {category.score}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress 
                  value={category.score} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">{meta.description}</p>
                {category.issues.length > 0 && (
                  <ul className="space-y-1">
                    {category.issues.map((issue, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0 mt-0.5" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detailed Issues */}
      {details.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Issues Timeline ({details.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {(details as QualityIssue[])
                .sort((a, b) => a.timestamp - b.timestamp)
                .map((issue, i) => (
                <button
                  key={i}
                  className="flex items-start gap-3 w-full text-left p-2 rounded-md hover:bg-muted/50 transition-colors"
                  onClick={() => onNavigateToSpeaker?.(issue.timestamp)}
                >
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{issue.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatTimestamp(issue.timestamp)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {issue.type.replace('_', ' ')}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {details.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-sm text-muted-foreground">No issues detected — call quality looks good!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CallQualityTab;
