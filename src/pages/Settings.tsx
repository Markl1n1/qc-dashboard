import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useToast } from '../hooks/use-toast';
import { useUserRole } from '../hooks/useUserRole';
import { Settings as SettingsIcon, Trash2, RefreshCw, Database, Clock, ExternalLink, Brain } from 'lucide-react';
import { useEnhancedSettingsStore } from '../store/enhancedSettingsStore';
import { useSettingsStore } from '../store/settingsStore';
import { Separator } from '../components/ui/separator';
import { Alert, AlertDescription } from '../components/ui/alert';
import { supabase } from '../integrations/supabase/client';
import AIInstructionsManager from '../components/AIInstructionsManager';
const Settings = () => {
  const {
    isAdmin
  } = useUserRole();
  const {
    toast
  } = useToast();

  // Use both stores for backward compatibility
  const {
    maxTokens: localMaxTokens,
    setMaxTokens: setLocalMaxTokens
  } = useSettingsStore();
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

  // AI Configuration state
  const [aiConfidenceThreshold, setAiConfidenceThreshold] = useState<number>(0.8);
  const [aiMaxTokensGpt5Mini, setAiMaxTokensGpt5Mini] = useState<number>(1000);
  const [aiMaxTokensGpt5, setAiMaxTokensGpt5] = useState<number>(2000);
  const [aiTemperature, setAiTemperature] = useState<number>(0.7);
  const [aiReasoningEffort, setAiReasoningEffort] = useState<string>('medium');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isUpdatingExpirations, setIsUpdatingExpirations] = useState(false);
  useEffect(() => {
    if (isAdmin) {
      loadSettings();
      loadAISettings();
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
  const loadAISettings = async () => {
    if (!isAdmin) return;
    try {
      const {
        data,
        error
      } = await supabase.from('system_config').select('key, value').in('key', ['ai_confidence_threshold', 'ai_max_tokens_gpt5_mini', 'ai_max_tokens_gpt5', 'ai_temperature', 'ai_reasoning_effort']);
      if (error) throw error;
      data?.forEach(({
        key,
        value
      }) => {
        switch (key) {
          case 'ai_confidence_threshold':
            setAiConfidenceThreshold(parseFloat(value) || 0.8);
            break;
          case 'ai_max_tokens_gpt5_mini':
            setAiMaxTokensGpt5Mini(parseInt(value) || 1000);
            break;
          case 'ai_max_tokens_gpt5':
            setAiMaxTokensGpt5(parseInt(value) || 2000);
            break;
          case 'ai_temperature':
            setAiTemperature(parseFloat(value) || 0.7);
            break;
          case 'ai_reasoning_effort':
            setAiReasoningEffort(value || 'medium');
            break;
        }
      });
    } catch (error) {
      console.error('Error loading AI settings:', error);
    }
  };
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
        description: "Max tokens setting updated successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update max tokens setting",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };
  const handleUpdateAdminSettings = async () => {
    if (!isAdmin) return;
    setIsUpdating(true);
    try {
      await Promise.all([updateDataRetentionDays(localDataRetentionDays), updateMaxFileSizeMb(localMaxFileSizeMb), updateMaxConcurrentTranscriptions(localMaxConcurrentTranscriptions), updateAutoDeleteEnabled(localAutoDeleteEnabled)]);
      toast({
        title: "Success",
        description: "Admin settings updated successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update admin settings",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };
  const handleUpdateAISettings = async () => {
    if (!isAdmin) return;
    setIsUpdating(true);
    try {
      const updates = [{
        key: 'ai_confidence_threshold',
        value: aiConfidenceThreshold.toString()
      }, {
        key: 'ai_max_tokens_gpt5_mini',
        value: aiMaxTokensGpt5Mini.toString()
      }, {
        key: 'ai_max_tokens_gpt5',
        value: aiMaxTokensGpt5.toString()
      }, {
        key: 'ai_temperature',
        value: aiTemperature.toString()
      }, {
        key: 'ai_reasoning_effort',
        value: aiReasoningEffort
      }];
      for (const update of updates) {
        const {
          error
        } = await supabase.from('system_config').update({
          value: update.value
        }).eq('key', update.key);
        if (error) throw error;
      }
      toast({
        title: "Success",
        description: "AI settings updated successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update AI settings",
        variant: "destructive"
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
        description: `Deleted ${deletedCount} expired dialogs`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cleanup expired dialogs",
        variant: "destructive"
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
        description: `Updated expiration dates for ${updatedCount} dialogs`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update expiration dates",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingExpirations(false);
    }
  };
  if (!isAdmin && isLoading) {
    return <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin" />
          
        </div>
      </div>;
  }
  return <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center space-x-2 mb-6">
          <SettingsIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">
            {isAdmin ? 'Admin Settings' : 'User Settings'}
          </h1>
        </div>

        {error && <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>}

        {/* OpenAI Configuration - Available to all users */}
        <Card>
          <CardHeader>
            <CardTitle>OpenAI Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="max-tokens">Max Output Tokens</Label>
              <Input id="max-tokens" type="number" min="100" max="4000" value={localInputMaxTokens} onChange={e => setLocalInputMaxTokens(parseInt(e.target.value) || 1000)} placeholder="1000" />
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
        {isAdmin && <>
            {/* AI Configuration for Admins */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  
                  AI Analysis Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ai-confidence">Confidence Threshold</Label>
                    <Input id="ai-confidence" type="number" min="0.1" max="1.0" step="0.1" value={aiConfidenceThreshold} onChange={e => setAiConfidenceThreshold(parseFloat(e.target.value) || 0.8)} />
                    <p className="text-sm text-muted-foreground mt-1">
                      Switch to GPT-5 if confidence below this value (0.1-1.0)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="ai-temperature">Temperature</Label>
                    <Input id="ai-temperature" type="number" min="0.0" max="2.0" step="0.1" value={aiTemperature} onChange={e => setAiTemperature(parseFloat(e.target.value) || 0.7)} />
                    
                  </div>

                  <div>
                    <Label htmlFor="ai-tokens-mini">GPT-5 Mini Max Tokens</Label>
                    <Input id="ai-tokens-mini" type="number" min="100" max="4000" value={aiMaxTokensGpt5Mini} onChange={e => setAiMaxTokensGpt5Mini(parseInt(e.target.value) || 1000)} />
                  </div>

                  <div>
                    <Label htmlFor="ai-tokens-full">GPT-5 Max Tokens</Label>
                    <Input id="ai-tokens-full" type="number" min="100" max="4000" value={aiMaxTokensGpt5} onChange={e => setAiMaxTokensGpt5(parseInt(e.target.value) || 2000)} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="ai-reasoning">Reasoning Effort</Label>
                  <Select value={aiReasoningEffort} onValueChange={setAiReasoningEffort}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  
                </div>

                <Button onClick={handleUpdateAISettings} disabled={isUpdating}>
                  {isUpdating ? 'Updating...' : 'Update AI Settings'}
                </Button>
              </CardContent>
            </Card>

            {/* AI Instructions Management */}
            <AIInstructionsManager />

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
                  <Input id="retention-days" type="number" min="1" max="365" value={localDataRetentionDays} onChange={e => setLocalDataRetentionDays(parseInt(e.target.value) || 30)} placeholder="30" />
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
                  <Switch id="auto-delete" checked={localAutoDeleteEnabled} onCheckedChange={setLocalAutoDeleteEnabled} />
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button onClick={handleUpdateExpirationDates} disabled={isUpdatingExpirations} variant="outline" size="sm">
                    {isUpdatingExpirations ? <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </> : <>
                        <Clock className="h-4 w-4 mr-2" />
                        Update Expiration Dates
                      </>}
                  </Button>
                  
                  <Button onClick={handleCleanupExpiredDialogs} disabled={isCleaning} variant="outline" size="sm">
                    {isCleaning ? <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Cleaning...
                      </> : <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Cleanup Expired Data
                      </>}
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
                  <Input id="max-file-size" type="number" min="1" max="1000" value={localMaxFileSizeMb} onChange={e => setLocalMaxFileSizeMb(parseInt(e.target.value) || 100)} placeholder="100" />
                  <p className="text-sm text-muted-foreground mt-1">
                    Maximum file size allowed for uploads (1-1000 MB)
                  </p>
                </div>

                <div>
                  <Label htmlFor="max-concurrent">Max Concurrent Transcriptions</Label>
                  <Input id="max-concurrent" type="number" min="1" max="20" value={localMaxConcurrentTranscriptions} onChange={e => setLocalMaxConcurrentTranscriptions(parseInt(e.target.value) || 5)} placeholder="5" />
                  <p className="text-sm text-muted-foreground mt-1">
                    Maximum number of transcriptions that can run simultaneously (1-20)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Save Admin Settings Button */}
            <Button onClick={handleUpdateAdminSettings} disabled={isUpdating} className="w-full">
              {isUpdating ? <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating Settings...
                </> : 'Save Admin Settings'}
            </Button>
          </>}

        {!isAdmin && <Alert>
            <ExternalLink className="h-4 w-4" />
            <AlertDescription>
              You have user-level access. Additional administrative settings are available to admin users only.
            </AlertDescription>
          </Alert>}
      </div>
    </div>;
};
export default Settings;