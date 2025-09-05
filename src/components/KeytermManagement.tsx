import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Plus, X, Tags } from "lucide-react";
import { useEnhancedSettingsStore } from "@/store/enhancedSettingsStore";
import { toast } from "sonner";

interface Language {
  code: string;
  name: string;
  prompt?: string;
}

const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Russian' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'pl', name: 'Polish' },
];

const KeytermManagement: React.FC = () => {
  const { 
    systemConfig, 
    isLoading, 
    updateSystemConfig 
  } = useEnhancedSettingsStore();

  const [localKeyterms, setLocalKeyterms] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (systemConfig) {
      const keyterms: Record<string, string> = {};
      SUPPORTED_LANGUAGES.forEach(lang => {
        const key = `keyterm_prompt_${lang.code}`;
        keyterms[lang.code] = systemConfig[key] || '';
      });
      setLocalKeyterms(keyterms);
      setHasChanges(false);
    }
  }, [systemConfig]);

  const handleKeytermChange = (langCode: string, value: string) => {
    setLocalKeyterms(prev => ({
      ...prev,
      [langCode]: value
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Prepare updates for all keyterm prompts
      const updates: Record<string, string> = {};
      Object.entries(localKeyterms).forEach(([langCode, prompt]) => {
        updates[`keyterm_prompt_${langCode}`] = prompt.trim();
      });

      await updateSystemConfig(updates);
      setHasChanges(false);
      toast.success('Keyterm prompts saved successfully');
    } catch (error) {
      console.error('Error saving keyterm prompts:', error);
      toast.error('Failed to save keyterm prompts');
    } finally {
      setIsSaving(false);
    }
  };

  const getKeytermCount = (prompt: string): number => {
    return prompt ? prompt.split(',').filter(term => term.trim()).length : 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tags className="h-5 w-5" />
          Keyterm Management
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure keyterm prompts for each language. Nova-3 model uses keyterms to improve transcription accuracy for domain-specific terms.
          Separate keyterms with commas.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6">
          {SUPPORTED_LANGUAGES.map(lang => (
            <div key={lang.code} className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  {lang.name} ({lang.code.toUpperCase()}) Keyterms
                </Label>
                <Badge variant="outline" className="text-xs">
                  {getKeytermCount(localKeyterms[lang.code] || '')} terms
                </Badge>
              </div>
              <Textarea
                placeholder={`Enter keyterms for ${lang.name} (comma-separated)`}
                value={localKeyterms[lang.code] || ''}
                onChange={(e) => handleKeytermChange(lang.code, e.target.value)}
                className="min-h-[80px] resize-y"
                rows={3}
              />
              <div className="text-xs text-muted-foreground">
                Example: VoiceQC, transcription, diarization, audio analysis, quality control
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t">
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || isSaving}
            className="w-full"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving Keyterms...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save All Keyterm Prompts
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default KeytermManagement;