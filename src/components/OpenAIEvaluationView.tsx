import React, { useState } from 'react';
import { SpeakerUtterance } from '../types';
import { OpenAIEvaluationResult, OpenAIModel, OPENAI_MODELS } from '../types/openaiEvaluation';
import { openaiEvaluationService } from '../services/openaiEvaluationService';
import { useDialogStore } from '../store/dialogStore';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { 
  Play, 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  Zap, 
  Brain, 
  DollarSign,
  Star
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface OpenAIEvaluationViewProps {
  utterances: SpeakerUtterance[];
  transcriptId: string;
  openaiResult?: OpenAIEvaluationResult;
  onClose: () => void;
  onMistakeClick?: (mistakeText: string, position: number) => void;
}

export const OpenAIEvaluationView: React.FC<OpenAIEvaluationViewProps> = ({
  utterances,
  transcriptId,
  openaiResult,
  onMistakeClick
}) => {
  const [selectedModel, setSelectedModel] = useState<string>('gpt-5-mini-2025-08-07');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [result, setResult] = useState<OpenAIEvaluationResult | undefined>(openaiResult);
  const { updateDialog } = useDialogStore();
  const { toast } = useToast();

  const getModelIcon = (category: OpenAIModel['category']) => {
    switch (category) {
      case 'flagship': return <Star className="h-4 w-4" />;
      case 'fast': return <Zap className="h-4 w-4" />;
      case 'reasoning': return <Brain className="h-4 w-4" />;
      case 'economic': return <DollarSign className="h-4 w-4" />;
      default: return <Star className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: OpenAIModel['category']) => {
    switch (category) {
      case 'flagship': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'fast': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'reasoning': return 'bg-green-100 text-green-800 border-green-200';
      case 'economic': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleStartEvaluation = async () => {
    if (!utterances || utterances.length === 0) {
      toast({
        title: "No conversation data",
        description: "Cannot evaluate without conversation transcript.",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setProgressMessage('Initializing evaluation...');

    try {
      openaiEvaluationService.setProgressCallback((progressData) => {
        setProgress(progressData.progress * 100);
        setProgressMessage(progressData.message);
      });

      const evaluationResult = await openaiEvaluationService.evaluateConversation(utterances, selectedModel);
      
      setResult(evaluationResult);
      
      updateDialog(transcriptId, { 
        openaiEvaluation: evaluationResult
      });

      toast({
        title: "Evaluation completed",
        description: `OpenAI analysis finished with overall score: ${evaluationResult.score || evaluationResult.overallScore}/100`,
      });

    } catch (error) {
      console.error('OpenAI evaluation failed:', error);
      toast({
        title: "Evaluation failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const selectedModelData = OPENAI_MODELS.find(m => m.id === selectedModel);

  if (!utterances || utterances.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">No Conversation Data</p>
            <p>Please upload and process an audio file first to enable OpenAI evaluation.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            OpenAI Evaluation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Model Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Select OpenAI Model</label>
            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isRunning}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a model" />
              </SelectTrigger>
              <SelectContent>
                {OPENAI_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      {getModelIcon(model.category)}
                      <span className="font-medium">{model.name}</span>
                      {model.recommended && <Badge variant="secondary" className="text-xs">Recommended</Badge>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedModelData && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className={getCategoryColor(selectedModelData.category)}>
                  {selectedModelData.category}
                </Badge>
                <span>{selectedModelData.description}</span>
                <span>• ${selectedModelData.costPer1kTokens}/1K tokens</span>
              </div>
            )}
          </div>

          {/* Action Button */}
          <Button 
            onClick={handleStartEvaluation} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Evaluation...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start OpenAI Evaluation
              </>
            )}
          </Button>

          {/* Progress */}
          {isRunning && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground">{progressMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Display */}
      {result && (
        <div className="space-y-6">
          {/* Overall Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Overall Performance
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {result.score || result.overallScore}/100
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{result.summary}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Model Used:</span> {result.modelUsed}
                </div>
                <div>
                  <span className="font-medium">Confidence:</span> {Math.round((result.confidence * 100))}%
                </div>
                <div>
                  <span className="font-medium">Processing Time:</span> {(result.processingTime / 1000).toFixed(1)}s
                </div>
                <div>
                  <span className="font-medium">Cost:</span> ${result.tokenUsage.cost?.toFixed(4) || 'N/A'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Scores */}
          {Object.keys(result.categoryScores).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Category Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(result.categoryScores).map(([categoryId, score]) => (
                    <div key={categoryId} className="text-center p-3 border rounded">
                      <div className="font-medium capitalize">{categoryId.replace('_', ' ')}</div>
                      <div className={`text-2xl font-bold ${
                        score >= 80 ? 'text-green-600' : 
                        score >= 60 ? 'text-yellow-600' : 
                        'text-red-600'
                      }`}>
                        {score}/100
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Speakers Information */}
          {result.speakers && result.speakers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Speaker Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.speakers.map((speaker, index) => (
                    <div key={index} className="p-3 border rounded">
                      {speaker.speaker_0 && (
                        <div className="mb-2">
                          <span className="font-medium">Speaker 0:</span> {speaker.speaker_0}
                          {speaker.role_0 && <span className="text-muted-foreground ml-2">({speaker.role_0})</span>}
                        </div>
                      )}
                      {speaker.speaker_1 && (
                        <div>
                          <span className="font-medium">Speaker 1:</span> {speaker.speaker_1}
                          {speaker.role_1 && <span className="text-muted-foreground ml-2">({speaker.role_1})</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detected Issues */}
          {result.mistakes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detected Issues ({result.mistakes.length} items)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.mistakes.map((mistake, index) => (
                    <div key={index} className={`border-l-4 pl-4 ${
                      mistake.rule_category === 'Banned' ? 'border-red-500' :
                      mistake.rule_category === 'Mistake' ? 'border-orange-500' :
                      mistake.rule_category === 'Not Recommended' ? 'border-yellow-500' :
                      'border-green-500'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">{mistake.comment}</h4>
                        <Badge variant={
                          mistake.rule_category === 'Banned' ? 'destructive' : 
                          mistake.rule_category === 'Mistake' ? 'default' : 
                          mistake.rule_category === 'Not Recommended' ? 'secondary' :
                          'outline'
                        } className="text-xs">
                          {mistake.rule_category}
                        </Badge>
                      </div>
                      {mistake.utterance && onMistakeClick && (
                        <button
                          onClick={() => onMistakeClick(mistake.utterance, 0)}
                          className="text-sm italic border-l-2 border-muted pl-2 mb-2 block hover:bg-muted rounded p-1 cursor-pointer transition-colors w-full text-left"
                        >
                          <span className="text-muted-foreground">Quote:</span> "{mistake.utterance}" 
                          <span className="text-xs text-blue-600 ml-2">→ View in transcript</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-1">
                  {result.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm">{rec}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
