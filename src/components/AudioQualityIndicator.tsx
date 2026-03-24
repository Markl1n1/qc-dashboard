
import React from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { AudioMetadata, getQualityAssessment } from '../utils/audioMetadataUtils';
import { AudioSignalMetrics, getScoreColor, getScoreLabel } from '../utils/audioSignalAnalysis';
import { AlertTriangle, CheckCircle, Info, Activity, Volume2, Gauge } from 'lucide-react';

interface AudioQualityIndicatorProps {
  metadata?: AudioMetadata | null;
  signalMetrics?: AudioSignalMetrics | null;
  isAnalyzing?: boolean;
  showDetails?: boolean;
}

const AudioQualityIndicator: React.FC<AudioQualityIndicatorProps> = ({ 
  metadata, 
  signalMetrics,
  isAnalyzing = false,
  showDetails = true
}) => {
  if (isAnalyzing) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4 animate-pulse" />
            Анализ качества аудио...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!signalMetrics && !metadata) return null;

  // Compact view
  if (!showDetails && signalMetrics) {
    return (
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4" />
        <span className={`font-medium ${getScoreColor(signalMetrics.overallScore)}`}>
          {signalMetrics.overallScore}/100
        </span>
        <span className="text-xs text-muted-foreground">
          {getScoreLabel(signalMetrics.overallScore)}
        </span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5" />
          Качество аудио
          {signalMetrics && (
            <Badge 
              variant={signalMetrics.overallScore >= 70 ? 'default' : signalMetrics.overallScore >= 40 ? 'secondary' : 'destructive'}
              className="ml-auto"
            >
              {signalMetrics.overallScore}/100 — {getScoreLabel(signalMetrics.overallScore)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {signalMetrics && (
          <>
            {/* Metric bars */}
            <div className="space-y-3">
              <MetricRow 
                label="SNR (сигнал/шум)" 
                value={`${signalMetrics.snrEstimate.toFixed(0)} dB`}
                percent={Math.min(100, (signalMetrics.snrEstimate / 40) * 100)}
              />
              <MetricRow 
                label="Громкость (RMS)" 
                value={`${signalMetrics.rmsDb.toFixed(1)} dB`}
                percent={Math.min(100, Math.max(0, ((signalMetrics.rmsDb + 50) / 35) * 100))}
              />
              <MetricRow 
                label="Пик" 
                value={`${signalMetrics.peakDb.toFixed(1)} dB`}
                percent={Math.min(100, Math.max(0, ((signalMetrics.peakDb + 30) / 30) * 100))}
              />
              <MetricRow 
                label="Клиппинг" 
                value={`${signalMetrics.clippingPercent.toFixed(2)}%`}
                percent={Math.min(100, signalMetrics.clippingPercent * 10)}
                inverted
              />
              <MetricRow 
                label="Тишина" 
                value={`${signalMetrics.silencePercent.toFixed(0)}%`}
                percent={signalMetrics.silencePercent}
                inverted
              />
              <MetricRow 
                label="Дин. диапазон" 
                value={`${signalMetrics.dynamicRange.toFixed(0)} dB`}
                percent={Math.min(100, (signalMetrics.dynamicRange / 50) * 100)}
              />
            </div>

            {/* File info */}
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground pt-2 border-t">
              <div>{signalMetrics.sampleRate} Hz</div>
              <div>{signalMetrics.channels === 1 ? 'Mono' : 'Stereo'}</div>
              <div>{Math.floor(signalMetrics.duration / 60)}:{Math.floor(signalMetrics.duration % 60).toString().padStart(2, '0')}</div>
            </div>

            {/* Issues */}
            {signalMetrics.issues.length > 0 && (
              <Alert variant="destructive" className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {signalMetrics.issues.map((issue, i) => (
                      <li key={i}>{issue.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* Fallback to metadata-only view */}
        {!signalMetrics && metadata && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Sample Rate:</span>
              <span className="ml-2">{metadata.sampleRate > 0 ? `${metadata.sampleRate} Hz` : 'Unknown'}</span>
            </div>
            <div>
              <span className="font-medium">Bit Depth:</span>
              <span className="ml-2">{metadata.bitDepth > 0 ? `${metadata.bitDepth} bit` : 'Unknown'}</span>
            </div>
            <div>
              <span className="font-medium">Channels:</span>
              <span className="ml-2">{metadata.channels > 0 ? metadata.channels : 'Unknown'}</span>
            </div>
            <div>
              <span className="font-medium">Format:</span>
              <span className="ml-2">{metadata.format}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface MetricRowProps {
  label: string;
  value: string;
  percent: number;
  inverted?: boolean;
}

const MetricRow: React.FC<MetricRowProps> = ({ label, value, percent, inverted = false }) => {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  // For inverted metrics (clipping, silence), high = bad
  const effectivePercent = inverted ? 100 - clampedPercent : clampedPercent;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <Progress 
        value={clampedPercent} 
        className={`h-1.5 ${
          effectivePercent >= 70 ? '[&>div]:bg-green-500' : 
          effectivePercent >= 40 ? '[&>div]:bg-yellow-500' : 
          '[&>div]:bg-red-500'
        }`}
      />
    </div>
  );
};

export default AudioQualityIndicator;
