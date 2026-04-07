import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Upload, FileText, Trash2, AlertCircle, CheckCircle, Cpu, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { aiInstructionsService, InstructionFile } from '../services/aiInstructionsService';
import { useTranslation } from '../i18n';

interface FileStats {
  count: number;
  latestUpdate: string | null;
}

const AIInstructionsFileManager = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, InstructionFile[]>>({ system: [] });
  const [stats, setStats] = useState<Record<string, FileStats>>({ system: { count: 0, latestUpdate: null } });

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [systemFiles, systemStats] = await Promise.all([
        aiInstructionsService.listInstructionFiles('system'),
        aiInstructionsService.getFileStats('system')
      ]);
      setFiles({ system: systemFiles });
      setStats({ system: systemStats });
    } catch (err) {
      console.error('Error loading files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleFileUpload = async (file: File, type: 'system') => {
    try {
      setError(null);
      await aiInstructionsService.uploadInstructionFile(file, type);
      toast.success(t('instructions.uploadSuccess'));
      await loadFiles();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload file';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleFileDelete = async (fileName: string, type: string) => {
    try {
      setError(null);
      await aiInstructionsService.deleteInstructionFile(fileName);
      toast.success(t('instructions.deleteSuccess'));
      await loadFiles();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete file';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const FileUploadSection = ({
    type, icon: Icon, title, description
  }: {
    type: 'system'; icon: React.ComponentType<any>; title: string; description: string;
  }) => {
    const fileInputId = `file-${type}`;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('instructions.uploadInstructions')} {type}</p>
                <p className="text-xs text-muted-foreground">{t('instructions.onlyTxt')}</p>
                <input id={fileInputId} type="file" accept=".txt" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { handleFileUpload(file, type); e.target.value = ''; }
                }} />
                <Button variant="outline" size="sm" onClick={() => document.getElementById(fileInputId)?.click()}>
                  {t('instructions.selectFile')}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {stats[type].count} {t('instructions.filesUploaded')}
              </span>
              {stats[type].latestUpdate && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {t('instructions.active')}
                </Badge>
              )}
            </div>

            {files[type].length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('instructions.uploadedFiles')}:</p>
                {files[type].slice(0, 5).map((file, index) => (
                  <div key={file.name} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm font-mono">{file.name}</span>
                      {index === 0 && <Badge variant="default" className="text-xs">{t('instructions.latest')}</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{new Date(file.created_at).toLocaleDateString()}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleFileDelete(file.name, type)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {files[type].length > 5 && (
                  <p className="text-xs text-muted-foreground">... {t('instructions.moreFiles')}: {files[type].length - 5}</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>{t('instructions.loadingInstructions')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <FileUploadSection type="system" icon={Cpu} title={t('instructions.systemInstructions')} description={t('instructions.systemDesc')} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <div className="text-2xl font-bold">{stats.system.count}</div>
            <div className="text-sm text-muted-foreground">{t('instructions.systemFiles')}</div>
            {stats.system.latestUpdate && (
              <div className="text-xs text-muted-foreground">
                {t('instructions.last')}: {new Date(stats.system.latestUpdate).toLocaleDateString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIInstructionsFileManager;
