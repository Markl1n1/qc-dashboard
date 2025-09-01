import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Switch } from '../components/ui/switch';
import { Settings as SettingsIcon, Save, Brain, Shield, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEnhancedSettingsStore } from '../store/enhancedSettingsStore';
import { useUserRole } from '../hooks/useUserRole';
import AIInstructionsFileManager from '../components/AIInstructionsFileManager';
import { logger } from '../services/loggingService';
interface SettingsProps {}
const Settings = () => {
  const {
    isAdmin,
    isSupervisor
  } = useUserRole();
  const {
    systemConfig,
    isLoading,
    loadSystemConfig,
    updateSystemConfig,
    resetToDefaults
  } = useEnhancedSettingsStore();
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  useEffect(() => {
    loadSystemConfig();
  }, [loadSystemConfig]);
  useEffect(() => {
    if (systemConfig) {
      setLocalConfig({
        ...systemConfig
      });
      setHasUnsavedChanges(false);
    }
  }, [systemConfig]);
  const handleConfigChange = (key: string, value: string): void => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: value
    }));
    setHasUnsavedChanges(true);
  };
  const handleSaveConfig = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await updateSystemConfig(localConfig);
      setHasUnsavedChanges(false);
      toast.success('Settings saved successfully');
      logger.info('System settings updated successfully');
    } catch (error) {
      logger.error('Failed to save settings', error as Error, {
        configKeys: Object.keys(localConfig)
      });
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };
  const handleResetDefaults = async (): Promise<void> => {
    try {
      await resetToDefaults();
      toast.success('Settings reset to defaults');
      logger.info('System settings reset to defaults');
    } catch (error) {
      logger.error('Failed to reset settings', error as Error);
      toast.error('Failed to reset settings');
    }
  };
  if (!isAdmin && !isSupervisor) {
    return <div className="container mx-auto px-4 py-8">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access settings. Only administrators and supervisors can modify system settings.
          </AlertDescription>
        </Alert>
      </div>;
  }
  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </div>;
  }
  return <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            System Settings
          </h1>
        </div>
        
        {hasUnsavedChanges && <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              Unsaved Changes
            </Badge>
            <Button onClick={handleSaveConfig} disabled={isSaving}>
              {isSaving ? <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </> : <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>}
            </Button>
          </div>}
      </div>

      <Tabs defaultValue="ai-analysis" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ai-analysis" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Analysis
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            System
          </TabsTrigger>
          <TabsTrigger value="instructions" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            AI Instructions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai-analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Analysis Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="ai_confidence_threshold">AI Confidence Threshold</Label>
                  <Input
                    id="ai_confidence_threshold"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={localConfig.ai_confidence_threshold || '0.8'}
                    onChange={e => handleConfigChange('ai_confidence_threshold', e.target.value)}
                    placeholder="0.8"
                  />
                  <p className="text-sm text-muted-foreground">
                    Minimum confidence threshold for AI analysis (0.0 - 1.0).
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
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Level of reasoning effort for AI analysis.
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
    </div>;
};
export default Settings;