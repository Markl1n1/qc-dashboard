import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, FileText, Shield, Brain, Save, Loader2, Settings as SettingsIcon, Mic, Database, Trash2 } from "lucide-react";
import AIInstructionsFileManager from "@/components/AIInstructionsFileManager";
import DeepgramModelSettings from "@/components/DeepgramModelSettings";
import KeytermManagement from "@/components/KeytermManagement";
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
    cleanupExpiredDialogs,
    updateDialogExpirationDates,
  } = useEnhancedSettingsStore();

  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

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

  const handleCleanupExpiredDialogs = async () => {
    try {
      setIsCleaningUp(true);
      const deletedCount = await cleanupExpiredDialogs();
      toast.success(`Cleaned up ${deletedCount} expired dialogs`);
    } catch (error) {
      toast.error('Failed to cleanup expired dialogs');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleUpdateExpirationDates = async () => {
    try {
      const updatedCount = await updateDialogExpirationDates();
      toast.success(`Updated expiration dates for ${updatedCount} dialogs`);
    } catch (error) {
      toast.error('Failed to update expiration dates');
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        {hasUnsavedChanges && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">Unsaved changes</Badge>
          </div>
        )}
      </div>

      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai">AI Analysis</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="deepgram">Deepgram</TabsTrigger>
          <TabsTrigger value="instructions">AI Instructions</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-6">
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
                  <Label htmlFor="ai_reasoning_effort">AI Reasoning Effort</Label>
                  <Select 
                    value={localConfig.ai_reasoning_effort || 'low'} 
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
                </div>

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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai_max_tokens_gpt5">AI Max Tokens GPT-5</Label>
                  <Input
                    id="ai_max_tokens_gpt5"
                    type="number"
                    min="1000"
                    max="20000"
                    step="1000"
                    value={localConfig.ai_max_tokens_gpt5 || '12000'}
                    onChange={(e) => handleConfigChange('ai_max_tokens_gpt5', e.target.value)}
                    placeholder="12000"
                  />
                  <div className="text-xs text-muted-foreground">
                    Range: 1,000 - 20,000 tokens
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai_max_tokens_gpt5_mini">AI Max Tokens GPT-5 Mini</Label>
                  <Input
                    id="ai_max_tokens_gpt5_mini"
                    type="number"
                    min="1000"
                    max="12000"
                    step="1000"
                    value={localConfig.ai_max_tokens_gpt5_mini || '8000'}
                    onChange={(e) => handleConfigChange('ai_max_tokens_gpt5_mini', e.target.value)}
                    placeholder="8000"
                  />
                  <div className="text-xs text-muted-foreground">
                    Range: 1,000 - 12,000 tokens
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                System Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="max_file_size_mb">Max File Size (MB)</Label>
                  <Input
                    id="max_file_size_mb"
                    type="number"
                    min="1"
                    max="1000"
                    value={localConfig.max_file_size_mb || '200'}
                    onChange={(e) => handleConfigChange('max_file_size_mb', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_concurrent_transcriptions">Max Concurrent Transcriptions</Label>
                  <Input
                    id="max_concurrent_transcriptions"
                    type="number"
                    min="1"
                    max="50"
                    value={localConfig.max_concurrent_transcriptions || '20'}
                    onChange={(e) => handleConfigChange('max_concurrent_transcriptions', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data_retention_days">Data Retention Days</Label>
                  <div className="space-y-3">
                    <Slider
                      id="data_retention_days"
                      min={1}
                      max={365}
                      step={1}
                      value={[parseInt(localConfig.data_retention_days || '30')]}
                      onValueChange={([value]) => handleConfigChange('data_retention_days', value.toString())}
                      className="w-full"
                    />
                    <div className="text-center text-sm text-muted-foreground">
                      {parseInt(localConfig.data_retention_days || '30')} days
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto_delete_enabled"
                    checked={localConfig.auto_delete_enabled === 'true'}
                    onCheckedChange={(checked) => handleConfigChange('auto_delete_enabled', checked.toString())}
                  />
                  <Label htmlFor="auto_delete_enabled">Auto Delete Expired Dialogs</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup_passcode">Signup Passcode</Label>
                  <Input
                    id="signup_passcode"
                    type="password"
                    value={localConfig.signup_passcode || ''}
                    onChange={(e) => handleConfigChange('signup_passcode', e.target.value)}
                    placeholder="Enter signup passcode"
                  />
                </div>
              </div>

              <div className="pt-4 border-t space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Data Management
                </h4>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    onClick={handleCleanupExpiredDialogs} 
                    disabled={isCleaningUp}
                    variant="outline"
                    size="sm"
                  >
                    {isCleaningUp ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Cleaning...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Cleanup Expired Dialogs
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={handleUpdateExpirationDates} 
                    variant="outline"
                    size="sm"
                  >
                    Update Expiration Dates
                  </Button>
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

          <TabsContent value="deepgram" className="space-y-6">
            <DeepgramModelSettings />
            <KeytermManagement />
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

export default Settings;