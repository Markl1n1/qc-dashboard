import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
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
                <Input id="signup_passcode" type="password" value={localConfig.signup_passcode || ''} onChange={e => handleConfigChange('signup_passcode', e.target.value)} placeholder="Enter signup passcode" />
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
                  {isSaving ? <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </> : <>
                      <Save className="h-4 w-4 mr-2" />
                      Save All Settings
                    </>}
                </Button>
                
                <Button variant="outline" onClick={handleResetDefaults}>
                  Reset to Defaults
                </Button>
              </div>
              
              {!hasUnsavedChanges && <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  All settings saved
                </div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instructions" className="space-y-6">
          <AIInstructionsFileManager />
        </TabsContent>
      </Tabs>
    </div>;
};
export default Settings;