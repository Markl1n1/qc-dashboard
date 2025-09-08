
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
import { Mic, User, FileAudio, AlertCircle, Languages } from 'lucide-react';
import { DeepgramOptions } from '../types/deepgram';
import { SpeakerUtterance } from '../types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import AgentSelector from '../components/AgentSelector';
import DraggableFileList from '../components/DraggableFileList';
import MultiFileTranscriptionProgress from '../components/MultiFileTranscriptionProgress';
import LanguageSelector from '../components/LanguageSelector';
import { serverAudioMergingService, ServerMergingProgress } from '../services/serverAudioMergingService';
import { generateFileName } from '../utils/hashGenerator';

interface UploadProps {}

const Upload: React.FC<UploadProps> = () => {
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [agentName, setAgentName] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [isMerging, setIsMerging] = useState(false);
  const [mergingProgress, setMergingProgress] = useState<ServerMergingProgress | null>(null);
  const navigate = useNavigate();

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
    setAudioFiles(prev => [...prev, ...acceptedFiles]);
    console.log('Files dropped:', acceptedFiles.map(f => f.name));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    multiple: true,
  });

  const handleFileReorder = useCallback((reorderedFiles: File[]) => {
    setAudioFiles(reorderedFiles);
  }, []);

  const handleFileRemove = useCallback((index: number) => {
    setAudioFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleTranscribe = async () => {
    if (audioFiles.length === 0) {
      toast.error('Please upload at least one audio file.');
      return;
    }

    if (!agentName.trim()) {
      toast.error('Please select an agent.');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to transcribe files.');
      return;
    }

    console.log('Starting transcription for files:', audioFiles.map(f => f.name));
    
    let dialogId: string | null = null;
    
    try {
      // Generate new filename using agent name, date, and hash
      const originalFileName = audioFiles.length === 1 
        ? audioFiles[0].name 
        : `merged_${audioFiles.length}_files.mp3`;
      
      const newFileName = generateFileName(agentName.trim(), originalFileName);

      // Create dialog record first with "processing" status
      dialogId = await addDialog({
        fileName: newFileName,
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

      let fileToTranscribe: File;

      // If multiple files, merge them first using server-side merging
      if (audioFiles.length > 1) {
        console.log('Multiple files detected, merging on server...');
        
        setIsMerging(true);
        setMergingProgress(null);

        // Set up merging progress callback
        serverAudioMergingService.setProgressCallback((progress) => {
          setMergingProgress(progress);
        });

        fileToTranscribe = await serverAudioMergingService.mergeAudioFiles(audioFiles);
        setIsMerging(false);
        console.log('Files merged successfully:', fileToTranscribe.name);
      } else {
        fileToTranscribe = audioFiles[0];
      }

      // Prepare Deepgram options with language selection
      const deepgramOptions: DeepgramOptions = {
        model: 'nova-2-general',
        language: selectedLanguage,
        speaker_labels: true,
        smart_formatting: true,
        profanity_filter: false,
        punctuation: true
      };

      const result = await transcribeDeepgram(fileToTranscribe, deepgramOptions);
      
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
    } finally {
      setIsMerging(false);
    }
  };

  const handleCreateNewAgent = () => {
    navigate('/agents');
  };

  const isProcessing = isMerging || isDeepgramLoading;
  const canTranscribe = audioFiles.length > 0 && agentName.trim() && !isProcessing;

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
            <AgentSelector
              value={agentName}
              onChange={setAgentName}
              onCreateNew={handleCreateNewAgent}
            />
            <div>
              <Label>Supervisor</Label>
              <Input
                value={user?.email || 'Not logged in'}
                disabled
                className="max-w-md bg-muted"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Language Selection */}
      <LanguageSelector
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
      />

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Upload Audio Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div {...getRootProps()} className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-md cursor-pointer bg-muted hover:bg-accent">
            <input {...getInputProps()} />
            {isDragActive ? (
              <p>Drop the audio files here ...</p>
            ) : (
              <div className="text-center">
                <FileAudio className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="mb-2">Drag 'n' drop audio files here, or click to select files</p>
                <p className="text-sm text-muted-foreground">
                  Supports: MP3, WAV, M4A, AAC, OGG, FLAC, MP4, WebM, MP2, Opus
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Multiple files will be merged before transcription
                </p>
              </div>
            )}
          </div>

          {/* File List with Drag and Drop */}
          <DraggableFileList
            files={audioFiles}
            onReorder={handleFileReorder}
            onRemove={handleFileRemove}
          />

          {/* Server-side merging info */}
          {audioFiles.length > 1 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-800">Server-side audio merging</p>
                  <p className="text-blue-700">
                    Multiple files will be merged on the server before transcription.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Button */}
      <div className="flex justify-center">
        <Button 
          onClick={handleTranscribe} 
          disabled={!canTranscribe} 
          size="lg"
        >
          {isMerging ? 'Merging Files...' : isDeepgramLoading ? 'Transcribing...' : 'Start Transcription'}
        </Button>
      </div>

      {/* Merging Progress */}
      {isMerging && mergingProgress && (
        <Card>
          <CardHeader>
            <CardTitle>Merging Audio Files</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{mergingProgress.message}</p>
            {mergingProgress.currentFile && (
              <p className="text-sm text-muted-foreground">Processing: {mergingProgress.currentFile}</p>
            )}
            <Progress value={mergingProgress.progress} />
          </CardContent>
        </Card>
      )}

      {/* Multi-file Transcription Progress */}
      {isDeepgramLoading && audioFiles.length > 1 && (
        <MultiFileTranscriptionProgress
          files={audioFiles}
          currentFileIndex={0}
          currentFileProgress={deepgramProgress?.progress || 0}
          overallProgress={deepgramProgress?.progress || 0}
          stage={deepgramProgress?.stage || 'processing'}
          message={deepgramProgress?.message || 'Processing...'}
        />
      )}

      {/* Single file Progress */}
      {isDeepgramLoading && audioFiles.length === 1 && deepgramProgress && (
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
