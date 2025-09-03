import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save, Loader2 } from "lucide-react";
import { useEnhancedSettingsStore } from "@/store/enhancedSettingsStore";
import { toast } from "sonner";

const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'hi', name: 'Hindi' },
];

const DeepgramModelSettings: React.FC = () => {
  const { 
    systemConfig, 
    isLoading, 
    updateDeepgramLanguages 
  } = useEnhancedSettingsStore();

  const [nova2Languages, setNova2Languages] = useState<string[]>([]);
  const [nova3Languages, setNova3Languages] = useState<string[]>([]);
  const [selectedLang, setSelectedLang] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (systemConfig) {
      const nova2 = systemConfig.deepgram_nova2_languages ? 
        JSON.parse(systemConfig.deepgram_nova2_languages) : ['en'];
      const nova3 = systemConfig.deepgram_nova3_languages ? 
        JSON.parse(systemConfig.deepgram_nova3_languages) : ['es','fr','de','it','pt','ru','zh','ja','ko','ar'];
      
      setNova2Languages(nova2);
      setNova3Languages(nova3);
      setHasChanges(false);
    }
  }, [systemConfig]);

  const getAvailableLanguages = () => {
    const usedLanguages = [...nova2Languages, ...nova3Languages];
    return AVAILABLE_LANGUAGES.filter(lang => !usedLanguages.includes(lang.code));
  };

  const getLanguageName = (code: string) => {
    return AVAILABLE_LANGUAGES.find(lang => lang.code === code)?.name || code;
  };

  const addToNova2 = () => {
    if (selectedLang && !nova2Languages.includes(selectedLang)) {
      setNova2Languages([...nova2Languages, selectedLang]);
      setNova3Languages(nova3Languages.filter(lang => lang !== selectedLang));
      setSelectedLang('');
      setHasChanges(true);
    }
  };

  const addToNova3 = () => {
    if (selectedLang && !nova3Languages.includes(selectedLang)) {
      setNova3Languages([...nova3Languages, selectedLang]);
      setNova2Languages(nova2Languages.filter(lang => lang !== selectedLang));
      setSelectedLang('');
      setHasChanges(true);
    }
  };

  const removeFromNova2 = (langCode: string) => {
    setNova2Languages(nova2Languages.filter(lang => lang !== langCode));
    setHasChanges(true);
  };

  const removeFromNova3 = (langCode: string) => {
    setNova3Languages(nova3Languages.filter(lang => lang !== langCode));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateDeepgramLanguages(nova2Languages, nova3Languages);
      setHasChanges(false);
      toast.success('Deepgram model settings saved successfully');
    } catch (error) {
      toast.error('Failed to save Deepgram model settings');
    } finally {
      setIsSaving(false);
    }
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
        <CardTitle>Deepgram Model Assignment</CardTitle>
        <p className="text-sm text-muted-foreground">
          Assign languages to Nova-2 or Nova-3 models. Nova-3 supports keyterm prompts for improved accuracy.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nova-2 Languages */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Nova-2 Model Languages</Label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {nova2Languages.map(langCode => (
                  <Badge key={langCode} variant="secondary" className="flex items-center gap-1">
                    {getLanguageName(langCode)}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeFromNova2(langCode)}
                    />
                  </Badge>
                ))}
                {nova2Languages.length === 0 && (
                  <span className="text-sm text-muted-foreground">No languages assigned</span>
                )}
              </div>
              <div className="flex gap-2">
                <Select value={selectedLang} onValueChange={setSelectedLang}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableLanguages().map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={addToNova2} 
                  disabled={!selectedLang}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Nova-3 Languages */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Nova-3 Model Languages</Label>
            <p className="text-xs text-muted-foreground">Supports keyterm prompts</p>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {nova3Languages.map(langCode => (
                  <Badge key={langCode} variant="default" className="flex items-center gap-1">
                    {getLanguageName(langCode)}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeFromNova3(langCode)}
                    />
                  </Badge>
                ))}
                {nova3Languages.length === 0 && (
                  <span className="text-sm text-muted-foreground">No languages assigned</span>
                )}
              </div>
              <div className="flex gap-2">
                <Select value={selectedLang} onValueChange={setSelectedLang}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableLanguages().map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={addToNova3} 
                  disabled={!selectedLang}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
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
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Model Assignment
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeepgramModelSettings;