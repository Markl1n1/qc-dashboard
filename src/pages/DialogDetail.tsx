import React, { useEffect, useState } from 'react';
import { useParams, Navigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Play, Users, BarChart3, Loader2, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog } from '../types';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';
import { useEvaluateDialog } from '../hooks/useEvaluateDialog';
import { useAnalysisResults } from '../hooks/useAnalysisResults';
import { toast } from 'sonner';
import { extractUsernameFromEmail, capitalizeStatus } from '../utils/userUtils';
import DeepgramSpeakerDialog from '../components/DeepgramSpeakerDialog';
import EnhancedSpeakerDialog from '../components/EnhancedSpeakerDialog';
import EnhancedDialogDetail from '../components/EnhancedDialogDetail';
import AnalysisSummaryCards from '../components/AnalysisSummaryCards';
import { OpenAIEvaluationProgress } from '../types/openaiEvaluation';
import { supabase } from '../integrations/supabase/client';
import { generateDialogPDF } from '../utils/pdfGenerator';
import { useLanguageStore } from '../store/languageStore';
import ErrorBoundaryAnalysis from '../components/ErrorBoundaryAnalysis';

const DialogDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [currentTab, setCurrentTab] = useState(() => {
    // Initialize tab from URL params or default to transcription
    return searchParams.get('tab') || 'transcription';
  });
  const [highlightedUtterance, setHighlightedUtterance] = useState<string | null>(null);
  
  // Early return if no ID
  if (!id) {
    return <Navigate to="/unified-dashboard" replace />;
  }
  
  const { getDialog } = useDatabaseDialogs();
  const evaluateDialogMutation = useEvaluateDialog();
  const { data: analysisData, isLoading: isAnalysisLoading, isFetching: isAnalysisFetching } = useAnalysisResults(id);
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
                setDialog(updatedDialog);
                setCurrentTab('results');
                
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
            // Clear invalid JSON data
            dialogData.openaiEvaluation = null;
          }
        }
        setDialog(dialogData);
      }
    } catch (error) {
      console.error('Error loading dialog:', error);
      toast.error('Failed to load dialog details');
    } finally {
      setIsLoading(false);
    }
  };
  const handleStartAnalysis = async () => {
    if (!dialog || !dialog.speakerTranscription || dialog.speakerTranscription.length === 0) {
      toast.error('No transcription available for analysis');
      return;
    }

    // Use the new TanStack Query mutation
    evaluateDialogMutation.mutate({
      dialogId: dialog.id,
      utterances: dialog.speakerTranscription,
      modelId: 'gpt-5-mini'
    });
  };
  const { commentLanguage } = useLanguageStore();
  
  const handleExportPDF = async () => {
    if (!dialog) return;
    setIsExportingPDF(true);
    try {
      generateDialogPDF(dialog, commentLanguage);
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };
  const getStatusColor = (status: Dialog['status']) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };
  const renderProgressIndicator = () => {
    if (!evaluateDialogMutation.isPending) return null;
    
    return (
      <div className="mt-4 p-4 border rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="font-medium">Starting AI analysis...</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all duration-300 animate-pulse" style={{ width: '30%' }} />
        </div>
      </div>
    );
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
  return <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <Badge className={getStatusColor(dialog.status)}>
            {capitalizeStatus(dialog.status)}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{dialog.fileName}</h1>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Supervisor: {extractUsernameFromEmail(dialog.assignedSupervisor)}</span>
              <span>•</span>
              <span>Uploaded: {new Date(dialog.uploadDate).toLocaleDateString()}</span>
              {dialog.qualityScore && <>
                  <span>•</span>
                  <span>Quality Score: {dialog.qualityScore}%</span>
                </>}
            </div>
          </div>
          
          {/* Export PDF Button */}
          <Button onClick={handleExportPDF} disabled={isExportingPDF || !dialog.speakerTranscription} variant="outline" size="sm">
            {isExportingPDF ? <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </> : <>
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </>}
          </Button>
        </div>
      </div>

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
          <div className="space-y-6">
            {/* Enhanced Speaker Transcription with mistake highlighting */}
            {dialog.speakerTranscription && dialog.speakerTranscription.length > 0 ? <EnhancedSpeakerDialog utterances={dialog.speakerTranscription} mistakes={dialog.openaiEvaluation?.mistakes || []} highlightedUtterance={highlightedUtterance} onNavigateToAnalysis={issueIndex => {
            setCurrentTab('results');
            // Scroll to the specific issue
            setTimeout(() => {
              const element = document.getElementById(`issue-${issueIndex}`);
              element?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              });
            }, 100);
          }} detectedLanguage={undefined} metadata={undefined} analysisData={dialog.openaiEvaluation || null} /> : <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">No transcription available</p>
                </CardContent>
              </Card>}
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Quality Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleStartAnalysis} 
                disabled={evaluateDialogMutation.isPending || !dialog.speakerTranscription} 
                size="lg"
              >
                {evaluateDialogMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start AI Analysis
                  </>
                )}
              </Button>
              {!dialog.speakerTranscription && (
                <p className="text-sm text-muted-foreground mt-2">
                  Transcription required before analysis can be performed.
                </p>
              )}
              
              {/* Progress Indicator */}
              {renderProgressIndicator()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <ErrorBoundaryAnalysis onRetry={() => loadDialog(id!)}>
            <div className="space-y-6">
            {/* AI Analysis Results */}
            {(analysisData || dialog.openaiEvaluation) ? (
              <div className="space-y-4">
                {/* Violation Summary Cards */}
                {(analysisData?.mistakes || dialog.openaiEvaluation?.mistakes) && 
                 (analysisData?.mistakes || dialog.openaiEvaluation?.mistakes)?.length > 0 && (
                  <AnalysisSummaryCards mistakes={analysisData?.mistakes || dialog.openaiEvaluation?.mistakes || []} />
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Overall Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        
                        <div className="text-3xl font-bold text-primary">
                          {analysisData?.overallScore || dialog.openaiEvaluation?.overallScore}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Confidence: {Math.round(((analysisData?.confidence || dialog.openaiEvaluation?.confidence) || 0) * 100)}%
                        </div>
                      </div>
                      
                      
                    </div>
                  </CardContent>
                </Card>

                {/* Category Scores */}
                {(analysisData?.categoryScores || dialog.openaiEvaluation?.categoryScores) && 
                 Object.keys(analysisData?.categoryScores || dialog.openaiEvaluation?.categoryScores || {}).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Category Scores</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(analysisData?.categoryScores || dialog.openaiEvaluation?.categoryScores || {}).map(([category, score]) => (
                          <div key={category} className="p-3 border rounded">
                            <div className="text-sm font-medium capitalize mb-1">
                              {category.replace(/_/g, ' ')}
                            </div>
                            <div className="text-2xl font-bold">{String(score)}%</div>
                           </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}


                {/* Recommendations */}
                {dialog.openaiEvaluation?.recommendations && dialog.openaiEvaluation.recommendations.length > 0 && <Card>
                    <CardHeader>
                      <CardTitle>Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-6 space-y-2">
                        {dialog.openaiEvaluation?.recommendations?.map((rec, index) => <li key={index} className="text-muted-foreground leading-relaxed">{rec}</li>)}
                      </ul>
                    </CardContent>
                  </Card>}

                {/* Enhanced Detected Issues with bidirectional navigation */}
                {dialog.openaiEvaluation?.mistakes && dialog.openaiEvaluation.mistakes.length > 0 && <Card>
                    <CardHeader>
                      <CardTitle>Detected Issues ({dialog.openaiEvaluation?.mistakes?.length || 0})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <EnhancedDialogDetail 
                        mistakes={dialog.openaiEvaluation?.mistakes || []} 
                        utterances={dialog.speakerTranscription || []} 
                        onNavigateToSpeaker={utteranceText => {
                          setHighlightedUtterance(utteranceText);
                          setCurrentTab('transcription');
                          // Scroll to the utterance in speaker dialog
                          setTimeout(() => {
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