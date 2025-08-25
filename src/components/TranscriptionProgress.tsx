
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { UnifiedTranscriptionProgress } from '../types';
import { Download, Cpu, CheckCircle, AlertCircle, Upload, Clock, Loader2, XCircle, X } from 'lucide-react';

interface TranscriptionProgressProps {
  progress: UnifiedTranscriptionProgress | null;
  fileName?: string;
  onCancel?: () => void;
}

const TranscriptionProgress: React.FC<TranscriptionProgressProps> = ({ 
  progress, 
  fileName, 
  onCancel 
}) => {
  if (!progress) return null;

  const getStageIcon = (stage: UnifiedTranscriptionProgress['stage']) => {
    switch (stage) {
      case 'uploading':
        return <Upload className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStageColor = (stage: UnifiedTranscriptionProgress['stage']) => {
    switch (stage) {
      case 'uploading':
      case 'queued':
      case 'processing':
        return 'blue';
      case 'complete':
        return 'green';
      case 'error':
        return 'red';
      default:
        return 'yellow';
    }
  };

  const color = getStageColor(progress.stage);

  return (
    <Card className="w-full max-w-md">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getStageIcon(progress.stage)}
              <span className="font-medium">
                {progress.stage.charAt(0).toUpperCase() + progress.stage.slice(1)}
              </span>
            </div>
            {onCancel && progress.stage !== 'complete' && progress.stage !== 'error' && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {fileName && (
            <p className="text-sm text-muted-foreground truncate">
              {fileName}
            </p>
          )}

          <Progress value={progress.progress} className="w-full" />
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{progress.message}</span>
            <span className={`font-medium text-${color}-600`}>
              {progress.progress}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TranscriptionProgress;
