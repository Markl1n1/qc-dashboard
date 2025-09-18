import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Users, BarChart3, Play, Loader2 } from 'lucide-react';
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

const DialogDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [dialog, setDialog] = useState<DialogData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Early return if no ID
  if (!id) {
    return <Navigate to="/unified-dashboard" replace />;
  }
  
  const { getDialog } = useDatabaseDialogs();
  const { 
    startAnalysis, 
    analysisData, 
    isAnalyzing 
  } = useDialogAnalysis(id);
  
  const {
    currentTab,
    setCurrentTab,
    highlightedUtterance,
    navigateToAnalysis,
    navigateToSpeaker,
    navigateToResults
  } = useDialogNavigation();
  
  const { isExportingPDF, exportToPDF } = useDialogExport();
  useEffect(() => {
    if (id) {
      loadDialog(id);
    }
  }, [id]);

  // Enhanced real-time subscription for analysis updates
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`dialog-${id}-updates`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dialog_analysis',
          filter: `dialog_id=eq.${id}`
        },
        async (payload) => {
          console.log('🔄 Analysis completed event received:', payload);
          
          // Multiple retry attempts with exponential backoff
          const retryLoadDialog = async (attempt = 1, maxAttempts = 5) => {
            try {
              console.log(`🔄 Loading dialog attempt ${attempt}/${maxAttempts}`);
            const updatedDialog = await getDialog(id);
              
              if (updatedDialog?.openaiEvaluation) {
                console.log('✅ Analysis data loaded successfully');
                setDialog(updatedDialog as DialogData);
                navigateToResults();
                
                // Dispatch custom event for any other components listening
                window.dispatchEvent(new CustomEvent('analysis-data-loaded', { 
                  detail: { dialogId: id, analysis: updatedDialog.openaiEvaluation } 
                }));
                return;
              }
              
              if (attempt < maxAttempts) {
                const delay = Math.pow(2, attempt) * 500; // Exponential backoff
                console.log(`⏳ Retrying in ${delay}ms...`);
                setTimeout(() => retryLoadDialog(attempt + 1, maxAttempts), delay);
              } else {
                console.warn('⚠️ Max retry attempts reached, analysis data may not be visible');
                // Force a final reload just in case
                await loadDialog(id);
              }
            } catch (error) {
              console.error(`❌ Error loading dialog on attempt ${attempt}:`, error);
              if (attempt < maxAttempts) {
                setTimeout(() => retryLoadDialog(attempt + 1, maxAttempts), 1000);
              }
            }
          };
          
          // Start the retry process
          retryLoadDialog();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'dialogs',
          filter: `id=eq.${id}`
        },
        async (payload) => {
          console.log('🔄 Dialog updated event received:', payload);
          await loadDialog(id);
        }
      )
      .subscribe();

    // Listen for custom analysis complete events
    const handleAnalysisComplete = async (event: CustomEvent) => {
      if (event.detail.transcriptId === id) {
        console.log('🔄 Handling analysis complete event');
        setTimeout(async () => {
          await loadDialog(id);
          setCurrentTab('results');
        }, 1000);
      }
    };

    window.addEventListener('analysis-complete', handleAnalysisComplete as EventListener);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('analysis-complete', handleAnalysisComplete as EventListener);
    };
  }, [id]);
  const loadDialog = async (dialogId: string) => {
    try {
      setIsLoading(true);
      const dialogData = await getDialog(dialogId);
      if (dialogData) {
        // Ensure openaiEvaluation is properly parsed
        if (dialogData.openaiEvaluation && typeof dialogData.openaiEvaluation === 'string') {
          try {
            dialogData.openaiEvaluation = JSON.parse(dialogData.openaiEvaluation);
          } catch (parseError) {
            console.error('Failed to parse openaiEvaluation JSON:', parseError);
            dialogData.openaiEvaluation = null;
          }
        }
        setDialog(dialogData as DialogData);
      }
    } catch (error) {
      console.error('Error loading dialog:', error);
      toast.error('Failed to load dialog details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!dialog) return;
    await startAnalysis(dialog);
  };

  const handleExportPDF = async () => {
    if (!dialog) return;
    await exportToPDF(dialog);
  };
  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading dialog details...</span>
        </div>
      </div>;
  }
  if (!dialog) {
    return <Navigate to="/" replace />;
  }
  return (
    <div className="container mx-auto px-4 py-8">
      <DialogDetailHeader 
        dialog={dialog}
        isExportingPDF={isExportingPDF}
        onExportPDF={handleExportPDF}
      />

      {/* Main Content */}
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="transcription" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Speaker Dialog
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            AI Analysis
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analysis Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transcription" className="mt-6">
          <DialogTranscriptionTab 
            dialog={dialog}
            highlightedUtterance={highlightedUtterance}
            onNavigateToAnalysis={navigateToAnalysis}
          />
        </TabsContent>

        <TabsContent value="analysis" className="mt-6">
          <DialogAnalysisTab 
            dialog={dialog}
            isAnalyzing={isAnalyzing}
            onStartAnalysis={handleStartAnalysis}
          />
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <ErrorBoundaryAnalysis onRetry={() => loadDialog(id!)}>
            <DialogResultsTab 
              dialog={dialog}
              analysisData={analysisData}
              onNavigateToSpeaker={navigateToSpeaker}
              onNavigateToAnalysis={navigateToAnalysis}
            />
          </ErrorBoundaryAnalysis>
        </TabsContent>
                            const elements = document.querySelectorAll('[data-utterance-text]');
                            for (const element of elements) {
                              if (element.getAttribute('data-utterance-text')?.includes(utteranceText)) {
                                element.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'center'
                                });
                                break;
                              }
                            }
                          }, 100);
                        }} 
                        currentTab={currentTab} 
                        onTabChange={setCurrentTab}
                        analysisData={dialog.openaiEvaluation}
                      />
                    </CardContent>
                  </Card>}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No analysis results available. Run AI analysis first.
                  </p>
                </CardContent>
              </Card>
            )}
            </div>
          </ErrorBoundaryAnalysis>
        </TabsContent>
      </Tabs>
    </div>;
};

// Wrap with error handling
const SafeDialogDetail = () => {
  try {
    return <DialogDetail />;
  } catch (error) {
    console.error('DialogDetail component error:', error);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Dialog not found</h2>
          <p className="text-muted-foreground mb-4">
            The requested dialog could not be loaded.
          </p>
          <Link to="/unified-dashboard" className="text-primary hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }
};

export default SafeDialogDetail;