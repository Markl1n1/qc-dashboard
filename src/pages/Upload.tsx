
import React, { useState, useCallback } from 'react';
import { useDropzone, Accept } from 'react-dropzone';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useDeepgramTranscription } from '../hooks/useDeepgramTranscription';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';
import { useAuthStore } from '../store/authStore';
import { Mic, User } from 'lucide-react';
import { DeepgramOptions } from '../types/deepgram';
import { SpeakerUtterance } from '../types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface UploadProps {}

const Upload: React.FC<UploadProps> = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [agentName, setAgentName] = useState<string>('');
  const navigate = useNavigate();

  // Deepgram options - always enabled speaker diarization and language detection
  const deepgramOptions: DeepgramOptions = {
    model: 'nova-2',
    language_detection: true,
    speaker_labels: true,
    smart_formatting: true,
    profanity_filter: false,
    punctuation: true
  };

  const { user } = useAuthStore();
  const { addDialog, updateDialog, saveTranscription, saveSpeakerTranscription } = useDatabaseDialogs();

  const { 
    transcribe: transcribeDeepgram, 
    isLoading: isDeepgramLoading, 
    progress: deepgramProgress, 
    error: deepgramError
  } = useDeepgramTranscription();

  // Expanded audio format support based on Deepgram's capabilities
  const acceptedFileTypes: Accept = {
    'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.mp4', '.webm', '.mp2', '.opus']
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setAudioFile(file);
    console.log('File dropped:', file.name);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    multiple: false,
  });

  const handleTranscribe = async () => {
    if (!audioFile) {
      toast.error('Please upload an audio file first.');
      return;
    }

    if (!agentName.trim()) {
      toast.error('Please enter the agent name.');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to transcribe files.');
      return;
    }

    console.log('Starting transcription for file:', audioFile.name);
    
    let dialogId: string | null = null;
    
    try {
      // Create dialog record first with "processing" status
      dialogId = await addDialog({
        fileName: audioFile.name,
        status: 'processing',
        assignedAgent: agentName.trim(),
        assignedSupervisor: user.email || 'Unknown',
        uploadDate: new Date().toISOString(),
        tokenEstimation: {
          audioLengthMinutes: 0,
          estimatedCost: 0
        },
        isSegmented: false,
        currentLanguage: 'original'
      });

      const result = await transcribeDeepgram(audioFile, deepgramOptions);
      
      // Save transcription to database
      await saveTranscription(dialogId, result.text, 'plain');
      if (result.speakerUtterances && result.speakerUtterances.length > 0) {
        await saveSpeakerTranscription(dialogId, result.speakerUtterances, 'speaker');
      }

      // Update dialog status to "completed"
      await updateDialog(dialogId, {
        status: 'completed'
      });

      toast.success('Transcription completed successfully!');
      console.log('Transcription completed and saved to database');
      
      // Navigate to dialog details page
      navigate(`/dialog/${dialogId}`);
    } catch (err: any) {
      console.error('Transcription failed', err);
      toast.error(`Transcription failed: ${err.message}`);
      
      // Update dialog status to "failed" on error
      if (dialogId) {
        await updateDialog(dialogId, {
          status: 'failed',
          error: err.message
        });
      }
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Agent Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Agent Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="agent-name">Agent Name *</Label>
              <Input
                id="agent-name"
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Enter the agent's name"
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Name of the agent being evaluated in this recording
              </p>
            </div>
            <div>
              <Label>Supervisor</Label>
              <Input
                value={user?.email || 'Not logged in'}
                disabled
                className="max-w-md bg-muted"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Supervisor assigned to this evaluation (automatically set to logged-in user)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Upload Audio File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div {...getRootProps()} className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-md cursor-pointer bg-muted hover:bg-accent">
            <input {...getInputProps()} />
            {isDragActive ? (
              <p>Drop the audio here ...</p>
            ) : (
              <div className="text-center">
                <p className="mb-2">Drag 'n' drop an audio file here, or click to select files</p>
                <p className="text-sm text-muted-foreground">
                  Supports: MP3, WAV, M4A, AAC, OGG, FLAC, MP4, WebM, MP2, Opus
                </p>
              </div>
            )}
            {audioFile && (
              <div className="mt-2 text-center">
                <div className="font-medium">Selected file: {audioFile.name}</div>
                <div className="text-sm text-muted-foreground">
                  ({Math.round(audioFile.size / 1024)} KB)
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Button */}
      <div className="flex justify-center">
        <Button 
          onClick={handleTranscribe} 
          disabled={!audioFile || !agentName.trim() || isDeepgramLoading} 
          size="lg"
        >
          {isDeepgramLoading ? 'Transcribing...' : 'Start Transcription'}
        </Button>
      </div>

      {/* Progress */}
      {deepgramProgress && (
        <Card>
          <CardHeader>
            <CardTitle>Transcription Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{deepgramProgress.message}</p>
            <Progress value={deepgramProgress.progress} />
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {deepgramError && (
        <Card>
          <CardHeader>
            <CardTitle>Transcription Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">{deepgramError}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Upload;
