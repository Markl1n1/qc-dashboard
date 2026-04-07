import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Volume2, Wifi, AudioLines, Gauge, Activity } from 'lucide-react';
import { useTranslation } from '../i18n';

interface AudioMetrics {
  rmsLevel?: number;
  rmsDb?: number;
  peakLevel?: number;
  peakDb?: number;
  clippingPercent?: number;
  silencePercent?: number;
  snrEstimate?: number;
  dynamicRange?: number;
  duration?: number;
  sampleRate?: number;
  channels?: number;
  overallScore?: number;
  issues?: Array<{ type: string; severity: string; message: string }>;
}

interface AudioSignalQualityCardProps {
  metrics: AudioMetrics;
}

function getScoreColor(score: number) {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreBadge(score: number, t: (key: string) => string) {
  if (score >= 80) return { variant: 'default' as const, label: t('callQuality.good') };
  if (score >= 60) return { variant: 'secondary' as const, label: t('callQuality.fair') };
  return { variant: 'destructive' as const, label: t('callQuality.poor') };
}

function formatDb(db: number | undefined) {
  return db != null ? `${db.toFixed(1)} dB` : '—';
}

const AudioSignalQualityCard: React.FC<AudioSignalQualityCardProps> = ({ metrics }) => {
  const { t } = useTranslation();
  const score = metrics.overallScore ?? 0;
  const badge = getScoreBadge(score, t);

  const metricRows = [
    { key: 'snrEstimate', label: t('audioSignal.snr'), icon: <Wifi className="h-4 w-4" />, format: (v: number) => `${v.toFixed(1)} dB`, desc: t('audioSignal.snrDesc') },
    { key: 'clippingPercent', label: t('audioSignal.clipping'), icon: <Activity className="h-4 w-4" />, format: (v: number) => `${v.toFixed(2)}%`, desc: t('audioSignal.clippingDesc') },
    { key: 'silencePercent', label: t('audioSignal.silenceRatio'), icon: <AudioLines className="h-4 w-4" />, format: (v: number) => `${v.toFixed(1)}%`, desc: t('audioSignal.silenceDesc') },
    { key: 'rmsDb', label: t('audioSignal.volumeLevel'), icon: <Volume2 className="h-4 w-4" />, format: (v: number) => `${v.toFixed(1)} dB`, desc: t('audioSignal.volumeDesc') },
    { key: 'dynamicRange', label: t('audioSignal.dynamicRange'), icon: <Gauge className="h-4 w-4" />, format: (v: number) => `${v.toFixed(1)} dB`, desc: t('audioSignal.dynamicRangeDesc') },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
              {Math.round(score)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{t('audioSignal.audioSignalQuality')}</span>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{t('audioSignal.basedOnRaw')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metricRows.map(({ key, label, icon, format, desc }) => {
          const val = metrics[key as keyof AudioMetrics] as number | undefined;
          return (
            <Card key={key}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  {icon}
                  <span className="text-sm font-medium">{label}</span>
                  <span className="ml-auto text-sm font-bold">{val != null ? format(val) : '—'}</span>
                </div>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <AudioLines className="h-4 w-4" />
              <span className="text-sm font-medium">{t('audioSignal.audioInfo')}</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {metrics.sampleRate && <p>{t('audioSignal.sampleRate')}: {metrics.sampleRate} Hz</p>}
              {metrics.channels && <p>{t('audioSignal.channels')}: {metrics.channels}</p>}
              {metrics.duration && <p>Duration: {Math.floor(metrics.duration / 60)}:{Math.floor(metrics.duration % 60).toString().padStart(2, '0')}</p>}
              {metrics.peakDb != null && <p>{t('audioSignal.peak')}: {formatDb(metrics.peakDb)}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {metrics.issues && metrics.issues.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('audioSignal.detectedIssues')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {metrics.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Badge variant={issue.severity === 'high' ? 'destructive' : issue.severity === 'medium' ? 'secondary' : 'outline'} className="text-xs shrink-0">
                    {issue.severity}
                  </Badge>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AudioSignalQualityCard;
