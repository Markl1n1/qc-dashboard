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
      
    </div>;
};
export default Settings;