import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RefreshCw, HelpCircle } from "lucide-react";
import { useEnhancedSettingsStore } from "@/store/enhancedSettingsStore";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Language {
  code: string;
  name: string;
}

const TranscriptionReplacements: React.FC = () => {
  const { systemConfig, updateSystemConfig, isLoading } = useEnhancedSettingsStore();
  
  const [localReplacements, setLocalReplacements] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // All supported languages
  const supportedLanguages: Language[] = [
    { code: 'en', name: 'English' },
    { code: 'ru', name: 'Russian' },
    { code: 'de', name: 'German' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'pl', name: 'Polish' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
  ];

  useEffect(() => {
    if (systemConfig) {
      const replacements: Record<string, string> = {};
      supportedLanguages.forEach(lang => {
        replacements[lang.code] = systemConfig[`transcription_replace_${lang.code}`] || '';
      });
      setLocalReplacements(replacements);
      setHasChanges(false);
    }
  }, [systemConfig]);

  const handleReplacementChange = (langCode: string, value: string) => {
    setLocalReplacements(prev => ({
      ...prev,
      [langCode]: value
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const updates: Record<string, string> = {};
      Object.entries(localReplacements).forEach(([langCode, replacements]) => {
        updates[`transcription_replace_${langCode}`] = replacements;
      });
      
      await updateSystemConfig(updates);
      setHasChanges(false);
      toast.success('Transcription replacements saved');
    } catch (error) {
      toast.error('Failed to save transcription replacements');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Auto-Replace (Find & Replace)
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p>Automatically replace common transcription errors with correct text.</p>
                <p className="mt-1 text-xs">Format: <code>wrong:correct</code></p>
                <p className="mt-1 text-xs">Example: <code>LLB Alfa:LLB Alpha, Ревелут:Revolut</code></p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Define automatic text replacements to fix common transcription errors.
          Deepgram will apply these corrections during transcription.
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/50 p-3 rounded-md text-sm">
          <strong>Format:</strong> <code>pattern:replacement, pattern:replacement</code>
          <br />
          <span className="text-muted-foreground">
            Example: <code>LLB Alfa:LLB Alpha, Ревелут:Revolut, revolute:Revolut</code>
          </span>
          <br />
          <span className="text-xs text-muted-foreground mt-1 block">
            Note: Patterns are case-insensitive and applied during Deepgram processing.
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {supportedLanguages.map(language => (
            <div key={language.code} className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={`replace-${language.code}`}>
                  {language.name} ({language.code})
                </Label>
              </div>
              <Textarea
                id={`replace-${language.code}`}
                placeholder="LLB Alfa:LLB Alpha, ревелут:Revolut"
                value={localReplacements[language.code] || ''}
                onChange={(e) => handleReplacementChange(language.code, e.target.value)}
                rows={3}
                className="resize-none font-mono text-sm"
              />
            </div>
          ))}
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {hasChanges && <Badge variant="outline">Unsaved changes</Badge>}
          </div>
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || isSaving}
            className="min-w-[120px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Replacements
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TranscriptionReplacements;
