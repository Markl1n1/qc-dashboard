import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Settings as SettingsIcon, 
  Save, 
  Trash2, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Database,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';
import { useUserRole } from '../hooks/useUserRole';
import { supabase } from '../integrations/supabase/client';
import { databaseService } from '../services/databaseService';
import ApiKeyManager from '../components/ApiKeyManager';
import CategoryManager from '../components/CategoryManager';
import EvaluationConfigurationManager from '../components/EvaluationConfigurationManager';
import LanguageAwareRuleManager from '../components/LanguageAwareRuleManager';
import AIInstructionsManager from '../components/AIInstructionsManager';

const Settings = () => {
  const { user } = useAuthStore();
  const { isAdmin } = useUserRole();
  const [isLoading, setIsLoading] = useState(false);

  // Data Retention Settings
  const [dataRetentionDays, setDataRetentionDays] = useState('30');
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(false);
  const [isUpdatingRetention, setIsUpdatingRetention] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadSystemConfig();
    }
  }, [isAdmin]);

  const loadSystemConfig = async () => {
    try {
      setIsLoading(true);
      const config = await databaseService.getAllSystemConfig();
      
      setDataRetentionDays(config.data_retention_days || '30');
      setAutoDeleteEnabled(config.auto_delete_enabled === 'true');
    } catch (error) {
      console.error('Error loading system config:', error);
      toast.error('Failed to load system configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const saveDataRetentionSettings = async () => {
    try {
      setIsLoading(true);
      
      await databaseService.updateSystemConfig('data_retention_days', dataRetentionDays);
      await databaseService.updateSystemConfig('auto_delete_enabled', autoDeleteEnabled.toString());
      
      toast.success('Data retention settings saved successfully');
    } catch (error) {
      console.error('Error saving data retention settings:', error);
      toast.error('Failed to save data retention settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateExpirationDates = async () => {
    try {
      setIsUpdatingRetention(true);
      const updatedCount = await databaseService.updateDialogExpirationDates();
      toast.success(`Updated expiration dates for ${updatedCount} dialogs`);
    } catch (error) {
      console.error('Error updating expiration dates:', error);
      toast.error('Failed to update expiration dates');
    } finally {
      setIsUpdatingRetention(false);
    }
  };

  const handleCleanupExpiredData = async () => {
    try {
      setIsCleaningUp(true);
      const deletedCount = await databaseService.cleanupExpiredDialogs();
      toast.success(`Cleaned up ${deletedCount} expired dialogs`);
    } catch (error) {
      console.error('Error cleaning up expired data:', error);
      toast.error('Failed to cleanup expired data');
    } finally {
      setIsCleaningUp(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
              <p className="text-muted-foreground">
                You need admin privileges to access the settings page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Admin Settings</h1>
            <p className="text-muted-foreground">
              Configure system settings and manage application behavior
            </p>
          </div>
        </div>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>API Configuration</CardTitle>
            <CardDescription>
              Manage API keys for external services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiKeyManager />
          </CardContent>
        </Card>

        {/* AI Analysis Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>AI Analysis Configuration</CardTitle>
            <CardDescription>
              Configure AI evaluation parameters and thresholds
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EvaluationConfigurationManager />
          </CardContent>
        </Card>

        {/* AI Instructions Management */}
        <Card>
          <CardHeader>
            <CardTitle>AI Instructions Management</CardTitle>
            <CardDescription>
              Manage AI system instructions and prompts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AIInstructionsManager />
          </CardContent>
        </Card>

        {/* Evaluation Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Evaluation Categories</CardTitle>
            <CardDescription>
              Manage categories used for dialog evaluation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryManager />
          </CardContent>
        </Card>

        {/* Language-Aware Rules */}
        <Card>
          <CardHeader>
            <CardTitle>Language-Aware Evaluation Rules</CardTitle>
            <CardDescription>
              Configure language-specific evaluation rules and banned words
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageAwareRuleManager />
          </CardContent>
        </Card>

        {/* Data Retention & Storage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Retention & Storage
            </CardTitle>
            <CardDescription>
              Configure data retention policies and manage storage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="retention-days">Data Retention (Days)</Label>
                <Input
                  id="retention-days"
                  type="number"
                  value={dataRetentionDays}
                  onChange={(e) => setDataRetentionDays(e.target.value)}
                  min="1"
                  max="365"
                  className="w-32"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Number of days to keep dialog data before expiration
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-delete"
                  checked={autoDeleteEnabled}
                  onCheckedChange={setAutoDeleteEnabled}
                />
                <Label htmlFor="auto-delete">Enable Automatic Cleanup</Label>
              </div>

              <Button 
                onClick={saveDataRetentionSettings} 
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Retention Settings
              </Button>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Data Management Actions</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={handleUpdateExpirationDates}
                      disabled={isUpdatingRetention}
                      className="flex items-center gap-2"
                    >
                      {isUpdatingRetention ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Update Expiration Dates
                      <HelpCircle className="h-4 w-4 ml-1" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Updates expiration dates for all existing dialogs based on current retention policy</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      onClick={handleCleanupExpiredData}
                      disabled={isCleaningUp}
                      className="flex items-center gap-2"
                    >
                      {isCleaningUp ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Cleanup Expired Data
                      <HelpCircle className="h-4 w-4 ml-1" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Manually deletes dialogs that have passed their expiration date</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Indicator */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Settings page loaded successfully
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default Settings;
