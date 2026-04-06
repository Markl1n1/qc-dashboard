import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Users, BarChart3, Play, Loader2, PhoneCall } from 'lucide-react';
import { DialogData } from '../types/unified';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';
import { useDialogAnalysis } from '../hooks/useDialogAnalysis';
import { useDialogNavigation } from '../hooks/useDialogNavigation';
import { useDialogExport } from '../hooks/useDialogExport';
import { toast } from 'sonner';
import { supabase } from '../integrations/supabase/client';
import ErrorBoundaryAnalysis from '../components/ErrorBoundaryAnalysis';
import DialogDetailHeader from '../components/DialogDetailHeader';
import DialogAnalysisTab from '../components/DialogAnalysisTab';
import DialogResultsTab from '../components/DialogResultsTab';
import DialogTranscriptionTab from '../components/DialogTranscriptionTab';
import CallQualityTab from '../components/CallQualityTab';
import { useTranslation } from '../i18n';

const DialogDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [dialog, setDialog] = useState<DialogData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const { getDialog } = useDatabaseDialogs();
  const { startAnalysis, analysisData, isAnalyzing } = useDialogAnalysis(id || '');
  const { currentTab, setCurrentTab, highlightedUtterance, navigateToAnalysis, navigateToSpeaker, navigateToResults } = useDialogNavigation();
  const { isExportingPDF, exportToPDF } = useDialogExport();

  useEffect(() => { if (id) loadDialog(id); }, [id]);

  if (!id) return <Navigate to="/unified-dashboard" replace />;

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`dialog-${id}-updates`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dialog_analysis', filter: `dialog_id=eq.${id}` },
        async (payload) => {
          const retryLoadDialog = async (attempt = 1, maxAttempts = 5) => {
            try {
              const updatedDialog = await getDialog(id);
              if (updatedDialog?.openaiEvaluation) {
                setDialog(updatedDialog as DialogData);
                navigateToResults();
                window.dispatchEvent(new CustomEvent('analysis-data-loaded', { detail: { dialogId: id, analysis: updatedDialog.openaiEvaluation } }));
                return;
              }
              if (attempt < maxAttempts) setTimeout(() => retryLoadDialog(attempt + 1, maxAttempts), Math.pow(2, attempt) * 500);
              else await loadDialog(id);
            } catch (error) { if (attempt < maxAttempts) setTimeout(() => retryLoadDialog(attempt + 1, maxAttempts), 1000); }
          };
          retryLoadDialog();
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dialogs', filter: `id=eq.${id}` },
        async () => { await loadDialog(id); }
      )
      .subscribe();

    const handleAnalysisComplete = async (event: any) => {
      if (event.detail?.transcriptId === id) setTimeout(async () => { await loadDialog(id); navigateToResults(); }, 1000);
    };
    window.addEventListener('analysis-complete', handleAnalysisComplete);
    return () => { supabase.removeChannel(channel); window.removeEventListener('analysis-complete', handleAnalysisComplete); };
  }, [id, navigateToResults]);

  const loadDialog = async (dialogId: string) => {
    try {
      setIsLoading(true);
      const dialogData = await getDialog(dialogId);
      if (dialogData) {
        if (dialogData.openaiEvaluation && typeof dialogData.openaiEvaluation === 'string') {
          try { dialogData.openaiEvaluation = JSON.parse(dialogData.openaiEvaluation); } catch { dialogData.openaiEvaluation = null; }
        }
        setDialog(dialogData as DialogData);
      }
    } catch (error) { console.error('Error loading dialog:', error); toast.error('Failed to load dialog details'); }
    finally { setIsLoading(false); }
  };

  const handleStartAnalysis = async () => { if (!dialog) return; await startAnalysis(dialog); };
  const handleExportPDF = async () => { if (!dialog) return; await exportToPDF(dialog); };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>{t('dialog.loading')}</span>
        </div>
      </div>
    );
  }

  if (!dialog) return <Navigate to="/" replace />;

  return (
    <div className="container mx-auto px-4 py-8">
      <DialogDetailHeader dialog={dialog} isExportingPDF={isExportingPDF} onExportPDF={handleExportPDF} />

      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="transcription" className="flex items-center gap-2">
            <Users className="h-4 w-4" />{t('dialog.speakerDialog')}
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Play className="h-4 w-4" />{t('dialog.aiAnalysis')}
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />{t('dialog.analysisResults')}
          </TabsTrigger>
          <TabsTrigger value="call-quality" className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4" />{t('dialog.callQuality')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transcription" className="mt-6">
          {dialog.status === 'failed' ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">{t('dialog.transcriptionFailed')}</p>
              {dialog.error && <p className="text-sm text-destructive">Error: {dialog.error}</p>}
            </div>
          ) : (
            <DialogTranscriptionTab dialog={dialog} highlightedUtterance={highlightedUtterance} onNavigateToAnalysis={navigateToAnalysis} />
          )}
        </TabsContent>

        <TabsContent value="analysis" className="mt-6">
          <DialogAnalysisTab dialog={dialog} isAnalyzing={isAnalyzing} onStartAnalysis={handleStartAnalysis} />
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <ErrorBoundaryAnalysis onRetry={() => loadDialog(id!)}>
            <DialogResultsTab dialog={dialog} analysisData={analysisData as any || undefined} onNavigateToSpeaker={navigateToSpeaker} onNavigateToAnalysis={navigateToAnalysis} />
          </ErrorBoundaryAnalysis>
        </TabsContent>

        <TabsContent value="call-quality" className="mt-6">
          <CallQualityTab dialog={dialog} audioQualityMetrics={dialog.audioQualityMetrics}
            onNavigateToSpeaker={(timestamp) => {
              const closest = dialog.speakerTranscription?.reduce((best, u) => {
                const dist = Math.abs(u.start - timestamp);
                return dist < Math.abs(best.start - timestamp) ? u : best;
              });
              if (closest) navigateToSpeaker(closest.text);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const SafeDialogDetail = () => (
  <ErrorBoundaryAnalysis><DialogDetail /></ErrorBoundaryAnalysis>
);

export default SafeDialogDetail;
