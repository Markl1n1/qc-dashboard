
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDialogStore } from '../store/dialogStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { Progress } from '../components/ui/progress';
import { ArrowLeft, FileText, Users, Clock, Award, AlertTriangle, CheckCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import EnhancedSpeakerTranscription from '../components/EnhancedSpeakerTranscription';
import LeMUREvaluationView from '../components/LeMUREvaluationView';
import OpenAIEvaluationView from '../components/OpenAIEvaluationView';
import SalesAnalysisView from '../components/SalesAnalysisView';
import { LanguageToggle } from '../components/LanguageToggle';
import SimpleTranslationButton from '../components/SimpleTranslationButton';

interface DialogDetailParams {
  id: string;
}

const DialogDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getDialog } = useDialogStore();
  const [dialog, setDialog] = useState(getDialog(id || ''));

  useEffect(() => {
    if (!id) {
      navigate('/dashboard');
      return;
    }

    const currentDialog = getDialog(id);
    if (!currentDialog) {
      navigate('/dashboard');
      return;
    }

    setDialog(currentDialog);
    
    const unsubscribe = useDialogStore.subscribe((state) => {
      const updatedDialog = state.dialogs.find(d => d.id === id);
      if (updatedDialog) {
        setDialog(updatedDialog);
      }
    });

    return unsubscribe;
  }, [id, getDialog, navigate]);

  if (!dialog) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Dialog not found</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'processing': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'processing': return <Clock className="h-4 w-4" />;
      case 'failed': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const hasLeMURData = dialog.lemurEvaluation && dialog.lemurEvaluation.mistakes;
  const lemurMistakes = hasLeMURData ? dialog.lemurEvaluation.mistakes : [];

  // Language handling
  const currentLang = dialog.currentLanguage || 'original';
  const displayTranscription = currentLang === 'russian' && dialog.translations 
    ? dialog.translations.russian?.transcription || dialog.transcription
    : dialog.transcription;

  const displaySpeakerUtterances = currentLang === 'russian' && dialog.translations?.russian?.speakerUtterances
    ? dialog.translations.russian.speakerUtterances
    : dialog.speakerTranscription;

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold truncate">{dialog.fileName}</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <LanguageToggle dialogId={dialog.id} />
            <SimpleTranslationButton dialogId={dialog.id} />
          </div>
        </div>

        {/* Status and Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(dialog.status)}`} />
                <span className="font-medium capitalize">{dialog.status}</span>
                {getStatusIcon(dialog.status)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Users className="h-4 w-4 mr-1" />
                Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="font-medium">{dialog.assignedAgent}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Users className="h-4 w-4 mr-1" />
                Supervisor
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="font-medium">{dialog.assignedSupervisor}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Award className="h-4 w-4 mr-1" />
                Quality Score
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {dialog.qualityScore !== undefined ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">
                      {typeof dialog.qualityScore === 'number' ? dialog.qualityScore : 'N/A'}
                    </span>
                    <Badge variant={
                      typeof dialog.qualityScore === 'number' && dialog.qualityScore >= 80 ? 'default' :
                      typeof dialog.qualityScore === 'number' && dialog.qualityScore >= 60 ? 'secondary' : 'destructive'
                    }>
                      {typeof dialog.qualityScore === 'number' && dialog.qualityScore >= 80 ? 'Good' :
                       typeof dialog.qualityScore === 'number' && dialog.qualityScore >= 60 ? 'Average' : 'Poor'}
                    </Badge>
                  </div>
                  <Progress 
                    value={typeof dialog.qualityScore === 'number' ? dialog.qualityScore : 0} 
                    className="h-2" 
                  />
                </div>
              ) : (
                <span className="text-muted-foreground">Not analyzed</span>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="transcription" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="transcription">Transcription</TabsTrigger>
            <TabsTrigger value="lemur-evaluation">
              LeMUR Evaluation
              {hasLeMURData && (
                <Badge variant="secondary" className="ml-2">
                  {lemurMistakes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="openai-evaluation">OpenAI Evaluation</TabsTrigger>
            <TabsTrigger value="sales-analysis">Sales Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="transcription" className="space-y-4">
            {displayTranscription && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Full Transcription</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(displayTranscription, 'Transcription')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-wrap">{displayTranscription}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {displaySpeakerUtterances && displaySpeakerUtterances.length > 0 && (
              <EnhancedSpeakerTranscription
                speakerUtterances={displaySpeakerUtterances}
                mistakes={lemurMistakes}
                dialogId={dialog.id}
              />
            )}
          </TabsContent>

          <TabsContent value="lemur-evaluation">
            {dialog.lemurEvaluation ? (
              <LeMUREvaluationView 
                evaluation={dialog.lemurEvaluation} 
                speakerUtterances={displaySpeakerUtterances || []}
              />
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    <p>No LeMUR evaluation available for this dialog.</p>
                    <p className="text-sm mt-2">Run an evaluation to see detailed analysis here.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="openai-evaluation">
            {dialog.openaiEvaluation ? (
              <OpenAIEvaluationView 
                evaluation={dialog.openaiEvaluation}
                speakerUtterances={displaySpeakerUtterances || []}
              />
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    <p>No OpenAI evaluation available for this dialog.</p>
                    <p className="text-sm mt-2">Run an OpenAI evaluation to see detailed analysis here.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sales-analysis">
            <SalesAnalysisView dialogId={dialog.id} />
          </TabsContent>
        </Tabs>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Upload Date:</span>
                <span className="ml-2 text-muted-foreground">
                  {format(new Date(dialog.uploadDate), 'PPp')}
                </span>
              </div>
              {dialog.error && (
                <div>
                  <span className="font-medium text-red-600">Error:</span>
                  <span className="ml-2 text-red-600">{dialog.error}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DialogDetail;
