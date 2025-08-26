
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Settings as SettingsIcon, 
  Save, 
  Trash2, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Database,
  HelpCircle,
  Cpu,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';
import { useUserRole } from '../hooks/useUserRole';
import { databaseService } from '../services/databaseService';
import AIInstructionsManager from '../components/AIInstructionsManager';
import { useEnhancedSettingsStore } from '../store/enhancedSettingsStore';

const Settings = () => {
  const { user } = useAuthStore();
  const { isAdmin } = useUserRole();
  const [isLoading, setIsLoading] = useState(false);

  // Enhanced settings store for GPT parameters
  const {
    maxTokens,
    dataRetentionDays,
    maxFileSizeMb,
    maxConcurrentTranscriptions,
    autoDeleteEnabled,
    isLoading: storeLoading,
    error: storeError,
    loadSettings,
    updateMaxTokens,
    updateDataRetentionDays,
    updateMaxFileSizeMb,
    updateMaxConcurrentTranscriptions,
    updateAutoDeleteEnabled,
    cleanupExpiredDialogs,
    updateDialogExpirationDates
  } = useEnhancedSettingsStore();

  // Local state for form inputs
  const [localMaxTokens, setLocalMaxTokens] = useState<number>(maxTokens);
  const [localDataRetentionDays, setLocalDataRetentionDays] = useState<number>(dataRetentionDays);
  const [localMaxFileSizeMb, setLocalMaxFileSizeMb] = useState<number>(maxFileSizeMb);
  const [localMaxConcurrentTranscriptions, setLocalMaxConcurrentTranscriptions] = useState<number>(maxConcurrentTranscriptions);
  const [localAutoDeleteEnabled, setLocalAutoDeleteEnabled] = useState<boolean>(autoDeleteEnabled);
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isUpdatingExpirations, setIsUpdatingExpirations] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadSettings();
    }
  }, [isAdmin, loadSettings]);

  useEffect(() => {
    setLocalMaxTokens(maxTokens);
    setLocalDataRetentionDays(dataRetentionDays);
    setLocalMaxFileSizeMb(maxFileSizeMb);
    setLocalMaxConcurrentTranscriptions(maxConcurrentTranscriptions);
    setLocalAutoDeleteEnabled(autoDeleteEnabled);
  }, [maxTokens, dataRetentionDays, maxFileSizeMb, maxConcurrentTranscriptions, autoDeleteEnabled]);

  const handleUpdateAllSettings = async () => {
    setIsUpdating(true);
    try {
      await Promise.all([
        updateMaxTokens(localMaxTokens),
        updateDataRetentionDays(localDataRetentionDays),
        updateMaxFileSizeMb(localMaxFileSizeMb),
        updateMaxConcurrentTranscriptions(localMaxConcurrentTranscriptions),
        updateAutoDeleteEnabled(localAutoDeleteEnabled)
      ]);
      
      toast.success('All settings updated successfully');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateExpirationDates = async () => {
    try {
      setIsUpdatingExpirations(true);
      const updatedCount = await updateDialogExpirationDates();
      toast.success(`Updated expiration dates for ${updatedCount} dialogs`);
    } catch (error) {
      console.error('Error updating expiration dates:', error);
      toast.error('Failed to update expiration dates');
    } finally {
      setIsUpdatingExpirations(false);
    }
  };

  const handleCleanupExpiredData = async () => {
    try {
      setIsCleaning(true);
      const deletedCount = await cleanupExpiredDialogs();
      toast.success(`Cleaned up ${deletedCount} expired dialogs`);
    } catch (error) {
      console.error('Error cleaning up expired data:', error);
      toast.error('Failed to cleanup expired data');
    } finally {
      setIsCleaning(false);
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

  if (storeLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading settings...</span>
        </div>
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

        {storeError && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{storeError}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI System Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              AI System Configuration
            </CardTitle>
            <CardDescription>
              Configure OpenAI parameters and system limitations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="max-tokens">Max Output Tokens</Label>
                <Input
                  id="max-tokens"
                  type="number"
                  min="100"
                  max="4000"
                  value={localMaxTokens}
                  onChange={(e) => setLocalMaxTokens(parseInt(e.target.value) || 1000)}
                  placeholder="1000"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Maximum number of tokens for AI response (100-4000)
                </p>
              </div>

              <div>
                <Label htmlFor="max-file-size">Max File Size (MB)</Label>
                <Input
                  id="max-file-size"
                  type="number"
                  min="1"
                  max="1000"
                  value={localMaxFileSizeMb}
                  onChange={(e) => setLocalMaxFileSizeMb(parseInt(e.target.value) || 100)}
                  placeholder="100"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Maximum file size allowed for uploads (1-1000 MB)
                </p>
              </div>

              <div>
                <Label htmlFor="max-concurrent">Max Concurrent Transcriptions</Label>
                <Input
                  id="max-concurrent"
                  type="number"
                  min="1"
                  max="20"
                  value={localMaxConcurrentTranscriptions}
                  onChange={(e) => setLocalMaxConcurrentTranscriptions(parseInt(e.target.value) || 5)}
                  placeholder="5"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Maximum number of transcriptions that can run simultaneously (1-20)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Instructions Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              AI Instructions Management
            </CardTitle>
            <CardDescription>
              Manage AI system instructions and evaluation rules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AIInstructionsManager />
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
                  value={localDataRetentionDays}
                  onChange={(e) => setLocalDataRetentionDays(parseInt(e.target.value) || 30)}
                  min="1"
                  max="365"
                  className="w-32"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Number of days to keep dialog data before expiration (1-365 days)
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-delete"
                  checked={localAutoDeleteEnabled}
                  onCheckedChange={setLocalAutoDeleteEnabled}
                />
                <Label htmlFor="auto-delete">Enable Automatic Cleanup</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Automatically delete expired dialogs based on retention period</p>
                  </TooltipContent>
                </Tooltip>
              </div>
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
                      disabled={isUpdatingExpirations}
                      className="flex items-center gap-2"
                    >
                      {isUpdatingExpirations ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Update Expiration Dates
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
                      disabled={isCleaning}
                      className="flex items-center gap-2"
                    >
                      {isCleaning ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Cleanup Expired Data
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

        {/* Save All Settings Button */}
        <Button 
          onClick={handleUpdateAllSettings} 
          disabled={isUpdating} 
          className="w-full"
          size="lg"
        >
          {isUpdating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Updating Settings...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save All Settings
            </>
          )}
        </Button>

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
