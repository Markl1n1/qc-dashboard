
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { UnifiedTranscriptionProgress } from '../types';
import { Download, Cpu, CheckCircle, AlertCircle, Upload, Clock } from 'lucide-react';

interface TranscriptionProgressProps {
  progress: UnifiedTranscriptionProgress;
  modelSize?: string;
  error?: string | null;
}

const TranscriptionProgress: React.FC<TranscriptionProgressProps> = ({ 
  progress, 
  modelSize,
  error 
}) => {
  const getIcon = () => {
    if (error) return <AlertCircle className="h-5 w-5 text-destructive" />;
    
    switch (progress.stage) {
      case 'loading':
        return <Cpu className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'downloading':
        return <Download className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'uploading':
        return <Upload className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'queued':
        return <Clock className="h-5 w-5 text-orange-500 animate-pulse" />;
      case 'processing':
        return <Cpu className="h-5 w-5 text-orange-500 animate-pulse" />;
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return null;
    }
  };

  const getStageLabel = () => {
    switch (progress.stage) {
      case 'loading':
        return 'Loading Model';
      case 'downloading':
        return 'Downloading Model';
      case 'uploading':
        return 'Uploading Audio';
      case 'queued':
        return 'Queued';
      case 'processing':
        return 'Processing Audio';
      case 'complete':
        return 'Complete';
      default:
        return 'Processing';
    }
  };

  const getVariant = () => {
    if (error) return 'destructive';
    return progress.stage === 'complete' ? 'default' : 'secondary';
  };

  const getProviderTitle = () => {
    if (modelSize === 'cloud') return 'Cloud Transcription';
    return 'Local Transcription';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {getProviderTitle()}
          </CardTitle>
          <Badge variant={getVariant()} className="flex items-center gap-1">
            {getIcon()}
            {error ? 'Error' : getStageLabel()}
          </Badge>
        </div>
        {modelSize && modelSize !== 'cloud' && (
          <CardDescription>
            Using {modelSize} Whisper model
          </CardDescription>
        )}
        {modelSize === 'cloud' && (
          <CardDescription>
            Using AssemblyAI cloud service
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress 
          value={progress.progress} 
          className="h-2"
        />
        <p className="text-sm text-muted-foreground">
          {error || progress.message}
        </p>
        {progress.stage === 'downloading' && (
          <p className="text-xs text-muted-foreground">
            This is a one-time download. Subsequent uses will be instant.
          </p>
        )}
        {progress.stage === 'uploading' && (
          <p className="text-xs text-muted-foreground">
            Uploading audio to AssemblyAI for cloud processing.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default TranscriptionProgress;
