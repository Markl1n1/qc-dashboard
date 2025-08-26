import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Switch } from '../components/ui/switch';
import { 
  Settings as SettingsIcon, 
  Save, 
  Upload, 
  Key, 
  Brain,
  Users,
  Shield,
  FileText,
  Code,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useEnhancedSettingsStore } from '../store/enhancedSettingsStore';
import { useUserRole } from '../hooks/useUserRole';
import { supabase } from '../integrations/supabase/client';
import AIInstructionsManager from '../components/AIInstructionsManager';
import OpenAIRequestDemo from '../components/OpenAIRequestDemo';

interface SettingsProps {}

const Settings = () => {
  const { isAdmin, isSupervisor } = useUserRole();
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
      setLocalConfig({ ...systemConfig });
      setHasUnsavedChanges(false);
    }
  }, [systemConfig]);

  const handleConfigChange = (key: string, value: string) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await updateSystemConfig(localConfig);
      setHasUnsavedChanges(false);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    try {
      await resetToDefaults();
      toast.success('Settings reset to defaults');
    } catch (error) {
      console.error('Error resetting settings:', error);
      toast.error('Failed to reset settings');
    }
  };

  if (!isAdmin && !isSupervisor) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access settings. Only administrators and supervisors can modify system settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            System Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure system parameters and AI analysis settings
          </p>
        </div>
        
        {hasUnsavedChanges && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              Unsaved Changes
            </Badge>
            <Button onClick={handleSaveConfig} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="ai-analysis" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
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
          <TabsTrigger value="demo" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            API Demo
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
                  <Label htmlFor="ai_confidence_threshold">Confidence Threshold</Label>
                  <Input
                    id="ai_confidence_threshold"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={localConfig.ai_confidence_threshold || '0.8'}
                    onChange={(e) => handleConfigChange('ai_confidence_threshold', e.target.value)}
                    placeholder="0.8"
                  />
                  <p className="text-sm text-muted-foreground">
                    Minimum confidence threshold (0-1). Below this, system will retry with GPT-5 flagship.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai_reasoning_effort">Reasoning Effort</Label>
                  <Select
                    value={localConfig.ai_reasoning_effort || 'medium'}
                    onValueChange={(value) => handleConfigChange('ai_reasoning_effort', value)}
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
                    Reasoning effort level for newer OpenAI models.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai_max_tokens_gpt5_mini">Max Tokens (GPT-5 Mini)</Label>
                  <Input
                    id="ai_max_tokens_gpt5_mini"
                    type="number"
                    min="100"
                    max="4000"
                    value={localConfig.ai_max_tokens_gpt5_mini || '1000'}
                    onChange={(e) => handleConfigChange('ai_max_tokens_gpt5_mini', e.target.value)}
                    placeholder="1000"
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum completion tokens for GPT-5 Mini model.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai_max_tokens_gpt5">Max Tokens (GPT-5)</Label>
                  <Input
                    id="ai_max_tokens_gpt5"
                    type="number"
                    min="100"
                    max="8000"
                    value={localConfig.ai_max_tokens_gpt5 || '2000'}
                    onChange={(e) => handleConfigChange('ai_max_tokens_gpt5', e.target.value)}
                    placeholder="2000"
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum completion tokens for GPT-5 flagship model.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai_temperature">Temperature (Legacy Models)</Label>
                  <Input
                    id="ai_temperature"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={localConfig.ai_temperature || '0.7'}
                    onChange={(e) => handleConfigChange('ai_temperature', e.target.value)}
                    placeholder="0.7"
                  />
                  <p className="text-sm text-muted-foreground">
                    Temperature for legacy models (GPT-4o family). Not used with GPT-5 models.
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
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup_passcode">Signup Passcode</Label>
                <Input
                  id="signup_passcode"
                  type="password"
                  value={localConfig.signup_passcode || ''}
                  onChange={(e) => handleConfigChange('signup_passcode', e.target.value)}
                  placeholder="Enter signup passcode"
                />
                <p className="text-sm text-muted-foreground">
                  Required passcode for new user registration.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleSaveConfig} disabled={isSaving || !hasUnsavedChanges}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save All Settings
                    </>
                  )}
                </Button>
                
                <Button variant="outline" onClick={handleResetDefaults}>
                  Reset to Defaults
                </Button>
              </div>
              
              {!hasUnsavedChanges && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  All settings saved
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instructions" className="space-y-6">
          <AIInstructionsManager />
        </TabsContent>

        <TabsContent value="demo" className="space-y-6">
          <OpenAIRequestDemo />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
