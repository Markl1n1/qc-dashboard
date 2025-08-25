
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Loader2, CheckCircle, AlertCircle, Upload, Settings, Mic, FileAudio } from 'lucide-react';

interface UploadStage {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  message?: string;
  progress?: number;
}

interface UploadProgressTrackerProps {
  fileName: string;
  stages: UploadStage[];
  currentStageId?: string;
  overallProgress: number;
}

const UploadProgressTracker: React.FC<UploadProgressTrackerProps> = ({
  fileName,
  stages,
  currentStageId,
  overallProgress
}) => {
  const getStageIcon = (stage: UploadStage) => {
    switch (stage.status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'in-progress':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default:
        return getDefaultIcon(stage.id);
    }
  };

  const getDefaultIcon = (stageId: string) => {
    switch (stageId) {
      case 'validation':
        return <Settings className="h-4 w-4 text-gray-400" />;
      case 'conversion':
        return <FileAudio className="h-4 w-4 text-gray-400" />;
      case 'upload':
        return <Upload className="h-4 w-4 text-gray-400" />;
      case 'transcription':
        return <Mic className="h-4 w-4 text-gray-400" />;
      default:
        return <Settings className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (stage: UploadStage) => {
    switch (stage.status) {
      case 'complete':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Processing: {fileName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span>{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        {/* Stage Details */}
        <div className="space-y-2">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${getStatusColor(stage)}`}
            >
              {getStageIcon(stage)}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{stage.name}</span>
                  {stage.status === 'in-progress' && stage.progress !== undefined && (
                    <span className="text-sm">{Math.round(stage.progress)}%</span>
                  )}
                </div>
                {stage.message && (
                  <p className="text-sm opacity-80 truncate">{stage.message}</p>
                )}
                {stage.status === 'in-progress' && stage.progress !== undefined && (
                  <Progress value={stage.progress} className="h-1 mt-2" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default UploadProgressTracker;
