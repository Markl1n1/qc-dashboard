import React, { useState, useCallback } from 'react';
import { useDropzone, Accept } from 'react-dropzone';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { CheckedState } from '@radix-ui/react-checkbox';
import { EmergencyDebugPanel } from '../components/EmergencyDebugPanel';
import { useSimplifiedTranscription } from '../hooks/useSimplifiedTranscription';

interface UploadProps {}

interface ModelInfo {
  name: string;
  size: string;
}

const Upload: React.FC<UploadProps> = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [model, setModel] = useState<string>('assemblyai-universal');
  const [language, setLanguage] = useState<string>('en');
  const [speakerLabels, setSpeakerLabels] = useState<boolean>(false);
  const [assignedAgent, setAssignedAgent] = useState<string>('');
  const [assignedSupervisor, setAssignedSupervisor] = useState<string>('');
  const [isApiKeyValid, setIsApiKeyValid] = useState<boolean>(true);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [tokenEstimate, setTokenEstimate] = useState<{ audioLengthMinutes: number; estimatedCost: number } | null>(null);

  const { 
    transcribe, 
    isLoading: isTranscribing, 
    progress, 
    error: transcriptionError,
    getEmergencyLogs,
    clearEmergencyLogs 
  } = useSimplifiedTranscription();

  const acceptedFileTypes: Accept = {
    'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac']
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setAudioFile(file);
    setTranscription('');
    setTokenEstimate(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    multiple: false,
  });

  const handleTranscribe = async () => {
    if (!audioFile) {
      alert('Please upload an audio file first.');
      return;
    }

    try {
      const result = await transcribe(audioFile, {
        speakerLabels: speakerLabels,
        language: language,
      });
      setTranscription(result.text);
    } catch (err: any) {
      console.error('Transcription failed', err);
      alert(`Transcription failed: ${err.message}`);
    }
  };

  const handleEstimateTokenCost = async () => {
    if (!audioFile) {
      alert('Please upload an audio file first.');
      return;
    }

    // Placeholder for token estimation logic
    setTokenEstimate({ audioLengthMinutes: 10, estimatedCost: 0.5 });
  };

  const handleSpeakerLabelsChange = (checked: CheckedState) => {
    setSpeakerLabels(checked === true);
  };

  return (
    <div className="container mx-auto p-6">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Upload Audio File</CardTitle>
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

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Transcription Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="model" className="text-right">
                Model
              </Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="col-span-2">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assemblyai-universal">AssemblyAI Universal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="language" className="text-right">
                Language
              </Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="col-span-2">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="speakerLabels" checked={speakerLabels} onCheckedChange={handleSpeakerLabelsChange} />
              <Label htmlFor="speakerLabels">Speaker Labels</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Agent and Supervisor Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="agent" className="text-right">
                Assigned Agent
              </Label>
              <Input id="agent" value={assignedAgent} onChange={(e) => setAssignedAgent(e.target.value)} className="col-span-2" />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="supervisor" className="text-right">
                Assigned Supervisor
              </Label>
              <Input id="supervisor" value={assignedSupervisor} onChange={(e) => setAssignedSupervisor(e.target.value)} className="col-span-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {tokenEstimate && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Token Estimation</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Estimated audio length: {tokenEstimate.audioLengthMinutes} minutes</p>
            <p>Estimated cost: ${tokenEstimate.estimatedCost.toFixed(5)}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between mb-4">
        <Button onClick={handleEstimateTokenCost} disabled={!audioFile}>
          Estimate Token Cost
        </Button>
        <Button onClick={handleTranscribe} disabled={!audioFile || isTranscribing}>
          {isTranscribing ? 'Transcribing...' : 'Transcribe'}
        </Button>
      </div>

      {progress && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Transcription Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{progress.message}</p>
            <Progress value={progress.progress} />
          </CardContent>
        </Card>
      )}

      {transcriptionError && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Transcription Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">{transcriptionError}</p>
          </CardContent>
        </Card>
      )}

      {transcription && (
        <Card>
          <CardHeader>
            <CardTitle>Transcription</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={transcription} readOnly className="min-h-[200px]" />
          </CardContent>
        </Card>
      )}
      
      <EmergencyDebugPanel />
    </div>
  );
};

export default Upload;
