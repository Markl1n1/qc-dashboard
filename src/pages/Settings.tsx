import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, FileText, Shield, Brain, Save, Loader2, Settings as SettingsIcon } from "lucide-react";
import AIInstructionsFileManager from "@/components/AIInstructionsFileManager";
import { useEnhancedSettingsStore } from "@/store/enhancedSettingsStore";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const Settings: React.FC = () => {
  const { role, isLoading: roleLoading } = useUserRole();
  const {
    systemConfig,
    isLoading,
    error,
    loadSystemConfig,
    updateSystemConfig,
    resetToDefaults,
  } = useEnhancedSettingsStore();

  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSystemConfig();
  }, [loadSystemConfig]);

  useEffect(() => {
    if (systemConfig) {
      setLocalConfig(systemConfig);
      setHasUnsavedChanges(false);
    }
  }, [systemConfig]);

  const handleConfigChange = (key: string, value: string) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSaveConfig = async () => {
    try {
      setIsSaving(true);
      await updateSystemConfig(localConfig);
      setHasUnsavedChanges(false);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    try {
      setIsSaving(true);
      await resetToDefaults();
      setHasUnsavedChanges(false);
      toast.success('Settings reset to defaults');
    } catch (error) {
      toast.error('Failed to reset settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (roleLoading || isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (role !== 'admin' && role !== 'supervisor') {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Access denied. Only administrators and supervisors can access settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        {hasUnsavedChanges && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">Unsaved changes</Badge>
            <Button variant="outline" onClick={handleResetDefaults} disabled={isSaving}>
              Reset to Defaults
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ai">AI Analysis</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="instructions">AI Instructions</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="ai_confidence_threshold">AI Confidence Threshold</Label>
                  <div className="space-y-3">
                    <Slider
                      id="ai_confidence_threshold"
                      min={0}
                      max={1}
                      step={0.1}
                      value={[parseFloat(localConfig.ai_confidence_threshold || '0.8')]}
                      onValueChange={([value]) => handleConfigChange('ai_confidence_threshold', value.toString())}
                      className="w-full"
                    />
                    <div className="text-center text-sm text-muted-foreground">
                      {(parseFloat(localConfig.ai_confidence_threshold || '0.8') * 100).toFixed(0)}%
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Minimum confidence level required for AI analysis results.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai_reasoning_effort">AI Reasoning Effort</Label>
                  <Select
                    value={localConfig.ai_reasoning_effort || 'medium'}
                    onValueChange={value => handleConfigChange('ai_reasoning_effort', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reasoning effort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - Fast responses</SelectItem>
                      <SelectItem value="medium">Medium - Balanced performance</SelectItem>
                      <SelectItem value="high">High - Deep analysis</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Higher effort provides more detailed analysis but takes longer.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai_max_tokens_gpt5">Max Tokens (GPT-5)</Label>
                  <Input
                    id="ai_max_tokens_gpt5"
                    type="number"
                    min="100"
                    max="10000"
                    step="100"
                    value={localConfig.ai_max_tokens_gpt5 || '2000'}
                    onChange={e => handleConfigChange('ai_max_tokens_gpt5', e.target.value)}
                    placeholder="2000"
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum number of tokens for GPT-5 AI responses.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai_max_tokens_gpt5_mini">Max Tokens (GPT-5 Mini)</Label>
                  <Input
                    id="ai_max_tokens_gpt5_mini"
                    type="number"
                    min="100"
                    max="10000"
                    step="100"
                    value={localConfig.ai_max_tokens_gpt5_mini || '1000'}
                    onChange={e => handleConfigChange('ai_max_tokens_gpt5_mini', e.target.value)}
                    placeholder="1000"
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum number of tokens for GPT-5 Mini AI responses.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Access Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="signup_passcode">Signup Passcode</Label>
                  <Input 
                    id="signup_passcode" 
                    type="password" 
                    value={localConfig.signup_passcode || ''} 
                    onChange={e => handleConfigChange('signup_passcode', e.target.value)} 
                    placeholder="Enter signup passcode" 
                  />
                  <p className="text-sm text-muted-foreground">
                    Required passcode for new user registration.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_concurrent_transcriptions">Max Concurrent Transcriptions</Label>
                  <Input
                    id="max_concurrent_transcriptions"
                    type="number"
                    min="1"
                    max="50"
                    value={localConfig.max_concurrent_transcriptions || '5'}
                    onChange={e => handleConfigChange('max_concurrent_transcriptions', e.target.value)}
                    placeholder="5"
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum number of simultaneous transcription processes.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_file_size_mb">Max Audio Size (MB)</Label>
                  <Input
                    id="max_file_size_mb"
                    type="number"
                    min="1"
                    max="1000"
                    value={localConfig.max_file_size_mb || '100'}
                    onChange={e => handleConfigChange('max_file_size_mb', e.target.value)}
                    placeholder="100"
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum audio file size allowed for upload.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data_retention_days">Dialog Retention (days)</Label>
                  <Input
                    id="data_retention_days"
                    type="number"
                    min="1"
                    max="365"
                    value={localConfig.data_retention_days || '30'}
                    onChange={e => handleConfigChange('data_retention_days', e.target.value)}
                    placeholder="30"
                  />
                  <p className="text-sm text-muted-foreground">
                    Number of days to keep dialogs before automatic deletion.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto_delete_enabled">Dialog Rotation</Label>
                    <Switch
                      id="auto_delete_enabled"
                      checked={localConfig.auto_delete_enabled === 'true'}
                      onCheckedChange={checked => handleConfigChange('auto_delete_enabled', checked.toString())}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enable automatic deletion of expired dialogs.
                  </p>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <Button onClick={handleSaveConfig} disabled={isSaving || !hasUnsavedChanges}>
                  {isSaving ? <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </> : <>
                      <Save className="h-4 w-4 mr-2" />
                      Save All Settings
                    </>}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Deepgram Models
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DeepgramModelSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instructions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                AI Instructions Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AIInstructionsFileManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// New component for Deepgram model settings
interface Language {
  code: string;
  name: string;
}

const DeepgramModelSettings = () => {
  const { 
    deepgramNova2Languages, 
    deepgramNova3Languages, 
    updateDeepgramLanguages,
    isLoading,
    error 
  } = useEnhancedSettingsStore();

  const [localNova2, setLocalNova2] = useState<string[]>([]);
  const [localNova3, setLocalNova3] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const availableLanguages: Language[] = [
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
    { code: 'hi', name: 'Hindi' },
    { code: 'nl', name: 'Dutch' },
    { code: 'pl', name: 'Polish' },
    { code: 'sv', name: 'Swedish' },
  ];

  useEffect(() => {
    setLocalNova2(deepgramNova2Languages || []);
    setLocalNova3(deepgramNova3Languages || []);
  }, [deepgramNova2Languages, deepgramNova3Languages]);

  const handleLanguageToggle = (languageCode: string, model: 'nova-2' | 'nova-3') => {
    if (model === 'nova-2') {
      if (localNova2.includes(languageCode)) {
        setLocalNova2(localNova2.filter(lang => lang !== languageCode));
      } else {
        setLocalNova2([...localNova2, languageCode]);
        setLocalNova3(localNova3.filter(lang => lang !== languageCode));
      }
    } else {
      if (localNova3.includes(languageCode)) {
        setLocalNova3(localNova3.filter(lang => lang !== languageCode));
      } else {
        setLocalNova3([...localNova3, languageCode]);
        setLocalNova2(localNova2.filter(lang => lang !== languageCode));
      }
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateDeepgramLanguages(localNova2, localNova3);
      toast.success('Deepgram language assignments updated successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update language assignments');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = JSON.stringify(localNova2.sort()) !== JSON.stringify((deepgramNova2Languages || []).sort()) ||
                     JSON.stringify(localNova3.sort()) !== JSON.stringify((deepgramNova3Languages || []).sort());

  if (isLoading) {
    return <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Assign languages to Deepgram models. Each language can only be assigned to one model.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">Nova-2 Languages</h4>
            <Badge variant="secondary">{localNova2.length}</Badge>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
            {availableLanguages.map(language => (
              <div key={`nova2-${language.code}`} className="flex items-center space-x-2">
                <Checkbox
                  id={`nova2-${language.code}`}
                  checked={localNova2.includes(language.code)}
                  onCheckedChange={() => handleLanguageToggle(language.code, 'nova-2')}
                />
                <Label htmlFor={`nova2-${language.code}`} className="text-sm">
                  {language.name} ({language.code})
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">Nova-3 Languages</h4>
            <Badge variant="secondary">{localNova3.length}</Badge>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
            {availableLanguages.map(language => (
              <div key={`nova3-${language.code}`} className="flex items-center space-x-2">
                <Checkbox
                  id={`nova3-${language.code}`}
                  checked={localNova3.includes(language.code)}
                  onCheckedChange={() => handleLanguageToggle(language.code, 'nova-3')}
                />
                <Label htmlFor={`nova3-${language.code}`} className="text-sm">
                  {language.name} ({language.code})
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Language Assignments
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Settings;