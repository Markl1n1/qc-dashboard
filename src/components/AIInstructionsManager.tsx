import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { supabase } from '../integrations/supabase/client';
import { Upload, FileText, Trash2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
interface AIInstructionFile {
  name: string;
  created_at: string;
  size: number;
}
const AIInstructionsManager: React.FC = () => {
  const [files, setFiles] = useState<AIInstructionFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const {
    toast
  } = useToast();
  useEffect(() => {
    loadFiles();
  }, []);
  const loadFiles = async () => {
    try {
      setIsLoading(true);
      const {
        data,
        error
      } = await supabase.storage.from('ai-instructions').list('', {
        limit: 100,
        sortBy: {
          column: 'created_at',
          order: 'desc'
        }
      });
      if (error) {
        throw error;
      }
      if (data) {
        const instructionFiles = data.filter(file => file.name.endsWith('.txt')).map(file => ({
          name: file.name,
          created_at: file.created_at || '',
          size: file.metadata?.size || 0
        }));
        setFiles(instructionFiles);
      }
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: "Error",
        description: "Failed to load AI instruction files",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.txt')) {
      toast({
        title: "Error",
        description: "Only .txt files are allowed",
        variant: "destructive"
      });
      return;
    }
    setIsUploading(true);
    try {
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `instruction_${timestamp}.txt`;

      // Upload file
      const {
        error: uploadError
      } = await supabase.storage.from('ai-instructions').upload(fileName, file);
      if (uploadError) {
        throw uploadError;
      }
      toast({
        title: "Success",
        description: "AI instruction file uploaded successfully"
      });

      // Reload files and implement rotation
      await loadFiles();
      await implementRotation();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "Failed to upload AI instruction file",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      // Clear the file input
      event.target.value = '';
    }
  };
  const implementRotation = async () => {
    try {
      // Keep only the latest 10 files
      if (files.length >= 10) {
        const filesToDelete = files.slice(10); // Files beyond the first 10

        for (const file of filesToDelete) {
          await supabase.storage.from('ai-instructions').remove([file.name]);
        }
        if (filesToDelete.length > 0) {
          console.log(`Deleted ${filesToDelete.length} old instruction files`);
          await loadFiles(); // Reload the list
        }
      }
    } catch (error) {
      console.error('Error implementing file rotation:', error);
    }
  };
  const handleDeleteFile = async (fileName: string) => {
    try {
      const {
        error
      } = await supabase.storage.from('ai-instructions').remove([fileName]);
      if (error) {
        throw error;
      }
      toast({
        title: "Success",
        description: "File deleted successfully"
      });
      await loadFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive"
      });
    }
  };
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };
  return <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          AI Instructions Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        

        {/* File Upload */}
        <div>
          <Label htmlFor="instruction-file">Upload AI Instruction File (.txt)</Label>
          <Input id="instruction-file" type="file" accept=".txt" onChange={handleFileUpload} disabled={isUploading} className="mt-1" />
          {isUploading && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Uploading...
            </p>}
        </div>

        {/* Files List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Uploaded Files ({files.length}/10)</Label>
            <Button variant="ghost" size="sm" onClick={loadFiles} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {isLoading ? <p className="text-sm text-muted-foreground">Loading files...</p> : files.length === 0 ? <p className="text-sm text-muted-foreground">No instruction files uploaded yet.</p> : <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map((file, index) => <div key={file.name} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {file.name}
                        {index === 0 && <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            Active
                          </span>}
                      </span>
                    </div>
                    
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteFile(file.name)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>)}
            </div>}
        </div>
      </CardContent>
    </Card>;
};
export default AIInstructionsManager;