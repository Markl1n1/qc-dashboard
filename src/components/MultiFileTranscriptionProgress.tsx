
import React from 'react';
import { Progress } from './ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { FileAudio, Loader2, CheckCircle, ArrowRight } from 'lucide-react';

interface MultiFileProgressProps {
  files: File[];
  currentFileIndex: number;
  currentFileProgress: number;
  overallProgress: number;
  stage: string;
  message: string;
}

const MultiFileTranscriptionProgress: React.FC<MultiFileProgressProps> = ({
  files,
  currentFileIndex,
  currentFileProgress,
  overallProgress,
  stage,
  message
}) => {
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Processing Audio Files ({currentFileIndex + 1} of {files.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        {/* Current File Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Current File: {files[currentFileIndex]?.name}</span>
            <span>{Math.round(currentFileProgress)}%</span>
          </div>
          <Progress value={currentFileProgress} className="h-2" />
        </div>

        {/* File List with Status */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Files</span>
          <div className="space-y-1">
            {files.map((file, index) => (
              <div key={file.name} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                  index < currentFileIndex 
                    ? 'bg-green-100 text-green-800' 
                    : index === currentFileIndex 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                
                {index < currentFileIndex ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : index === currentFileIndex ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  <FileAudio className="h-4 w-4 text-muted-foreground" />
                )}
                
                <span className="text-sm flex-1 truncate">{file.name}</span>
                
                {index < files.length - 1 && index <= currentFileIndex && (
                  <ArrowRight className={`h-4 w-4 ${index < currentFileIndex ? 'text-green-600' : 'text-blue-600'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
          <strong>Status:</strong> {message}
        </div>
      </CardContent>
    </Card>
  );
};

export default MultiFileTranscriptionProgress;
