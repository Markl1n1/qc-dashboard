
import React, { useState, useCallback } from 'react';
import { useDropzone, Accept } from 'react-dropzone';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useDeepgramTranscription } from '../hooks/useDeepgramTranscription';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';
import { useAuthStore } from '../store/authStore';
import { Mic } from 'lucide-react';
import { DeepgramOptions } from '../types/deepgram';
import { SpeakerUtterance } from '../types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface UploadProps {}

const Upload: React.FC<UploadProps> = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
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
  const { addDialog, saveTranscription, saveSpeakerTranscription } = useDatabaseDialogs();

  const { 
    transcribe: transcribeDeepgram, 
    isLoading: isDeepgramLoading, 
    progress: deepgramProgress, 
    error: deepgramError
  } = useDeepgramTranscription();

  const acceptedFileTypes: Accept = {
    'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac']
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

    if (!user) {
      toast.error('You must be logged in to transcribe files.');
      return;
    }

    console.log('Starting transcription for file:', audioFile.name);
    
    try {
      // Create dialog record first
      const dialogId = await addDialog({
        fileName: audioFile.name,
        status: 'processing',
        assignedAgent: user.email || 'Unknown',
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

      // Update dialog status to completed
      await addDialog({
        fileName: audioFile.name,
        status: 'completed',
        assignedAgent: user.email || 'Unknown',
        assignedSupervisor: user.email || 'Unknown',
        uploadDate: new Date().toISOString(),
        tokenEstimation: {
          audioLengthMinutes: 0,
          estimatedCost: 0
        },
        isSegmented: false,
        currentLanguage: 'original'
      });

      toast.success('Transcription completed successfully!');
      console.log('Transcription completed and saved to database');
      
      // Navigate to dialog details page
      navigate(`/dialog/${dialogId}`);
    } catch (err: any) {
      console.error('Transcription failed', err);
      toast.error(`Transcription failed: ${err.message}`);
    }
  };

  return (
    <div className="container mx-auto p-6">
      {/* File Upload */}
      <Card className="mb-4">
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
              <p>Drag 'n' drop an audio file here, or click to select files</p>
            )}
            {audioFile && (
              <div className="mt-2">
                Selected file: {audioFile.name} ({Math.round(audioFile.size / 1024)} KB)
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Button */}
      <div className="flex justify-center mb-4">
        <Button onClick={handleTranscribe} disabled={!audioFile || isDeepgramLoading} size="lg">
          {isDeepgramLoading ? 'Transcribing...' : 'Start Transcription'}
        </Button>
      </div>

      {/* Progress */}
      {deepgramProgress && (
        <Card className="mb-4">
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
        <Card className="mb-4">
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
