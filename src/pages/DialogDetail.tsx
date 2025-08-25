
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDialogStore } from '../store/dialogStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  ArrowLeft, 
  Download, 
  User, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Pause
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import SpeakerDialog from '../components/SpeakerDialog';
import { LeMUREvaluationView } from '../components/LeMUREvaluationView';
import EnhancedSpeakerTranscription from '../components/EnhancedSpeakerTranscription';
import { generateTranscriptionPDF } from '../utils/pdfGenerator';
import { OpenAIEvaluationView } from '../components/OpenAIEvaluationView';

const DialogDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getDialog } = useDialogStore();
  const { toast } = useToast();
  const [showSpeakerDialog, setShowSpeakerDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('transcription');
  const [highlightedMistake, setHighlightedMistake] = useState<string | null>(null);

  const dialog = id ? getDialog(id) : null;

  useEffect(() => {
    if (!dialog) {
      toast({
        title: "Dialog not found",
        description: "The requested dialog could not be found.",
        variant: "destructive",
      });
      navigate('/');
    }
  }, [dialog, navigate, toast]);

  if (!dialog) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Dialog not found</h3>
          <p className="text-muted-foreground mb-4">The requested dialog could not be found.</p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleDownloadPDF = () => {
    if (!dialog.transcription) return;

    const additionalInfo = {
      "Dialog ID": dialog.id,
      "Assigned Agent": dialog.assignedAgent,
      "Assigned Supervisor": dialog.assignedSupervisor,
      "Overall Score": dialog.lemurEvaluation?.overallScore ? `${dialog.lemurEvaluation.overallScore}%` : 'N/A'
    };

    generateTranscriptionPDF(
      getCurrentSpeakerUtterances(),
      `${dialog.fileName}_report.pdf`,
      `Dialog Report - ${dialog.fileName}`,
      additionalInfo
    );

    toast({
      title: "PDF Generated",
      description: "Dialog report has been downloaded as PDF.",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
        );
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getCurrentSpeakerUtterances = () => {
    if (!dialog.speakerTranscription) return [];
    
    if (dialog.currentLanguage === 'russian' && dialog.translations?.speakers?.ru) {
      return dialog.translations.speakers.ru;
    }
    
    return dialog.speakerTranscription;
  };

  const handleMistakeClick = (mistakeText: string, position: number) => {
    setHighlightedMistake(mistakeText);
    setActiveTab('transcription');
    
    // Scroll to the specific utterance after tab switch
    setTimeout(() => {
      const utteranceElement = document.querySelector(`[data-utterance-index="${position}"]`);
      if (utteranceElement) {
        utteranceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Helper function to get quality score color class
  const getQualityScoreColor = (score: number | undefined): string => {
    if (typeof score !== 'number') return 'text-muted-foreground';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Helper function to format quality score display
  const formatQualityScore = (score: number | undefined): string => {
    if (typeof score === 'number') {
      return `${score}/100`;
    }
    return 'Not analyzed';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold break-words">{dialog.fileName}</h1>
            <p className="text-muted-foreground text-sm">
              Uploaded {formatDistanceToNow(new Date(dialog.uploadDate))} ago
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {dialog.transcription && (
            <Button variant="outline" onClick={handleDownloadPDF} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          )}
        </div>
      </div>

      {/* Status and Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center space-x-3">
              {getStatusIcon(dialog.status)}
              <div>
                <p className="font-medium">Status</p>
                <Badge variant="outline" className={getStatusColor(dialog.status)}>
                  {dialog.status.charAt(0).toUpperCase() + dialog.status.slice(1)}
                </Badge>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Assigned Agent</p>
                <p className="text-muted-foreground text-sm break-words">{dialog.assignedAgent}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Supervisor</p>
                <p className="text-muted-foreground text-sm break-words">{dialog.assignedSupervisor}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Quality Score</p>
                <p className={`font-semibold ${getQualityScoreColor(dialog.qualityScore)}`}>
                  {formatQualityScore(dialog.qualityScore)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {dialog.status === 'failed' && dialog.error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Processing failed: {dialog.error}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      {dialog.transcription && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="transcription">Transcription</TabsTrigger>
            <TabsTrigger value="analysis">Analysis Results</TabsTrigger>
            <TabsTrigger value="lemur">LeMUR Evaluation</TabsTrigger>
            <TabsTrigger value="openai">OpenAI Evaluation</TabsTrigger>
          </TabsList>

          <TabsContent value="transcription" className="space-y-4">
            <h2 className="text-xl font-semibold">Transcription</h2>
            
            <EnhancedSpeakerTranscription 
              utterances={getCurrentSpeakerUtterances()}
              mistakes={dialog.lemurEvaluation?.mistakes}
              highlightedMistake={highlightedMistake}
            />
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <h2 className="text-xl font-semibold">Analysis Results</h2>
            
            {dialog.lemurEvaluation ? (
              <div className="space-y-6">
                {/* Overall Score */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span>Overall Performance</span>
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {dialog.lemurEvaluation.overallScore}/100
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{dialog.lemurEvaluation.summary}</p>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Confidence: {dialog.lemurEvaluation.confidence}%
                    </div>
                  </CardContent>
                </Card>

                {/* Category Scores */}
                {Object.keys(dialog.lemurEvaluation.categoryScores).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Category Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(dialog.lemurEvaluation.categoryScores).map(([categoryId, score]) => (
                          <div key={categoryId} className="text-center p-3 border rounded">
                            <div className="font-medium capitalize text-sm">{categoryId.replace('_', ' ')}</div>
                            <div className={`text-xl sm:text-2xl font-bold ${
                              typeof score === 'number' && score >= 80 ? 'text-green-600' : 
                              typeof score === 'number' && score >= 60 ? 'text-yellow-600' : 
                              'text-red-600'
                            }`}>
                              {typeof score === 'number' ? `${score}/100` : 'N/A'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Mistakes/Issues */}
                {dialog.lemurEvaluation.mistakes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Issues Identified ({dialog.lemurEvaluation.mistakes.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {dialog.lemurEvaluation.mistakes.map((mistake) => (
                          <div key={mistake.id} className="border-l-4 border-orange-500 pl-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2">
                              <h4 className="font-medium">{mistake.mistakeName || mistake.description}</h4>
                              <Badge variant={
                                mistake.level === 'critical' ? 'destructive' : 
                                mistake.level === 'major' ? 'default' : 
                                'secondary'
                              }>
                                {mistake.level.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{mistake.description}</p>
                            {mistake.text && (
                              <button
                                onClick={() => handleMistakeClick(mistake.text, mistake.position || 0)}
                                className="text-sm italic border-l-2 border-muted pl-2 mb-2 block hover:bg-muted rounded p-1 cursor-pointer transition-colors break-words"
                              >
                                "{mistake.text}" <span className="text-xs text-blue-600 ml-1">→ View in transcript</span>
                              </button>
                            )}
                            <p className="text-sm font-medium text-green-700">
                              💡 {mistake.suggestion}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recommendations */}
                {dialog.lemurEvaluation.recommendations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-5 space-y-1">
                        {dialog.lemurEvaluation.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm break-words">{rec}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Banned Words */}
                {dialog.lemurEvaluation.bannedWordsDetected?.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {dialog.lemurEvaluation.bannedWordsDetected.length} banned word(s) detected: {dialog.lemurEvaluation.bannedWordsDetected.map(b => b.word).join(', ')}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
                    <p className="text-lg font-semibold mb-2">No Analysis Results Available</p>
                    <p>Run a LeMUR evaluation to see detailed analysis results here.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="lemur" className="space-y-4">
            <LeMUREvaluationView 
              utterances={getCurrentSpeakerUtterances()}
              transcriptId={dialog.id}
              assemblyAIResult={dialog.lemurEvaluation}
              onClose={() => {}}
              onMistakeClick={handleMistakeClick}
            />
          </TabsContent>

          <TabsContent value="openai" className="space-y-4">
            <OpenAIEvaluationView 
              utterances={getCurrentSpeakerUtterances()}
              transcriptId={dialog.id}
              openaiResult={dialog.openaiEvaluation}
              onClose={() => {}}
              onMistakeClick={handleMistakeClick}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Processing State */}
      {dialog.status === 'processing' && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Processing...</h3>
              <p className="text-muted-foreground">
                Your audio file is being transcribed and analyzed. This may take a few minutes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Speaker Dialog Modal */}
      <SpeakerDialog 
        isOpen={showSpeakerDialog}
        onClose={() => setShowSpeakerDialog(false)}
        utterances={getCurrentSpeakerUtterances()}
        dialogTitle={dialog.fileName}
      />
    </div>
  );
};

export default DialogDetail;
