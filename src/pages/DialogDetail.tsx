
import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Play, Users, BarChart3, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog } from '../types';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';
import { toast } from 'sonner';
import DeepgramSpeakerDialog from '../components/DeepgramSpeakerDialog';

const DialogDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { getDialog } = useDatabaseDialogs();

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
    if (!dialog) return;
    
    setIsAnalyzing(true);
    try {
      // TODO: Implement OpenAI analysis call
      toast.success('Analysis started successfully!');
      // Reload dialog to get updated analysis results
      await loadDialog(dialog.id);
    } catch (error) {
      console.error('Error starting analysis:', error);
      toast.error('Failed to start analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStatusColor = (status: Dialog['status']) => {
    switch (status) {
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading dialog details...</span>
        </div>
      </div>
    );
  }

  if (!dialog) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
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
            {dialog.status}
          </Badge>
        </div>
        
        <h1 className="text-3xl font-bold mb-2">{dialog.fileName}</h1>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <span>Supervisor: {dialog.assignedSupervisor}</span>
          <span>•</span>
          <span>Uploaded: {new Date(dialog.uploadDate).toLocaleDateString()}</span>
          {dialog.qualityScore && (
            <>
              <span>•</span>
              <span>Quality Score: {dialog.qualityScore}%</span>
            </>
          )}
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
            {dialog.speakerTranscription && dialog.speakerTranscription.length > 0 ? (
              <DeepgramSpeakerDialog
                utterances={dialog.speakerTranscription}
                detectedLanguage={undefined}
                metadata={undefined}
              />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">No transcription available</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Quality Analysis</CardTitle>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Run AI-powered analysis on this dialog to evaluate quality, detect issues, and get improvement recommendations.
                </p>
                <Button 
                  onClick={handleStartAnalysis}
                  disabled={isAnalyzing || !dialog.speakerTranscription}
                  size="lg"
                >
                  {isAnalyzing ? (
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
              </CardContent>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <div className="space-y-6">
            {/* OpenAI Analysis Results */}
            {dialog.openaiEvaluation ? (
              <Card>
                <CardHeader>
                  <CardTitle>OpenAI Analysis Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Overall Score</h4>
                      <div className="text-2xl font-bold text-primary">
                        {dialog.openaiEvaluation.overallScore}%
                      </div>
                    </div>
                    
                    {dialog.openaiEvaluation.summary && (
                      <div>
                        <h4 className="font-medium mb-2">Summary</h4>
                        <p className="text-muted-foreground">{dialog.openaiEvaluation.summary}</p>
                      </div>
                    )}

                    {dialog.openaiEvaluation.recommendations && dialog.openaiEvaluation.recommendations.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Recommendations</h4>
                        <ul className="list-disc pl-6 space-y-1">
                          {dialog.openaiEvaluation.recommendations.map((rec, index) => (
                            <li key={index} className="text-muted-foreground">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DialogDetail;
