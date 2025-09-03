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
    </div>
  );
};

export default Settings;