import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { List, ListItem } from '../components/ui/list';
import { CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { databaseService } from '../services/databaseService';
import { toast } from 'sonner';
import { getAudioDuration } from '../utils/audioUtils';
import AgentSelector from '../components/AgentSelector';
import LanguageSelector, { SupportedLanguage } from '../components/LanguageSelector';
import { generateFileName } from '../utils/hashGenerator';

const Upload: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('');
  const { user } = useAuthStore();
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  };

  const handleUploadClick = async () => {
    if (!selectedFiles.length) {
      toast.error('Please select at least one file to upload');
      return;
    }

    if (!selectedAgent) {
      toast.error('Please select an agent');
      return;
    }

    if (!selectedSupervisor) {
      toast.error('Please select a supervisor');
      return;
    }

    setIsUploading(true);
    const successfulUploads: string[] = [];
    const failedUploads: string[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setCurrentUploadIndex(i);
        setUploadProgress(0);

        try {
          // Generate new filename
          const newFileName = generateFileName(selectedAgent, file.name);
          
          const audioLengthMinutes = await getAudioDuration(file);
          const estimatedCost = calculateTranscriptionCost(audioLengthMinutes);

          const dialog = await databaseService.createDialog({
            user_id: user!.id,
            file_name: newFileName, // Use the generated filename
            status: 'pending' as const,
            assigned_agent: selectedAgent,
            assigned_supervisor: selectedSupervisor,
            upload_date: new Date().toISOString(),
            audio_length_minutes: audioLengthMinutes,
            estimated_cost: estimatedCost,
            is_segmented: false,
            current_language: 'original'
          });

          // Create transcription request with language parameter
          const transcriptionRequest = {
            audioUrl: URL.createObjectURL(file),
            language: selectedLanguage,
            punctuate: true,
            smart_format: false,
            diarize: true,
            filler_words: true,
            ...(selectedLanguage !== 'en' && {
              model: 'general',
              tier: 'enhanced'
            })
          };

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(transcriptionRequest),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Transcription failed');
          }

          successfulUploads.push(newFileName);
        } catch (error: any) {
          console.error('Upload failed:', error);
          failedUploads.push(`${file.name}: ${error.message || 'Upload failed'}`);
        }
      }

      setUploadSuccess(successfulUploads);
      setUploadErrors(failedUploads);
      if (successfulUploads.length > 0) {
        toast.success(`Uploaded ${successfulUploads.length} files successfully`);
      }
      if (failedUploads.length > 0) {
        toast.error(`Failed to upload ${failedUploads.length} files`);
      }
    } catch (error: any) {
      toast.error(error.message || 'File upload failed');
      console.error('File upload failed:', error);
    } finally {
      setIsUploading(false);
      setCurrentUploadIndex(0);
      setUploadProgress(0);
      setSelectedFiles([]);
    }
  };

  const handleCancel = () => {
    setSelectedFiles([]);
    setUploadProgress(0);
    setIsUploading(false);
    setUploadSuccess([]);
    setUploadErrors([]);
    setCurrentUploadIndex(0);
  };

  const calculateTranscriptionCost = (audioLengthMinutes: number): number => {
    const ratePerMinute = 0.1;
    return audioLengthMinutes * ratePerMinute;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Upload Audio Files</h1>

      <Card>
        <CardHeader>
          <CardTitle>Agent Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AgentSelector
            selectedAgent={selectedAgent}
            onAgentSelect={setSelectedAgent}
          />
          <AgentSelector
            selectedAgent={selectedSupervisor}
            onAgentSelect={setSelectedSupervisor}
            label="Supervisor"
            placeholder="Select supervisor"
          />
          <LanguageSelector
            value={selectedLanguage}
            onValueChange={setSelectedLanguage}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Select Audio Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="audio-files">Choose files to upload</Label>
            <Input
              id="audio-files"
              type="file"
              multiple
              onChange={handleFileSelect}
              disabled={isUploading}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p>Selected Files:</p>
              <List>
                {selectedFiles.map((file, index) => (
                  <ListItem key={index}>
                    {file.name} ({file.type}, {Math.round(file.size / 1024)} KB)
                  </ListItem>
                ))}
              </List>
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <p>Uploading: {selectedFiles[currentUploadIndex]?.name}</p>
              <Progress value={uploadProgress} />
            </div>
          )}

          {uploadSuccess.length > 0 && (
            <div className="space-y-2">
              <p className="font-bold">Successful Uploads:</p>
              <List>
                {uploadSuccess.map((fileName, index) => (
                  <ListItem key={index}>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                    {fileName}
                  </ListItem>
                ))}
              </List>
            </div>
          )}

          {uploadErrors.length > 0 && (
            <div className="space-y-2">
              <p className="font-bold">Failed Uploads:</p>
              <List>
                {uploadErrors.map((error, index) => (
                  <ListItem key={index} className="text-red-500">
                    <XCircle className="mr-2 h-4 w-4 text-red-500" />
                    {error}
                  </ListItem>
                ))}
              </List>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleUploadClick} disabled={isUploading || selectedFiles.length === 0}>
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isUploading}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Upload;
