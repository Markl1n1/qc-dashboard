import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Activity, RefreshCw, AlertTriangle, CheckCircle2, Wrench, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { databaseService } from '../services/databaseService';
import { toast } from 'sonner';
import { useTranslation } from '../i18n';

interface PipelineIssue {
  dialogId: string;
  fileName: string;
  uploadDate: string;
  reasons: Array<'missing_analysis' | 'raw_speakers'>;
}

const PipelineHealthCard: React.FC = () => {
  const { t } = useTranslation();
  const [issues, setIssues] = useState<PipelineIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [fixingId, setFixingId] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Fetch recent completed dialogs (last 100)
      const { data: dialogs, error: dialogsErr } = await supabase
        .from('dialogs')
        .select('id, file_name, upload_date, status')
        .eq('status', 'completed')
        .order('upload_date', { ascending: false })
        .limit(100);

      if (dialogsErr) throw dialogsErr;
      if (!dialogs?.length) { setIssues([]); return; }

      const dialogIds = dialogs.map(d => d.id);

      // 2) Which of these have any dialog_analysis row?
      const { data: analysisRows, error: analysisErr } = await supabase
        .from('dialog_analysis')
        .select('dialog_id')
        .in('dialog_id', dialogIds);
      if (analysisErr) throw analysisErr;
      const analysedSet = new Set((analysisRows || []).map(r => r.dialog_id));

      // 3) Find transcriptions for these dialogs and look at their utterances' speakers
      const { data: transcriptions, error: txErr } = await supabase
        .from('dialog_transcriptions')
        .select('id, dialog_id')
        .in('dialog_id', dialogIds)
        .eq('transcription_type', 'speaker');
      if (txErr) throw txErr;

      const txByDialog = new Map<string, string[]>();
      (transcriptions || []).forEach(tx => {
        const arr = txByDialog.get(tx.dialog_id) ?? [];
        arr.push(tx.id);
        txByDialog.set(tx.dialog_id, arr);
      });

      const allTxIds = (transcriptions || []).map(t => t.id);
      const rawSpeakerDialogIds = new Set<string>();
      if (allTxIds.length > 0) {
        const { data: badUtts, error: uttErr } = await supabase
          .from('dialog_speaker_utterances')
          .select('transcription_id, speaker')
          .in('transcription_id', allTxIds)
          .not('speaker', 'in', '("Agent","Customer")');
        if (uttErr) throw uttErr;
        const badTxIds = new Set((badUtts || []).map(u => u.transcription_id));
        (transcriptions || []).forEach(tx => {
          if (badTxIds.has(tx.id)) rawSpeakerDialogIds.add(tx.dialog_id);
        });
      }

      const compiled: PipelineIssue[] = [];
      for (const d of dialogs) {
        const reasons: PipelineIssue['reasons'] = [];
        if (!analysedSet.has(d.id)) reasons.push('missing_analysis');
        if (rawSpeakerDialogIds.has(d.id)) reasons.push('raw_speakers');
        if (reasons.length > 0) {
          compiled.push({
            dialogId: d.id,
            fileName: d.file_name,
            uploadDate: d.upload_date,
            reasons,
          });
        }
      }
      setIssues(compiled);
    } catch (e) {
      console.error('Pipeline health load failed', e);
      toast.error('Failed to load pipeline health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  const handleRunDiarizationFix = async (dialogId: string) => {
    setFixingId(dialogId);
    try {
      const transcriptions = await databaseService.getTranscriptions(dialogId);
      const speakerTx = transcriptions.find(t => t.transcription_type === 'speaker');
      if (!speakerTx) throw new Error('No speaker transcription found');
      const utts = await databaseService.getUtterances(speakerTx.id);
      if (!utts?.length) throw new Error('No utterances found');

      const payload = utts.map(u => ({
        speaker: u.speaker,
        text: u.text,
        confidence: u.confidence ?? 0,
        start: u.start_time ?? 0,
        end: u.end_time ?? 0,
      }));

      const { data, error } = await supabase.functions.invoke('diarization-fix', {
        body: { utterances: payload }
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Unknown error');

      const corrections = data.corrected_utterances.map((u: any, i: number) => ({
        utterance_order: i,
        speaker: u.speaker,
      }));
      await databaseService.updateUtteranceSpeakers(speakerTx.id, corrections);
      toast.success(t('admin.diarizationFixed'));
      await loadHealth();
    } catch (e: any) {
      console.error(e);
      toast.error(`${t('admin.diarizationFixFailed')}: ${e.message}`);
    } finally {
      setFixingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {t('admin.pipelineHealth')}
            </CardTitle>
            <CardDescription>{t('admin.pipelineHealthDesc')}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadHealth} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">{t('admin.refresh')}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && issues.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            {t('common.loading')}
          </div>
        ) : issues.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {t('admin.allHealthy')}
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map(issue => (
              <div
                key={issue.dialogId}
                className="flex items-center justify-between p-3 rounded-md border bg-card"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{issue.fileName}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {issue.reasons.includes('missing_analysis') && (
                        <Badge variant="outline" className="text-xs">{t('admin.missingAnalysis')}</Badge>
                      )}
                      {issue.reasons.includes('raw_speakers') && (
                        <Badge variant="outline" className="text-xs">{t('admin.rawSpeakers')}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(issue.uploadDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {issue.reasons.includes('raw_speakers') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunDiarizationFix(issue.dialogId)}
                      disabled={fixingId === issue.dialogId}
                    >
                      {fixingId === issue.dialogId ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />{t('admin.fixing')}</>
                      ) : (
                        <><Wrench className="h-3.5 w-3.5 mr-1" />{t('admin.runDiarizationFix')}</>
                      )}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/dialog/${issue.dialogId}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PipelineHealthCard;
