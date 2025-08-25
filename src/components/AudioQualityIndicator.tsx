
import React from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { AudioMetadata, getQualityAssessment } from '../utils/audioMetadataUtils';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface AudioQualityIndicatorProps {
  metadata: AudioMetadata;
  showDetails?: boolean;
}

const AudioQualityIndicator: React.FC<AudioQualityIndicatorProps> = ({ 
  metadata, 
  showDetails = false 
}) => {
  const assessment = getQualityAssessment(metadata);
  
  const getQualityBadgeVariant = (level: string) => {
    switch (level) {
      case 'excellent': return 'default';
      case 'good': return 'secondary';
      case 'fair': return 'outline';
      case 'poor': return 'destructive';
      default: return 'outline';
    }
  };

  const getQualityIcon = (level: string) => {
    switch (level) {
      case 'excellent':
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fair':
        return <Info className="h-4 w-4 text-yellow-500" />;
      case 'poor':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  if (!showDetails) {
    return (
      <div className="flex items-center gap-2">
        {getQualityIcon(assessment.level)}
        <Badge variant={getQualityBadgeVariant(assessment.level)}>
          {assessment.level.toUpperCase()}
        </Badge>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getQualityIcon(assessment.level)}
          Audio Quality Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Quality Level:</span>
          <Badge variant={getQualityBadgeVariant(assessment.level)}>
            {assessment.level.toUpperCase()}
          </Badge>
        </div>
        
        <p className="text-sm text-muted-foreground">{assessment.description}</p>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Sample Rate:</span>
            <span className="ml-2">
              {metadata.sampleRate > 0 ? `${metadata.sampleRate} Hz` : 'Unknown'}
            </span>
          </div>
          <div>
            <span className="font-medium">Bit Depth:</span>
            <span className="ml-2">
              {metadata.bitDepth > 0 ? `${metadata.bitDepth} bit` : 'Unknown'}
            </span>
          </div>
          <div>
            <span className="font-medium">Channels:</span>
            <span className="ml-2">
              {metadata.channels > 0 ? metadata.channels : 'Unknown'}
            </span>
          </div>
          <div>
            <span className="font-medium">Format:</span>
            <span className="ml-2">{metadata.format}</span>
          </div>
        </div>
        
        {metadata.recommendedActions.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Recommendations:</p>
                <ul className="list-disc list-inside space-y-1">
                  {metadata.recommendedActions.map((action, index) => (
                    <li key={index} className="text-sm">{action}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default AudioQualityIndicator;
