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
import { useTranslation } from "@/i18n";

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { role, isLoading: roleLoading } = useUserRole();
  const { systemConfig, isLoading, error, loadSystemConfig, updateSystemConfig, resetToDefaults, cleanupExpiredDialogs, updateDialogExpirationDates } = useEnhancedSettingsStore();
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  useEffect(() => { loadSystemConfig(); }, [loadSystemConfig]);
  useEffect(() => { if (systemConfig) { setLocalConfig(systemConfig); setHasUnsavedChanges(false); } }, [systemConfig]);

  const handleConfigChange = (key: string, value: string) => { setLocalConfig(prev => ({ ...prev, [key]: value })); setHasUnsavedChanges(true); };

  const handleSaveConfig = async () => {
    try { setIsSaving(true); await updateSystemConfig(localConfig); setHasUnsavedChanges(false); toast.success(t('settings.savedSuccess')); }
    catch (error) { toast.error(t('settings.saveFailed')); } finally { setIsSaving(false); }
  };

  const handleCleanupExpiredDialogs = async () => {
    try { setIsCleaningUp(true); const deletedCount = await cleanupExpiredDialogs(); toast.success(`Cleaned up ${deletedCount} expired dialogs`); }
    catch (error) { toast.error('Failed to cleanup expired dialogs'); } finally { setIsCleaningUp(false); }
  };

  const handleUpdateExpirationDates = async () => {
    try { const updatedCount = await updateDialogExpirationDates(); toast.success(`Updated expiration dates for ${updatedCount} dialogs`); }
    catch (error) { toast.error('Failed to update expiration dates'); }
  };

  if (roleLoading || isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (role !== 'admin' && role !== 'supervisor') {
    return <div className="p-6"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{t('settings.accessDenied')}</AlertDescription></Alert></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
        {hasUnsavedChanges && <div className="flex items-center gap-2"><Badge variant="outline">{t('settings.unsavedChanges')}</Badge></div>}
      </div>

      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai">{t('settings.aiAnalysis')}</TabsTrigger>
          <TabsTrigger value="system">{t('settings.system')}</TabsTrigger>
          <TabsTrigger value="deepgram">{t('settings.deepgram')}</TabsTrigger>
          <TabsTrigger value="instructions">{t('settings.aiInstructions')}</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />{t('settings.aiAnalysisConfig')}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>{t('settings.reasoningEffort')}</Label>
                  <Select value={localConfig.ai_reasoning_effort || 'low'} onValueChange={(value) => handleConfigChange('ai_reasoning_effort', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t('common.low')}</SelectItem>
                      <SelectItem value="medium">{t('common.medium')}</SelectItem>
                      <SelectItem value="high">{t('common.high')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.confidenceThreshold')}</Label>
                  <Slider min={0} max={1} step={0.1} value={[parseFloat(localConfig.ai_confidence_threshold || '0.8')]} onValueChange={([value]) => handleConfigChange('ai_confidence_threshold', value.toString())} />
                  <div className="text-center text-sm text-muted-foreground">{(parseFloat(localConfig.ai_confidence_threshold || '0.8') * 100).toFixed(0)}%</div>
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.maxTokensGpt5')}</Label>
                  <Input type="number" min="1000" max="20000" step="1000" value={localConfig.ai_max_tokens_gpt5 || '12000'} onChange={(e) => handleConfigChange('ai_max_tokens_gpt5', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.maxTokensGpt5Mini')}</Label>
                  <Input type="number" min="1000" max="12000" step="1000" value={localConfig.ai_max_tokens_gpt5_mini || '8000'} onChange={(e) => handleConfigChange('ai_max_tokens_gpt5_mini', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><SettingsIcon className="h-5 w-5" />{t('settings.systemConfig')}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label>{t('settings.maxFileSize')}</Label><Input type="number" min="1" max="1000" value={localConfig.max_file_size_mb || '200'} onChange={(e) => handleConfigChange('max_file_size_mb', e.target.value)} /></div>
                <div className="space-y-2"><Label>{t('settings.maxConcurrent')}</Label><Input type="number" min="1" max="50" value={localConfig.max_concurrent_transcriptions || '20'} onChange={(e) => handleConfigChange('max_concurrent_transcriptions', e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>{t('settings.dataRetentionDays')}</Label>
                  <Slider min={1} max={365} step={1} value={[parseInt(localConfig.data_retention_days || '30')]} onValueChange={([value]) => handleConfigChange('data_retention_days', value.toString())} />
                  <div className="text-center text-sm text-muted-foreground">{parseInt(localConfig.data_retention_days || '30')} {t('dataRetention.days')}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch checked={localConfig.auto_delete_enabled === 'true'} onCheckedChange={(checked) => handleConfigChange('auto_delete_enabled', checked.toString())} />
                  <Label>{t('settings.autoDelete')}</Label>
                </div>
                <div className="space-y-2"><Label>{t('settings.signupPasscode')}</Label><Input type="password" value={localConfig.signup_passcode || ''} onChange={(e) => handleConfigChange('signup_passcode', e.target.value)} /></div>
              </div>
              <div className="pt-4 border-t space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2"><Database className="h-4 w-4" />{t('settings.dataManagement')}</h4>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleCleanupExpiredDialogs} disabled={isCleaningUp} variant="outline" size="sm">
                    {isCleaningUp ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('settings.cleaning')}</> : <><Trash2 className="h-4 w-4 mr-2" />{t('settings.cleanupExpired')}</>}
                  </Button>
                  <Button onClick={handleUpdateExpirationDates} variant="outline" size="sm">{t('settings.updateExpiration')}</Button>
                </div>
              </div>
              <div className="pt-4 border-t">
                <Button onClick={handleSaveConfig} disabled={isSaving || !hasUnsavedChanges}>
                  {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('settings.saving')}</> : <><Save className="h-4 w-4 mr-2" />{t('settings.saveAll')}</>}
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
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />{t('settings.aiInstructionsManagement')}</CardTitle></CardHeader>
            <CardContent><AIInstructionsFileManager /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
