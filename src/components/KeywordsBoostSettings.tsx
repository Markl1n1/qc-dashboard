import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Zap, HelpCircle } from "lucide-react";
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

const KeywordsBoostSettings: React.FC = () => {
  const { systemConfig, updateSystemConfig, isLoading } = useEnhancedSettingsStore();
  
  const [localKeywords, setLocalKeywords] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Languages that use Nova-2 model (keywords API)
  const nova2Languages: Language[] = [
    { code: 'pl', name: 'Polish' },
    { code: 'ru', name: 'Russian' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'cs', name: 'Czech' },
    { code: 'sk', name: 'Slovak' },
    { code: 'bg', name: 'Bulgarian' },
    { code: 'hr', name: 'Croatian' },
    { code: 'ro', name: 'Romanian' },
    { code: 'hu', name: 'Hungarian' },
  ];

  useEffect(() => {
    if (systemConfig) {
      const keywords: Record<string, string> = {};
      nova2Languages.forEach(lang => {
        keywords[lang.code] = systemConfig[`keywords_boost_${lang.code}`] || '';
      });
      setLocalKeywords(keywords);
      setHasChanges(false);
    }
  }, [systemConfig]);

  const handleKeywordsChange = (langCode: string, value: string) => {
    setLocalKeywords(prev => ({
      ...prev,
      [langCode]: value
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const updates: Record<string, string> = {};
      Object.entries(localKeywords).forEach(([langCode, keywords]) => {
        updates[`keywords_boost_${langCode}`] = keywords;
      });
      
      await updateSystemConfig(updates);
      setHasChanges(false);
      toast.success('Keywords boost settings saved');
    } catch (error) {
      toast.error('Failed to save keywords boost settings');
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
          <Zap className="h-5 w-5" />
          Keywords Boost (Nova-2)
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p>Keywords boost helps Deepgram recognize specific terms better.</p>
                <p className="mt-1 text-xs">Format: <code>word:intensity</code> where intensity is -10 to 10.</p>
                <p className="mt-1 text-xs">Example: <code>Revolut:5, инвестиция:8, LLB Alpha:10</code></p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Boost recognition of specific words and terms for Nova-2 model languages.
          Higher intensity (1-10) increases recognition probability.
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/50 p-3 rounded-md text-sm">
          <strong>Format:</strong> <code>word:intensity, word:intensity</code>
          <br />
          <span className="text-muted-foreground">
            Example: <code>LLB Alpha:10, Revolut:5, консультант:8</code>
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {nova2Languages.map(language => (
            <div key={language.code} className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={`keywords-${language.code}`}>
                  {language.name} ({language.code})
                </Label>
                <Badge variant="secondary">Nova-2</Badge>
              </div>
              <Textarea
                id={`keywords-${language.code}`}
                placeholder="LLB Alpha:10, финансы:5, консультант:8"
                value={localKeywords[language.code] || ''}
                onChange={(e) => handleKeywordsChange(language.code, e.target.value)}
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
                Save Keywords
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default KeywordsBoostSettings;
