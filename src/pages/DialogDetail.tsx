import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Play, Users, BarChart3, Loader2, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog } from '../types';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';
import { toast } from 'sonner';
import { extractUsernameFromEmail, capitalizeStatus } from '../utils/userUtils';
import DeepgramSpeakerDialog from '../components/DeepgramSpeakerDialog';
import { openaiEvaluationService } from '../services/openaiEvaluationService';
import { OpenAIEvaluationProgress } from '../types/openaiEvaluation';
import { supabase } from '../integrations/supabase/client';
import { generateDialogPDF } from '../utils/pdfGenerator';
const DialogDetail = () => {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<OpenAIEvaluationProgress | null>(null);
  const {
    getDialog,
    updateDialog
  } = useDatabaseDialogs();
  useEffect(() => {
    if (id) {
      loadDialog(id);
    }
  }, [id]);
  const loadDialog = async (dialogId: string) => {
    try {
      setIsLoading(true);
      const dialogData = await getDialog(dialogId);
      if (dialogData) {
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
    setIsAnalyzing(true);
    setAnalysisProgress(null);
    try {
      openaiEvaluationService.setProgressCallback(progress => {
        setAnalysisProgress(progress);
      });
      console.log('Starting OpenAI analysis for dialog:', dialog.id);
      const result = await openaiEvaluationService.evaluateConversation(dialog.speakerTranscription, 'gpt-5-mini-2025-08-07');
      console.log('OpenAI analysis completed:', result);
      const {
        error: analysisError
      } = await supabase.from('dialog_analysis').insert({
        dialog_id: dialog.id,
        analysis_type: 'openai',
        overall_score: result.overallScore,
        category_scores: result.categoryScores as any,
        mistakes: result.mistakes as any,
        recommendations: result.recommendations,
        summary: result.summary,
        confidence: result.confidence,
        token_usage: result.tokenUsage as any,
        processing_time: result.processingTime
      });
      if (analysisError) {
        throw analysisError;
      }
      await updateDialog(dialog.id, {
        openaiEvaluation: result,
        qualityScore: result.overallScore
      });
      toast.success('AI analysis completed successfully!');
      await loadDialog(dialog.id);
    } catch (error) {
      console.error('Error starting analysis:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Analysis failed: ${errorMessage}`);
      setAnalysisProgress({
        stage: 'error',
        progress: 0,
        message: `Analysis failed: ${errorMessage}`
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
  const handleExportPDF = async () => {
    if (!dialog) return;
    setIsExportingPDF(true);
    try {
      generateDialogPDF(dialog);
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
    if (!analysisProgress) return null;
    const getStageIcon = () => {
      switch (analysisProgress.stage) {
        case 'complete':
          return <CheckCircle className="h-4 w-4 text-green-500" />;
        case 'error':
          return <AlertCircle className="h-4 w-4 text-red-500" />;
        default:
          return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      }
    };
    return <div className="mt-4 p-4 border rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          {getStageIcon()}
          <span className="font-medium">{analysisProgress.message}</span>
        </div>
        {analysisProgress.progress > 0 && <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{
          width: `${analysisProgress.progress}%`
        }} />
          </div>}
        {analysisProgress.currentStep && <p className="text-sm text-muted-foreground mt-2">{String(analysisProgress.currentStep)}</p>}
      </div>;
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
      <Tabs defaultValue="transcription" className="w-full">
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
            {/* Speaker Transcription */}
            {dialog.speakerTranscription && dialog.speakerTranscription.length > 0 ? <DeepgramSpeakerDialog utterances={dialog.speakerTranscription} detectedLanguage={undefined} metadata={undefined} /> : <Card>
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
              <Button onClick={handleStartAnalysis} disabled={isAnalyzing || !dialog.speakerTranscription} size="lg">
                {isAnalyzing ? <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </> : <>
                    <Play className="h-4 w-4 mr-2" />
                    Start AI Analysis
                  </>}
              </Button>
              {!dialog.speakerTranscription && <p className="text-sm text-muted-foreground mt-2">
                  Transcription required before analysis can be performed.
                </p>}
              
              {/* Progress Indicator */}
              {renderProgressIndicator()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <div className="space-y-6">
            {/* OpenAI Analysis Results */}
            {dialog.openaiEvaluation ? <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Overall Analysis Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-2">Overall Score</h4>
                        <div className="text-3xl font-bold text-primary">
                          {dialog.openaiEvaluation.overallScore}%
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Confidence: {Math.round((dialog.openaiEvaluation.confidence || 0) * 100)}%
                        </div>
                      </div>
                      
                      
                    </div>
                  </CardContent>
                </Card>

                {/* Category Scores */}
                {dialog.openaiEvaluation.categoryScores && Object.keys(dialog.openaiEvaluation.categoryScores).length > 0 && <Card>
                    <CardHeader>
                      <CardTitle>Category Scores</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(dialog.openaiEvaluation.categoryScores).map(([category, score]) => <div key={category} className="p-3 border rounded">
                            <div className="text-sm font-medium capitalize mb-1">
                              {category.replace(/_/g, ' ')}
                            </div>
                            <div className="text-2xl font-bold">{String(score)}%</div>
                          </div>)}
                      </div>
                    </CardContent>
                  </Card>}

                {/* Summary */}
                {dialog.openaiEvaluation.summary}

                {/* Recommendations */}
                {dialog.openaiEvaluation.recommendations && dialog.openaiEvaluation.recommendations.length > 0 && <Card>
                    <CardHeader>
                      <CardTitle>Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-6 space-y-2">
                        {dialog.openaiEvaluation.recommendations.map((rec, index) => <li key={index} className="text-muted-foreground leading-relaxed">{rec}</li>)}
                      </ul>
                    </CardContent>
                  </Card>}

                {/* Mistakes */}
                {dialog.openaiEvaluation.mistakes && dialog.openaiEvaluation.mistakes.length > 0 && <Card>
                    <CardHeader>
                      <CardTitle>Detected Issues ({dialog.openaiEvaluation.mistakes.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {dialog.openaiEvaluation.mistakes.map((mistake, index) => <div key={mistake.id || index} className="p-4 border rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant={mistake.level === 'critical' ? 'destructive' : mistake.level === 'major' ? 'default' : 'secondary'}>
                                  {mistake.level}
                                </Badge>
                                <Badge variant="outline">{mistake.category}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {mistake.speaker}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {mistake.confidence}% confident
                              </Badge>
                            </div>
                            
                            <h5 className="font-medium mb-2">{mistake.mistakeName}</h5>
                            <p className="text-sm text-muted-foreground mb-2">{mistake.description}</p>
                            
                            {mistake.text && <div className="bg-muted p-2 rounded text-sm mb-2">
                                <strong>Quote:</strong> "{mistake.text}"
                              </div>}
                            
                            {mistake.suggestion && <div className="text-sm">
                                <strong>Suggestion:</strong> {mistake.suggestion}
                              </div>}
                          </div>)}
                      </div>
                    </CardContent>
                  </Card>}
              </div> : <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No analysis results available. Run AI analysis first.
                  </p>
                </CardContent>
              </Card>}
          </div>
        </TabsContent>
      </Tabs>
    </div>;
};
export default DialogDetail;