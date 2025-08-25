
import React, { useState, useCallback } from 'react';
import { useDropzone, Accept } from 'react-dropzone';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { CheckedState } from '@radix-ui/react-checkbox';
import { useSimplifiedTranscription } from '../hooks/useSimplifiedTranscription';
import { useDeepgramTranscription } from '../hooks/useDeepgramTranscription';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';
import { useAuthStore } from '../store/authStore';
import { Mic, Zap, Users, Globe } from 'lucide-react';
import DeepgramOptions from '../components/DeepgramOptions';
import DeepgramResultsTabs from '../components/DeepgramResultsTabs';
import { DeepgramOptions as DeepgramOptionsType } from '../types/deepgram';
import { SpeakerUtterance } from '../types';
import { toast } from 'sonner';

interface UploadProps {}

const Upload: React.FC<UploadProps> = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptionResults, setTranscriptionResults] = useState<{
    text: string;
    speakerUtterances: SpeakerUtterance[];
    detectedLanguage?: { language: string; confidence: number };
    metadata?: { duration: number; model: string };
  } | null>(null);
  const [provider, setProvider] = useState<'assemblyai' | 'deepgram'>('assemblyai');

  // AssemblyAI options
  const [assemblyModel, setAssemblyModel] = useState<string>('assemblyai-universal');
  const [assemblyLanguage, setAssemblyLanguage] = useState<string>('en');
  const [assemblySpeakerLabels, setAssemblySpeakerLabels] = useState<boolean>(false);

  // Deepgram options
  const [deepgramOptions, setDeepgramOptions] = useState<DeepgramOptionsType>({
    model: 'nova-2',
    language_detection: true,
    speaker_labels: true,
    smart_formatting: true,
    profanity_filter: false,
    punctuation: true
  });

  const { user } = useAuthStore();
  const { addDialog, saveTranscription, saveSpeakerTranscription } = useDatabaseDialogs();

  const { 
    transcribe: transcribeAssembly, 
    isLoading: isAssemblyLoading, 
    progress: assemblyProgress, 
    error: assemblyError
  } = useSimplifiedTranscription();

  const { 
    transcribe: transcribeDeepgram, 
    isLoading: isDeepgramLoading, 
    progress: deepgramProgress, 
    error: deepgramError
  } = useDeepgramTranscription();

  const isTranscribing = isAssemblyLoading || isDeepgramLoading;
  const progress = provider === 'assemblyai' ? assemblyProgress : deepgramProgress;
  const transcriptionError = provider === 'assemblyai' ? assemblyError : deepgramError;

  const acceptedFileTypes: Accept = {
    'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac']
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setAudioFile(file);
    setTranscriptionResults(null);
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

    console.log(`Starting ${provider} transcription for file:`, audioFile.name);
    
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

      let result;
      
      if (provider === 'assemblyai') {
        result = await transcribeAssembly(audioFile, {
          speakerLabels: assemblySpeakerLabels,
          language: assemblyLanguage,
        });
        
        // Save transcription to database
        await saveTranscription(dialogId, result.text, 'plain');
        if (result.speakerUtterances && result.speakerUtterances.length > 0) {
          await saveSpeakerTranscription(dialogId, result.speakerUtterances, 'speaker');
        }

        // Format for display
        setTranscriptionResults({
          text: result.text,
          speakerUtterances: result.speakerUtterances
        });
      } else {
        result = await transcribeDeepgram(audioFile, deepgramOptions);
        
        // Save transcription to database
        await saveTranscription(dialogId, result.text, 'plain');
        if (result.speakerUtterances && result.speakerUtterances.length > 0) {
          await saveSpeakerTranscription(dialogId, result.speakerUtterances, 'speaker');
        }

        // Enhanced results with metadata
        setTranscriptionResults({
          text: result.text,
          speakerUtterances: result.speakerUtterances,
          detectedLanguage: result.detectedLanguage,
          metadata: result.metadata
        });
      }

      // Update dialog status to completed
      await addDialog({
        ...{
          fileName: audioFile.name,
          status: 'completed',
          assignedAgent: user.email || 'Unknown',
          assignedSupervisor: user.email || 'Unknown',
          uploadDate: new Date().toISOString(),
          tokenEstimation: {
            audioLengthMinutes: result.metadata?.duration || 0,
            estimatedCost: 0
          },
          isSegmented: false,
          currentLanguage: 'original'
        }
      });

      toast.success('Transcription completed successfully!');
      console.log('Transcription completed and saved to database');
    } catch (err: any) {
      console.error('Transcription failed', err);
      toast.error(`Transcription failed: ${err.message}`);
    }
  };

  const handleAssemblySpeakerLabelsChange = (checked: CheckedState) => {
    setAssemblySpeakerLabels(checked === true);
  };

  return (
    <div className="container mx-auto p-6">
      {/* Provider Selection */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Choose Transcription Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={provider} onValueChange={(value) => setProvider(value as 'assemblyai' | 'deepgram')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="assemblyai" className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                AssemblyAI
              </TabsTrigger>
              <TabsTrigger value="deepgram" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Deepgram
                <Badge variant="secondary" className="text-xs">Enhanced</Badge>
              </TabsTrigger>
            </TabsList>

            <div className="mt-4">
              {provider === 'assemblyai' && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Mic className="h-4 w-4" />
                    Universal Model
                  </div>
                  <div className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    Multi-language
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Speaker Labels
                  </div>
                </div>
              )}
              {provider === 'deepgram' && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4" />
                    Nova-2/3 Models
                  </div>
                  <div className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    Auto Language Detection
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Color-coded Speakers
                  </div>
                </div>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* File Upload */}
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

      {/* Provider-specific Options */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Transcription Options</CardTitle>
        </CardHeader>
        <CardContent>
          {provider === 'assemblyai' && (
            <div className="grid gap-4">
              <div className="grid grid-cols-3 items-center gap-4">
                <Label htmlFor="model" className="text-right">
                  Model
                </Label>
                <Select value={assemblyModel} onValueChange={setAssemblyModel}>
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
                <Select value={assemblyLanguage} onValueChange={setAssemblyLanguage}>
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
                <Checkbox id="speakerLabels" checked={assemblySpeakerLabels} onCheckedChange={handleAssemblySpeakerLabelsChange} />
                <Label htmlFor="speakerLabels">Speaker Labels</Label>
              </div>
            </div>
          )}

          {provider === 'deepgram' && (
            <DeepgramOptions
              options={deepgramOptions}
              onChange={setDeepgramOptions}
              disabled={isTranscribing}
            />
          )}
        </CardContent>
      </Card>

      {/* Action Button */}
      <div className="flex justify-center mb-4">
        <Button onClick={handleTranscribe} disabled={!audioFile || isTranscribing} size="lg">
          {isTranscribing ? `Transcribing with ${provider}...` : `Transcribe with ${provider}`}
        </Button>
      </div>

      {/* Progress */}
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

      {/* Error Display */}
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

      {/* Results - Enhanced for Deepgram */}
      {transcriptionResults && (
        <>
          {provider === 'deepgram' ? (
            <DeepgramResultsTabs
              transcription={transcriptionResults.text}
              speakerUtterances={transcriptionResults.speakerUtterances}
              detectedLanguage={transcriptionResults.detectedLanguage}
              metadata={transcriptionResults.metadata}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Transcription Result
                  <Badge variant="outline">{provider}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <textarea 
                  value={transcriptionResults.text} 
                  readOnly 
                  className="min-h-[200px] w-full p-3 border rounded-md resize-none"
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default Upload;
