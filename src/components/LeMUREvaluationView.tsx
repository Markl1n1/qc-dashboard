import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { useToast } from './ui/use-toast';
import { Download, AlertCircle, Settings, Eye } from 'lucide-react';
import { EvaluationConfiguration, LeMUREvaluationResult, LeMUREvaluationProgress } from '../types/lemurEvaluation';
import { SpeakerUtterance } from '../types';
import { lemurEvaluationService } from '../services/lemurEvaluationService';
import { useDialogStore } from '../store/dialogStore';
import { generateTranscriptionPDF } from '../utils/pdfGenerator';
import { EvaluationConfigurationManager } from './EvaluationConfigurationManager';
import { PromptPreviewDialog } from './PromptPreviewDialog';
import LeMURModelSelector, { AssemblyAIRegion, ASSEMBLYAI_REGIONS } from './LeMURModelSelector';

interface LeMUREvaluationViewProps {
  utterances: SpeakerUtterance[];
  transcriptId?: string;
  assemblyAIResult?: any;
  onClose: () => void;
  onMistakeClick?: (mistakeText: string, position: number) => void;
}

export const LeMUREvaluationView: React.FC<LeMUREvaluationViewProps> = ({
  utterances,
  transcriptId,
  assemblyAIResult,
  onClose,
  onMistakeClick
}) => {
  const { toast } = useToast();
  const { updateLeMUREvaluation } = useDialogStore();
  const [evaluationResult, setEvaluationResult] = useState<LeMUREvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<LeMUREvaluationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedConfiguration, setSelectedConfiguration] = useState<EvaluationConfiguration | null>(null);
  const [showConfigManager, setShowConfigManager] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [availableConfigurations, setAvailableConfigurations] = useState<EvaluationConfiguration[]>([]);
  
  // New state for region and model selection
  const [selectedRegion, setSelectedRegion] = useState<AssemblyAIRegion>('US');
  const [selectedModel, setSelectedModel] = useState<string>('claude_sonnet_4_20250514');

  useEffect(() => {
    // Load available configurations
    loadConfigurations();
    
    // Set up progress callback
    lemurEvaluationService.setProgressCallback((progress) => {
      setProgress(progress);
    });

    // Set default configuration if none selected
    if (!selectedConfiguration) {
      const defaultConfig = lemurEvaluationService.getDefaultConfiguration();
      setSelectedConfiguration(defaultConfig);
    }

    // Set default model based on region
    const defaultModel = ASSEMBLYAI_REGIONS[selectedRegion].defaultModel;
    setSelectedModel(defaultModel);
  }, [selectedConfiguration, selectedRegion]);

  const loadConfigurations = () => {
    const stored = localStorage.getItem('evaluation_configurations');
    const configs: EvaluationConfiguration[] = stored ? JSON.parse(stored) : [];
    
    // Always include default configuration
    const defaultConfig = lemurEvaluationService.getDefaultConfiguration();
    const hasDefault = configs.some(c => c.id === 'default');
    
    if (!hasDefault) {
      configs.unshift(defaultConfig);
    }
    
    setAvailableConfigurations(configs);
  };

  const handleConfigurationSave = (config: EvaluationConfiguration) => {
    setSelectedConfiguration(config);
    loadConfigurations();
  };

  const handleStartEvaluation = async () => {
    if (!selectedConfiguration) {
      toast({
        title: "Configuration Required",
        description: "Please select an evaluation configuration before starting the analysis.",
        variant: "destructive"
      });
      return;
    }

    if (!transcriptId) {
      toast({
        title: "Transcript Required",
        description: "A valid transcript ID is required for LeMUR evaluation.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setEvaluationResult(null);
    
    try {
      console.log('Starting LeMUR evaluation with:', {
        configuration: selectedConfiguration.name,
        region: selectedRegion,
        model: selectedModel,
        apiUrl: ASSEMBLYAI_REGIONS[selectedRegion].apiUrl,
        transcriptId: transcriptId
      });
      
      const result = await lemurEvaluationService.evaluateDialog(
        utterances,
        selectedConfiguration,
        transcriptId,
        'en', // Default language, will be auto-detected
        assemblyAIResult,
        undefined, // manualLanguageOverride
        undefined, // customContextId
        selectedModel,
        selectedRegion
      );
      
      setEvaluationResult(result);
      
      // Save the evaluation results to the dialog store
      if (transcriptId) {
        updateLeMUREvaluation(transcriptId, result);
      }
      
      toast({
        title: "Evaluation Complete",
        description: `Analysis completed with ${result.confidence}% confidence using ${selectedModel} in ${ASSEMBLYAI_REGIONS[selectedRegion].name}`
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'LeMUR evaluation failed';
      setError(errorMessage);
      
      toast({
        title: "LeMUR Evaluation Failed", 
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const handleDownloadReport = useCallback(() => {
    if (!evaluationResult) {
      toast({
        title: "No Report Available",
        description: "Please run the evaluation before downloading the report.",
        variant: "destructive"
      });
      return;
    }

    const additionalInfo = {
      "Configuration Used": selectedConfiguration?.name || 'Default',
      "Region": `${ASSEMBLYAI_REGIONS[selectedRegion].name} (${ASSEMBLYAI_REGIONS[selectedRegion].apiUrl})`,
      "Model": selectedModel,
      "Overall Score": `${evaluationResult.overallScore}/100`,
      "Confidence": `${evaluationResult.confidence}%`,
      "Mistakes Found": evaluationResult.mistakes.length.toString(),
      "Banned Words": evaluationResult.bannedWordsDetected.length.toString(),
      "Processing Time": `${evaluationResult.processingTime}ms`,
      "Token Usage": `Input: ${evaluationResult.tokenUsage.input}, Output: ${evaluationResult.tokenUsage.output}`
    };

    generateTranscriptionPDF(
      utterances,
      'lemur_evaluation_report.pdf',
      'LeMUR Conversation Evaluation Report',
      additionalInfo
    );

    toast({
      title: "Download Started",
      description: "The LeMUR evaluation report has been downloaded successfully."
    });
  }, [evaluationResult, utterances, selectedConfiguration, selectedRegion, selectedModel, toast]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>LeMUR Conversation Evaluation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Evaluate conversation quality using AssemblyAI's LeMUR with advanced AI models and regional selection.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPromptPreview(true)}
              disabled={!selectedConfiguration}
            >
              <Eye className="h-4 w-4 mr-2" />
              Prompt
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Configuration Selection */}
          <div className="grid gap-2">
            <Label htmlFor="configuration">Evaluation Configuration</Label>
            <div className="flex gap-2">
              <Select
                value={selectedConfiguration?.id || ''}
                onValueChange={(configId) => {
                  const config = availableConfigurations.find(c => c.id === configId);
                  setSelectedConfiguration(config || null);
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select configuration..." />
                </SelectTrigger>
                <SelectContent>
                  {availableConfigurations.map(config => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowConfigManager(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Region and Model Selection */}
          <LeMURModelSelector
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            selectedRegion={selectedRegion}
            onRegionChange={setSelectedRegion}
            disabled={isLoading}
          />

          {/* Transcript ID Display */}
          {transcriptId && (
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium mb-1">Transcript ID</h4>
              <p className="text-sm text-muted-foreground font-mono">{transcriptId}</p>
            </div>
          )}

          {/* Configuration Details */}
          {selectedConfiguration && (
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">{selectedConfiguration.name}</h4>
              <p className="text-sm text-muted-foreground mb-2">{selectedConfiguration.description}</p>
              <div className="flex flex-wrap gap-2">
                {selectedConfiguration.categories.filter(c => c.enabled).map(category => (
                  <Badge 
                    key={category.id} 
                    variant={category.id === 'critical' ? 'destructive' : 'default'}
                  >
                    {category.name} (W:{category.weight})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Evaluation Controls */}
          <div className="flex justify-start items-center">
            <Button
              onClick={handleStartEvaluation}
              disabled={isLoading || !selectedConfiguration || !transcriptId}
            >
              {isLoading ? 'Evaluating with LeMUR...' : 'Start LeMUR Evaluation'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Manager Dialog */}
      {showConfigManager && (
        <EvaluationConfigurationManager 
          onConfigurationSave={handleConfigurationSave}
          onClose={() => setShowConfigManager(false)}
        />
      )}

      {/* Prompt Preview Dialog */}
      <PromptPreviewDialog
        isOpen={showPromptPreview}
        onClose={() => setShowPromptPreview(false)}
        configuration={selectedConfiguration}
        utterances={utterances}
        selectedModel={selectedModel}
        selectedRegion={selectedRegion}
      />

      {/* Progress Display */}
      {isLoading && progress && (
        <Card>
          <CardHeader>
            <CardTitle>LeMUR Evaluation Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{progress.message}</span>
                <span>{progress.progress}%</span>
              </div>
              <Progress value={progress.progress} />
              {progress.currentStep && (
                <div className="text-xs text-muted-foreground">
                  Current step: {progress.currentStep}
                </div>
              )}
              {progress.estimatedTimeRemaining && progress.estimatedTimeRemaining > 0 && (
                <div className="text-xs text-muted-foreground">
                  Estimated time remaining: {Math.round(progress.estimatedTimeRemaining)}s
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* LeMUR Evaluation Results */}
      {evaluationResult && (
        <div className="space-y-4">
          {/* Overall Score */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>LeMUR Analysis Results</CardTitle>
                  <div className="space-y-2">
                    <div className={`text-4xl font-bold ${
                      evaluationResult.overallScore >= 80 ? 'text-green-600' :
                      evaluationResult.overallScore >= 60 ? 'text-yellow-600' :
                      evaluationResult.overallScore >= 40 ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {evaluationResult.overallScore}/100
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Quality Score • Confidence: {evaluationResult.confidence}%
                    </p>
                    <div className="text-xs text-muted-foreground">
                      Model: {selectedModel} • Region: {ASSEMBLYAI_REGIONS[selectedRegion].name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Processing Time: {evaluationResult.processingTime}ms • 
                      Tokens: {evaluationResult.tokenUsage.input} in, {evaluationResult.tokenUsage.output} out
                      {evaluationResult.tokenUsage.cost && ` • Cost: $${evaluationResult.tokenUsage.cost.toFixed(4)}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Language: {evaluationResult.detectedLanguage?.toUpperCase()} • 
                      Analysis ID: {evaluationResult.analysisId}
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Report
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Issues Identified */}
          {evaluationResult.mistakes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Issues Identified ({evaluationResult.mistakes.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {evaluationResult.mistakes.map((mistake) => {
                    // Get category name from configuration
                    const category = selectedConfiguration?.categories.find(c => c.id === mistake.category);
                    const categoryName = category?.name || mistake.category;
                    
                    return (
                      <div key={mistake.id} className="p-3 border rounded">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant={
                            mistake.level === 'critical' ? 'destructive' : 
                            mistake.level === 'major' ? 'default' : 
                            'secondary'
                          }>
                            {categoryName.toUpperCase()} - {mistake.level.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {mistake.speaker} • Position {mistake.position} • {mistake.confidence}% confidence
                          </span>
                        </div>
                        <div className="font-medium mb-1">{mistake.mistakeName || mistake.description}</div>
                        <button
                          onClick={() => onMistakeClick?.(mistake.text, mistake.position)}
                          className="text-sm text-muted-foreground mb-2 hover:bg-muted rounded p-1 cursor-pointer transition-colors block"
                        >
                          "{mistake.text}" <span className="text-xs text-blue-600 ml-1">→ View in transcript</span>
                        </button>
                        <p className="text-sm text-muted-foreground">{mistake.suggestion}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>LeMUR Analysis Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-3">{evaluationResult.summary}</p>
              
              {evaluationResult.recommendations.length > 0 && (
                <div className="mb-3">
                  <h4 className="font-medium mb-2">Recommendations:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {evaluationResult.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {evaluationResult.bannedWordsDetected.length > 0 && (
                <Alert variant="destructive" className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {evaluationResult.bannedWordsDetected.length} banned word(s) detected: {evaluationResult.bannedWordsDetected.map(b => b.word).join(', ')}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
