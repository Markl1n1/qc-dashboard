
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Plus, 
  Edit3, 
  Copy, 
  Trash2, 
  Eye, 
  Info,
  MessageSquare,
  Settings,
  Star
} from 'lucide-react';
import { PromptContext, promptContextService } from '../services/promptContextService';
import { useToast } from './ui/use-toast';

interface PromptContextManagerProps {
  selectedContextId?: string;
  onContextSelect?: (context: PromptContext) => void;
}

export const PromptContextManager: React.FC<PromptContextManagerProps> = ({
  selectedContextId,
  onContextSelect
}) => {
  const { toast } = useToast();
  const [contexts, setContexts] = useState<PromptContext[]>([]);
  const [editingContext, setEditingContext] = useState<PromptContext | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContext, setPreviewContext] = useState<PromptContext | null>(null);

  useEffect(() => {
    loadContexts();
  }, []);

  const loadContexts = () => {
    setContexts(promptContextService.getContexts());
  };

  const createNewContext = () => {
    const newContext: PromptContext = {
      id: `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'New Context',
      description: 'Custom prompt context',
      systemPromptContext: promptContextService.getDefaultContext().systemPromptContext,
      evaluationContext: promptContextService.getDefaultContext().evaluationContext,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setEditingContext(newContext);
    setShowEditor(true);
  };

  const editContext = (context: PromptContext) => {
    setEditingContext({ ...context });
    setShowEditor(true);
  };

  const duplicateContext = (context: PromptContext) => {
    try {
      const duplicate = promptContextService.duplicateContext(context.id, `${context.name} (Copy)`);
      loadContexts();
      toast({
        title: "Context Duplicated",
        description: `Created copy: ${duplicate.name}`
      });
    } catch (error) {
      toast({
        title: "Duplication Failed",
        description: error instanceof Error ? error.message : "Failed to duplicate context",
        variant: "destructive"
      });
    }
  };

  const deleteContext = (context: PromptContext) => {
    if (context.isDefault) {
      toast({
        title: "Cannot Delete",
        description: "Default context cannot be deleted",
        variant: "destructive"
      });
      return;
    }

    try {
      promptContextService.deleteContext(context.id);
      loadContexts();
      toast({
        title: "Context Deleted",
        description: `${context.name} has been deleted`
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete context",
        variant: "destructive"
      });
    }
  };

  const saveContext = () => {
    if (!editingContext) return;

    try {
      promptContextService.saveContext(editingContext);
      loadContexts();
      setShowEditor(false);
      setEditingContext(null);
      
      toast({
        title: "Context Saved",
        description: `${editingContext.name} has been saved`
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save context",
        variant: "destructive"
      });
    }
  };

  const previewContextText = (context: PromptContext) => {
    setPreviewContext(context);
    setShowPreview(true);
  };

  const availableVariables = promptContextService.getAvailableVariables();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Prompt Context Manager
          </h3>
          <p className="text-sm text-muted-foreground">
            Customize evaluation prompts with your own context and instructions
          </p>
        </div>
        <Button onClick={createNewContext}>
          <Plus className="h-4 w-4 mr-2" />
          New Context
        </Button>
      </div>

      {/* Available Variables Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">Available Template Variables:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {availableVariables.slice(0, 6).map(variable => (
                <code key={variable.key} className="bg-muted px-1 py-0.5 rounded text-xs">
                  {variable.key}
                </code>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Use these variables in your context templates to insert dynamic content
            </p>
          </div>
        </AlertDescription>
      </Alert>

      {/* Context List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contexts.map(context => (
          <Card 
            key={context.id} 
            className={`cursor-pointer transition-all ${
              selectedContextId === context.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onContextSelect?.(context)}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    {context.name}
                    {context.isDefault && (
                      <Badge variant="outline" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Default
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {context.description}
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="flex justify-between items-center">
                <div className="text-xs text-muted-foreground">
                  Updated: {new Date(context.updatedAt).toLocaleDateString()}
                </div>
                
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      previewContextText(context);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      editContext(context);
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateContext(context);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  
                  {!context.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteContext(context);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Context Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContext?.id.startsWith('context_') ? 'Edit' : 'Create'} Prompt Context
            </DialogTitle>
          </DialogHeader>
          
          {editingContext && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Context Name</Label>
                  <Input
                    value={editingContext.name}
                    onChange={(e) => setEditingContext({
                      ...editingContext,
                      name: e.target.value
                    })}
                    placeholder="Enter context name"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={editingContext.description}
                    onChange={(e) => setEditingContext({
                      ...editingContext,
                      description: e.target.value
                    })}
                    placeholder="Enter description"
                  />
                </div>
              </div>

              {/* Context Templates */}
              <Tabs defaultValue="system" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="system">System Prompt</TabsTrigger>
                  <TabsTrigger value="evaluation">Evaluation Context</TabsTrigger>
                  <TabsTrigger value="variables">Variables</TabsTrigger>
                </TabsList>

                <TabsContent value="system" className="space-y-4">
                  <div>
                    <Label>System Prompt Context</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Define the AI's role and behavior. Use template variables for dynamic content.
                    </p>
                    <Textarea
                      value={editingContext.systemPromptContext}
                      onChange={(e) => setEditingContext({
                        ...editingContext,
                        systemPromptContext: e.target.value
                      })}
                      placeholder="Enter system prompt context..."
                      className="min-h-[200px] font-mono text-sm"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="evaluation" className="space-y-4">
                  <div>
                    <Label>Evaluation Context</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Define how the conversation should be analyzed and what format to use.
                    </p>
                    <Textarea
                      value={editingContext.evaluationContext}
                      onChange={(e) => setEditingContext({
                        ...editingContext,
                        evaluationContext: e.target.value
                      })}
                      placeholder="Enter evaluation context..."
                      className="min-h-[300px] font-mono text-sm"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="variables" className="space-y-4">
                  <div>
                    <Label>Available Template Variables</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Use these variables in your context templates. They will be replaced with actual values during evaluation.
                    </p>
                    <div className="space-y-2">
                      {availableVariables.map(variable => (
                        <div key={variable.key} className="flex justify-between items-center p-2 border rounded">
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {variable.key}
                          </code>
                          <span className="text-sm text-muted-foreground">
                            {variable.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditor(false)}>
                  Cancel
                </Button>
                <Button onClick={saveContext}>
                  Save Context
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {previewContext?.name}</DialogTitle>
          </DialogHeader>
          
          {previewContext && (
            <Tabs defaultValue="system" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="system">System Prompt</TabsTrigger>
                <TabsTrigger value="evaluation">Evaluation Context</TabsTrigger>
              </TabsList>

              <TabsContent value="system">
                <div className="space-y-2">
                  <Label>System Prompt Context (Raw Template)</Label>
                  <pre className="bg-muted p-4 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                    {previewContext.systemPromptContext}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="evaluation">
                <div className="space-y-2">
                  <Label>Evaluation Context (Raw Template)</Label>
                  <pre className="bg-muted p-4 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                    {previewContext.evaluationContext}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
