
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { useToast } from '../hooks/use-toast';
import { useUserRole } from '../hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Settings as SettingsIcon, Trash2, RefreshCw, Database, Clock, ExternalLink } from 'lucide-react';
import { useEnhancedSettingsStore } from '../store/enhancedSettingsStore';
import { useSettingsStore } from '../store/settingsStore';
import { Separator } from '../components/ui/separator';
import { Alert, AlertDescription } from '../components/ui/alert';

const Settings = () => {
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  
  // Use both stores for backward compatibility
  const { maxTokens: localMaxTokens, setMaxTokens: setLocalMaxTokens } = useSettingsStore();
  
  const {
    maxTokens: dbMaxTokens,
    dataRetentionDays,
    maxFileSizeMb,
    maxConcurrentTranscriptions,
    autoDeleteEnabled,
    isLoading,
    error,
    loadSettings,
    updateMaxTokens: updateDbMaxTokens,
    updateDataRetentionDays,
    updateMaxFileSizeMb,
    updateMaxConcurrentTranscriptions,
    updateAutoDeleteEnabled,
    cleanupExpiredDialogs,
    updateDialogExpirationDates
  } = useEnhancedSettingsStore();

  // Local state for form inputs
  const [localInputMaxTokens, setLocalInputMaxTokens] = useState<number>(localMaxTokens);
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
    // Sync between local and database max tokens
    setLocalInputMaxTokens(Math.max(localMaxTokens, dbMaxTokens));
    setLocalDataRetentionDays(dataRetentionDays);
    setLocalMaxFileSizeMb(maxFileSizeMb);
    setLocalMaxConcurrentTranscriptions(maxConcurrentTranscriptions);
    setLocalAutoDeleteEnabled(autoDeleteEnabled);
  }, [localMaxTokens, dbMaxTokens, dataRetentionDays, maxFileSizeMb, maxConcurrentTranscriptions, autoDeleteEnabled]);

  const updateMaxTokens = async () => {
    setIsUpdating(true);
    try {
      // Update both local and database stores
      setLocalMaxTokens(localInputMaxTokens);
      if (isAdmin) {
        await updateDbMaxTokens(localInputMaxTokens);
      }
      
      toast({
        title: "Success",
        description: "Max tokens setting updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update max tokens setting",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateAdminSettings = async () => {
    if (!isAdmin) return;
    
    setIsUpdating(true);
    try {
      await Promise.all([
        updateDataRetentionDays(localDataRetentionDays),
        updateMaxFileSizeMb(localMaxFileSizeMb),
        updateMaxConcurrentTranscriptions(localMaxConcurrentTranscriptions),
        updateAutoDeleteEnabled(localAutoDeleteEnabled)
      ]);
      
      toast({
        title: "Success",
        description: "Admin settings updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update admin settings",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCleanupExpiredDialogs = async () => {
    setIsCleaning(true);
    try {
      const deletedCount = await cleanupExpiredDialogs();
      toast({
        title: "Cleanup Complete",
        description: `Deleted ${deletedCount} expired dialogs`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cleanup expired dialogs",
        variant: "destructive",
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleUpdateExpirationDates = async () => {
    setIsUpdatingExpirations(true);
    try {
      const updatedCount = await updateDialogExpirationDates();
      toast({
        title: "Update Complete",
        description: `Updated expiration dates for ${updatedCount} dialogs`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update expiration dates",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingExpirations(false);
    }
  };

  if (!isAdmin && isLoading) {
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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center space-x-2 mb-6">
          <SettingsIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">
            {isAdmin ? 'Admin Settings' : 'User Settings'}
          </h1>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* OpenAI Configuration - Available to all users */}
        <Card>
          <CardHeader>
            <CardTitle>OpenAI Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="max-tokens">Max Output Tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                min="100"
                max="4000"
                value={localInputMaxTokens}
                onChange={(e) => setLocalInputMaxTokens(parseInt(e.target.value) || 1000)}
                placeholder="1000"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Maximum number of tokens for OpenAI response (100-4000)
              </p>
            </div>
            <Button onClick={updateMaxTokens} disabled={isUpdating}>
              {isUpdating ? 'Updating...' : 'Update Max Tokens'}
            </Button>
          </CardContent>
        </Card>

        {/* Admin-only settings */}
        {isAdmin && (
          <>
            {/* Data Retention Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Retention & Storage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="retention-days">Data Retention Period (Days)</Label>
                  <Input
                    id="retention-days"
                    type="number"
                    min="1"
                    max="365"
                    value={localDataRetentionDays}
                    onChange={(e) => setLocalDataRetentionDays(parseInt(e.target.value) || 30)}
                    placeholder="30"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Number of days to retain dialog data before automatic deletion (1-365 days)
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-delete">Automatic Data Cleanup</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically delete expired dialogs based on retention period
                    </p>
                  </div>
                  <Switch
                    id="auto-delete"
                    checked={localAutoDeleteEnabled}
                    onCheckedChange={setLocalAutoDeleteEnabled}
                  />
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    onClick={handleUpdateExpirationDates}
                    disabled={isUpdatingExpirations}
                    variant="outline"
                    size="sm"
                  >
                    {isUpdatingExpirations ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 mr-2" />
                        Update Expiration Dates
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleCleanupExpiredDialogs}
                    disabled={isCleaning}
                    variant="outline"
                    size="sm"
                  >
                    {isCleaning ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Cleaning...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Cleanup Expired Data
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* System Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>

            {/* Save Admin Settings Button */}
            <Button onClick={handleUpdateAdminSettings} disabled={isUpdating} className="w-full">
              {isUpdating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating Settings...
                </>
              ) : (
                'Save Admin Settings'
              )}
            </Button>
          </>
        )}

        {!isAdmin && (
          <Alert>
            <ExternalLink className="h-4 w-4" />
            <AlertDescription>
              You have user-level access. Additional administrative settings are available to admin users only.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

export default Settings;
