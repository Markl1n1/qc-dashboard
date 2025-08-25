
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Copy, Download } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { EvaluationConfiguration } from '../types/lemurEvaluation';
import { SpeakerUtterance } from '../types';
import { lemurEvaluationService } from '../services/lemurEvaluationService';
import { ASSEMBLYAI_REGIONS, AssemblyAIRegion } from './LeMURModelSelector';

interface PromptPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  configuration: EvaluationConfiguration | null;
  utterances: SpeakerUtterance[];
  selectedModel?: string;
  selectedRegion?: AssemblyAIRegion;
}

export const PromptPreviewDialog: React.FC<PromptPreviewDialogProps> = ({
  isOpen,
  onClose,
  configuration,
  utterances,
  selectedModel,
  selectedRegion = 'US'
}) => {
  const { toast } = useToast();

  if (!configuration) {
    return null;
  }

  // Get the unified prompt template that matches what's actually sent
  const promptTemplate = lemurEvaluationService.getCustomEvaluationPromptTemplate(configuration);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(promptTemplate);
    toast({
      title: "Copied",
      description: "Prompt template copied to clipboard"
    });
  };

  const handleDownloadPrompt = () => {
    const blob = new Blob([promptTemplate], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${configuration.name.replace(/\s+/g, '_')}_prompt_template.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "Prompt template downloaded successfully"
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <div>
              <DialogTitle>Prompt Preview - {configuration.name}</DialogTitle>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">
                  Model: {selectedModel || 'claude_sonnet_4_20250514'}
                </Badge>
                <Badge variant="outline">
                  Region: {ASSEMBLYAI_REGIONS[selectedRegion].name}
                </Badge>
                <Badge variant="outline">
                  Rules: {configuration.rules.length}
                </Badge>
                <Badge variant="outline">
                  Categories: {configuration.categories.filter(c => c.enabled).length}
                </Badge>
                <Badge variant="secondary">
                  Unified Format
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyPrompt}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPrompt}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] w-full">
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-xs text-muted-foreground mb-2">
              ✅ This preview shows the exact prompt format that will be sent to the LeMUR API
            </div>
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {promptTemplate}
            </pre>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
