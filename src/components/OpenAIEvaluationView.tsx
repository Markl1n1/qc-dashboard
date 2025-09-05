import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  Zap, 
  Brain, 
  Gauge, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  User,
  MessageSquare,
  Languages,
  Star,
  Loader2,
  Play
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { SpeakerUtterance } from '../types';
import { OpenAIEvaluationResult, OPENAI_MODELS, OpenAIModel } from '../types/openaiEvaluation';
import { openaiEvaluationService } from '../services/openaiEvaluationService';
import { useEnhancedDialogStore } from '../store/enhancedDialogStore';
import { useLanguageStore } from '../store/languageStore';
import { toast } from 'sonner';

interface OpenAIEvaluationViewProps {
  utterances: SpeakerUtterance[];
  transcriptId: string;
  openaiResult?: OpenAIEvaluationResult;
  onClose: () => void;
  onMistakeClick?: (utterance: string) => void;
  onTabChange?: (tab: string) => void;
}

export const OpenAIEvaluationView: React.FC<OpenAIEvaluationViewProps> = ({
  utterances,
  transcriptId,
  openaiResult,
  onClose,
  onMistakeClick,
  onTabChange
}) => {
  const [selectedModel, setSelectedModel] = useState('gpt-5');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [result, setResult] = useState<OpenAIEvaluationResult | null>(openaiResult || null);
  const { updateDialog } = useEnhancedDialogStore();
  const { commentLanguage, setCommentLanguage } = useLanguageStore();

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
      toast.error('Cannot evaluate without conversation transcript.');
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
      
      setProgress(100);
      setProgressMessage('Evaluation complete');
      setResult(evaluationResult);
      
      // Show success message
      toast.success('AI evaluation completed successfully!');
      
      // Update the dialog store with the new analysis and force refresh
      if (transcriptId) {
        console.log('🔄 Updating dialog with analysis result:', evaluationResult);
        updateDialog(transcriptId, {
          openaiEvaluation: evaluationResult
        });
        
        // Force a state refresh to ensure data is visible
        setTimeout(() => {
          updateDialog(transcriptId, {
            openaiEvaluation: evaluationResult
          });
        }, 500);
      }

      // Auto-redirect to Analysis Results tab with enhanced timing
      if (onTabChange) {
        setTimeout(() => {
          console.log('🔄 Auto-redirecting to analysis results');
          onTabChange('results');
          
          // Additional delay to ensure data is loaded
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('analysis-complete', { 
              detail: { transcriptId, result: evaluationResult } 
            }));
          }, 500);
        }, 1500); // Increased delay to ensure data propagation
      }

    } catch (error) {
      console.error('AI evaluation failed:', error);
      toast.error(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsRunning(false);
    }
  };

  const getDisplayComment = (mistake: any): string => {
    // Handle new format with original/russian object
    if (typeof mistake.comment === 'object' && mistake.comment) {
      if (commentLanguage === 'russian' && mistake.comment.russian) {
        return mistake.comment.russian;
      }
      return mistake.comment.original || '';
    }
    
    // Fallback to legacy format
    return typeof mistake.comment === 'string' ? mistake.comment : '';
  };

  const hasRussianComments = result?.mistakes?.some(mistake => {
    if (!mistake.comment) return false;
    if (typeof mistake.comment !== 'object') return false;
    const commentObj = mistake.comment as { original?: string; russian?: string };
    return !!commentObj.russian;
  }) || false;

  const selectedModelData = OPENAI_MODELS.find(m => m.id === selectedModel);

  if (!utterances || utterances.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No conversation data available for evaluation.
      </div>
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
                  <span className="font-medium">Confidence:</span> {Math.round((result.confidence || 0) * 100)}%
                </div>
                <div>
                  <span className="font-medium">Processing Time:</span> {((result.processingTime || 0) / 1000).toFixed(1)}s
                </div>
                <div>
                  <span className="font-medium">Cost:</span> ${result.tokenUsage?.cost?.toFixed(4) || 'N/A'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detected Issues */}
          {result.mistakes && result.mistakes.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle size={20} />
                    Detected Issues ({result.mistakes?.length || 0})
                  </CardTitle>
                  {hasRussianComments && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCommentLanguage(commentLanguage === 'original' ? 'russian' : 'original')}
                      className="flex items-center gap-2"
                    >
                      <Languages size={16} />
                      {commentLanguage === 'original' ? 'Show Russian' : 'Show Original'}
                    </Button>
                  )}
                </div>
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
                        <h4 className="font-medium text-sm">{getDisplayComment(mistake)}</h4>
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
                          onClick={() => onMistakeClick(mistake.utterance)}
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
        </div>
      )}
    </div>
  );
};