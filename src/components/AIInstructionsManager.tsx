
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Save, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  FileText,
  Cpu,
  Target
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../integrations/supabase/client';

interface AIInstruction {
  id: string;
  type: 'system' | 'evaluation' | 'analysis';
  content: string;
  description: string;
  created_at: string;
  updated_at: string;
}

const AIInstructionsManager = () => {
  const [instructions, setInstructions] = useState<AIInstruction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local state for editing
  const [systemInstructions, setSystemInstructions] = useState('');
  const [evaluationInstructions, setEvaluationInstructions] = useState('');
  const [analysisInstructions, setAnalysisInstructions] = useState('');

  useEffect(() => {
    loadInstructions();
  }, []);

  const loadInstructions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // List files from the ai-instructions bucket
      const { data: files, error: listError } = await supabase.storage
        .from('ai-instructions')
        .list('', {
          limit: 100,
          offset: 0
        });

      if (listError) throw listError;

      // Load content from each file
      const loadedInstructions: AIInstruction[] = [];
      
      for (const file of files || []) {
        try {
          const { data: content, error: downloadError } = await supabase.storage
            .from('ai-instructions')
            .download(file.name);

          if (downloadError) {
            console.warn(`Failed to load ${file.name}:`, downloadError);
            continue;
          }

          const text = await content.text();
          
          // Determine type from filename
          let type: 'system' | 'evaluation' | 'analysis' = 'system';
          if (file.name.includes('evaluation')) type = 'evaluation';
          else if (file.name.includes('analysis')) type = 'analysis';

          loadedInstructions.push({
            id: file.name,
            type,
            content: text,
            description: getDescriptionForType(type),
            created_at: file.created_at || new Date().toISOString(),
            updated_at: file.updated_at || new Date().toISOString()
          });
        } catch (err) {
          console.warn(`Error processing ${file.name}:`, err);
        }
      }

      setInstructions(loadedInstructions);

      // Set local state for editing
      const systemInst = loadedInstructions.find(i => i.type === 'system');
      const evalInst = loadedInstructions.find(i => i.type === 'evaluation');
      const analysisInst = loadedInstructions.find(i => i.type === 'analysis');

      setSystemInstructions(systemInst?.content || '');
      setEvaluationInstructions(evalInst?.content || '');
      setAnalysisInstructions(analysisInst?.content || '');

    } catch (err) {
      console.error('Error loading AI instructions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load AI instructions');
    } finally {
      setIsLoading(false);
    }
  };

  const getDescriptionForType = (type: string): string => {
    switch (type) {
      case 'system':
        return 'Core system instructions for AI behavior and response format';
      case 'evaluation':
        return 'Instructions for evaluating agent performance and call quality';
      case 'analysis':
        return 'Instructions for analyzing conversation patterns and generating insights';
      default:
        return 'AI instruction set';
    }
  };

  const saveInstructions = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const instructionsToSave = [
        { type: 'system', content: systemInstructions, filename: 'system-instructions.txt' },
        { type: 'evaluation', content: evaluationInstructions, filename: 'evaluation-instructions.txt' },
        { type: 'analysis', content: analysisInstructions, filename: 'analysis-instructions.txt' }
      ];

      for (const instruction of instructionsToSave) {
        if (instruction.content.trim()) {
          const blob = new Blob([instruction.content], { type: 'text/plain' });
          
          const { error: uploadError } = await supabase.storage
            .from('ai-instructions')
            .upload(instruction.filename, blob, {
              upsert: true,
              contentType: 'text/plain'
            });

          if (uploadError) throw uploadError;
        }
      }

      toast.success('AI instructions saved successfully');
      await loadInstructions(); // Reload to get updated timestamps
    } catch (err) {
      console.error('Error saving AI instructions:', err);
      setError(err instanceof Error ? err.message : 'Failed to save AI instructions');
      toast.error('Failed to save AI instructions');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading AI instructions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="system" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            System
          </TabsTrigger>
          <TabsTrigger value="evaluation" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Evaluation
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                System Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Core system instructions that define how the AI should behave and format responses.
              </p>
              <div>
                <Label htmlFor="system-instructions">Instructions</Label>
                <Textarea
                  id="system-instructions"
                  value={systemInstructions}
                  onChange={(e) => setSystemInstructions(e.target.value)}
                  placeholder="Enter system instructions..."
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evaluation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Evaluation Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Instructions for evaluating agent performance, call quality, and customer service metrics.
              </p>
              <div>
                <Label htmlFor="evaluation-instructions">Instructions</Label>
                <Textarea
                  id="evaluation-instructions"
                  value={evaluationInstructions}
                  onChange={(e) => setEvaluationInstructions(e.target.value)}
                  placeholder="Enter evaluation instructions..."
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Analysis Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Instructions for analyzing conversation patterns, sentiment, and generating insights.
              </p>
              <div>
                <Label htmlFor="analysis-instructions">Instructions</Label>
                <Textarea
                  id="analysis-instructions"
                  value={analysisInstructions}
                  onChange={(e) => setAnalysisInstructions(e.target.value)}
                  placeholder="Enter analysis instructions..."
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={loadInstructions} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Reload
        </Button>

        <Button onClick={saveInstructions} disabled={isSaving}>
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Instructions
            </>
          )}
        </Button>
      </div>

      {instructions.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 border rounded-lg bg-muted/20">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>
            Last updated: {new Date(Math.max(...instructions.map(i => new Date(i.updated_at).getTime()))).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
};

export default AIInstructionsManager;
