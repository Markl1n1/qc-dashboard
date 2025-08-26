
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { 
  Settings as SettingsIcon, 
  Trash2, 
  RefreshCw, 
  HardDrive, 
  Clock,
  Database,
  FileText,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '../store/settingsStore';
import { CategoryManager } from '../components/CategoryManager';
import { LanguageAwareRuleManager } from '../components/LanguageAwareRuleManager';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { useDialogStore } from '../store/dialogStore';
import { EvaluationCategory } from '../types/evaluationCategories';

const Settings = () => {
  const { maxTokens, setMaxTokens } = useSettingsStore();
  const { dialogs } = useDialogStore();

  // Local state for form inputs
  const [localMaxTokens, setLocalMaxTokens] = useState(maxTokens);
  const [dataRetentionDays, setDataRetentionDays] = useState(30);
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(100);
  const [maxConcurrentTranscriptions, setMaxConcurrentTranscriptions] = useState(5);
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category management state
  const [categories, setCategories] = useState<EvaluationCategory[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    setLocalMaxTokens(maxTokens);
  }, [maxTokens]);

  const loadCategories = async () => {
    // Mock categories for now - in real app this would come from a service
    const mockCategories: EvaluationCategory[] = [
      {
        id: '1',
        name: 'Sales',
        type: 'positive',
        weight: 8,
        enabled: true,
        rules: []
      },
      {
        id: '2',
        name: 'Support',
        type: 'positive',
        weight: 7,
        enabled: true,
        rules: []
      },
      {
        id: '3',
        name: 'Complaint',
        type: 'negative',
        weight: 9,
        enabled: true,
        rules: []
      },
      {
        id: '4',
        name: 'General',
        type: 'positive',
        weight: 5,
        enabled: true,
        rules: []
      }
    ];
    setCategories(mockCategories);
  };

  const handleSaveSettings = async () => {
    try {
      setIsLoading(true);
      setMaxTokens(localMaxTokens);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
      setError('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanupExpiredDialogs = async () => {
    try {
      setIsLoading(true);
      // Mock cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Cleaned up 0 expired dialogs');
    } catch (error) {
      console.error('Error cleaning up dialogs:', error);
      toast.error('Failed to cleanup expired dialogs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateExpirationDates = async () => {
    try {
      setIsLoading(true);
      // Mock update
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Updated expiration dates for 0 dialogs');
    } catch (error) {
      console.error('Error updating expiration dates:', error);
      toast.error('Failed to update expiration dates');
    } finally {
      setIsLoading(false);
    }
  };

  const onCategoriesChange = (newCategories: EvaluationCategory[]) => {
    setCategories(newCategories);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Admin Settings</h1>
          <p className="text-muted-foreground">Configure system settings and preferences</p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-destructive">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Configuration */}
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
              <Label htmlFor="maxTokens">Max Tokens per Analysis</Label>
              <Input
                id="maxTokens"
                type="number"
                value={localMaxTokens}
                onChange={(e) => setLocalMaxTokens(Number(e.target.value))}
                min={100}
                max={10000}
              />
              <p className="text-sm text-muted-foreground">
                Maximum tokens to use for AI analysis per dialog
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxFileSizeMb">Max File Size (MB)</Label>
              <Input
                id="maxFileSizeMb"
                type="number"
                value={maxFileSizeMb}
                onChange={(e) => setMaxFileSizeMb(Number(e.target.value))}
                min={1}
                max={500}
              />
              <p className="text-sm text-muted-foreground">
                Maximum allowed file size for uploads
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataRetentionDays">Data Retention (Days)</Label>
              <Input
                id="dataRetentionDays"
                type="number"
                value={dataRetentionDays}
                onChange={(e) => setDataRetentionDays(Number(e.target.value))}
                min={1}
                max={365}
              />
              <p className="text-sm text-muted-foreground">
                How long to keep dialog data before automatic deletion
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxConcurrentTranscriptions">Max Concurrent Transcriptions</Label>
              <Input
                id="maxConcurrentTranscriptions"
                type="number"
                value={maxConcurrentTranscriptions}
                onChange={(e) => setMaxConcurrentTranscriptions(Number(e.target.value))}
                min={1}
                max={20}
              />
              <p className="text-sm text-muted-foreground">
                Maximum number of simultaneous transcriptions
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Auto-Delete Expired Dialogs</Label>
              <p className="text-sm text-muted-foreground">
                Automatically delete dialogs after retention period
              </p>
            </div>
            <Switch
              checked={autoDeleteEnabled}
              onCheckedChange={setAutoDeleteEnabled}
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleSaveSettings}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Retention & Storage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Data Retention & Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Database className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{dialogs.length}</p>
                <p className="text-sm text-muted-foreground">Total Dialogs</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Clock className="h-8 w-8 text-secondary" />
              <div>
                <p className="font-medium">{dataRetentionDays} days</p>
                <p className="text-sm text-muted-foreground">Retention Period</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <FileText className="h-8 w-8 text-accent" />
              <div>
                <p className="font-medium">{maxFileSizeMb} MB</p>
                <p className="text-sm text-muted-foreground">Max File Size</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline"
                    onClick={handleCleanupExpiredDialogs}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Cleanup Expired
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Remove dialogs that have exceeded the retention period</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline"
                    onClick={handleUpdateExpirationDates}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Update Expiration
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Recalculate expiration dates based on current retention policy</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Category Management */}
      <CategoryManager 
        categories={categories}
        onCategoriesChange={onCategoriesChange}
      />

      {/* Language-Aware Rule Management */}
      <LanguageAwareRuleManager />
    </div>
  );
};

export default Settings;
