import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, MessageSquare } from "lucide-react";
import { useEnhancedSettingsStore } from "@/store/enhancedSettingsStore";
import { toast } from "sonner";

interface Language {
  code: string;
  name: string;
  prompt: string;
}

const KeytermSettings: React.FC = () => {
  const { systemConfig, updateSystemConfig, isLoading } = useEnhancedSettingsStore();
  
  const [localKeyterms, setLocalKeyterms] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const supportedLanguages: Language[] = [
    { code: 'en', name: 'English', prompt: '' },
    { code: 'ru', name: 'Russian', prompt: '' },
    { code: 'de', name: 'German', prompt: '' },
    { code: 'es', name: 'Spanish', prompt: '' },
    { code: 'fr', name: 'French', prompt: '' },
    { code: 'it', name: 'Italian', prompt: '' },
    { code: 'pt', name: 'Portuguese', prompt: '' },
    { code: 'zh', name: 'Chinese', prompt: '' },
    { code: 'ja', name: 'Japanese', prompt: '' },
    { code: 'ko', name: 'Korean', prompt: '' },
    { code: 'ar', name: 'Arabic', prompt: '' },
    { code: 'hi', name: 'Hindi', prompt: '' },
    { code: 'nl', name: 'Dutch', prompt: '' },
    { code: 'pl', name: 'Polish', prompt: '' },
    { code: 'sv', name: 'Swedish', prompt: '' },
  ];

  useEffect(() => {
    if (systemConfig) {
      const keyterms: Record<string, string> = {};
      supportedLanguages.forEach(lang => {
        keyterms[lang.code] = systemConfig[`keyterm_prompt_${lang.code}`] || '';
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
        updates[`keyterm_prompt_${langCode}`] = prompt;
      });
      
      await updateSystemConfig(updates);
      setHasChanges(false);
      toast.success('Keyterm prompts saved successfully');
    } catch (error) {
      toast.error('Failed to save keyterm prompts');
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
          <MessageSquare className="h-5 w-5" />
          Keyterm Prompts (Nova-3 Only)
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Configure keyterm prompts for Nova-3 model to improve recognition of specific terminology. 
          Keyterms are only supported by the Nova-3 model and English language.
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {supportedLanguages.map(language => (
            <div key={language.code} className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={`keyterm-${language.code}`}>
                  {language.name} ({language.code})
                </Label>
                {language.code === 'en' && (
                  <Badge variant="secondary">Nova-3 Supported</Badge>
                )}
                {language.code !== 'en' && (
                  <Badge variant="outline">Limited Support</Badge>
                )}
              </div>
              <Textarea
                id={`keyterm-${language.code}`}
                placeholder={language.code === 'en' 
                  ? "Enter important terms, company names, products (comma-separated)" 
                  : "Keyterms may have limited effectiveness for non-English languages"
                }
                value={localKeyterms[language.code] || ''}
                onChange={(e) => handleKeytermChange(language.code, e.target.value)}
                rows={3}
                className="resize-none"
                disabled={language.code !== 'en'} // Only enable for English as per Deepgram docs
              />
              <div className="text-xs text-muted-foreground">
                {language.code === 'en' 
                  ? "Best accuracy with Nova-3 model for English transcription"
                  : "Keyterm prompting is primarily supported for English with Nova-3 model"
                }
              </div>
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
                Save Keyterms
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default KeytermSettings;