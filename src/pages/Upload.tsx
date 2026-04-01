
import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone, Accept } from 'react-dropzone';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { useDeepgramTranscription } from '../hooks/useDeepgramTranscription';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { Mic, User, FileAudio, AlertCircle, Volume2 } from 'lucide-react';
import { DeepgramOptions } from '../types/deepgram';
import { SpeakerUtterance } from '../types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { databaseService } from '../services/databaseService';
import AgentSelector from '../components/AgentSelector';
import DraggableFileList from '../components/DraggableFileList';
import MultiFileTranscriptionProgress from '../components/MultiFileTranscriptionProgress';
import LanguageSelector from '../components/LanguageSelector';
import AudioQualityIndicator from '../components/AudioQualityIndicator';
import { serverAudioMergingService, ServerMergingProgress } from '../services/serverAudioMergingService';
import { generateFileName } from '../utils/hashGenerator';
import { deepgramService } from '../services/deepgramService';
import { analyzeAudioSignal, AudioSignalMetrics } from '../utils/audioSignalAnalysis';

interface UploadProps {}

const Upload: React.FC<UploadProps> = () => {
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [agentName, setAgentName] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [isMerging, setIsMerging] = useState(false);
  const [mergingProgress, setMergingProgress] = useState<ServerMergingProgress | null>(null);
  const [signalMetrics, setSignalMetrics] = useState<AudioSignalMetrics | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const navigate = useNavigate();

  const { user } = useAuthStore();
  const { noiseReduction, setNoiseReduction } = useSettingsStore();
  const { addDialog, updateDialog, saveTranscription, saveSpeakerTranscription } = useDatabaseDialogs();

  const { 
    transcribe: transcribeDeepgram, 
    isLoading: isDeepgramLoading, 
    progress: deepgramProgress, 
    error: deepgramError
  } = useDeepgramTranscription();

  const acceptedFileTypes: Accept = {
    'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.mp4', '.webm', '.mp2', '.opus']
  };

  const MAX_FILE_SIZE_GB = 2;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_GB * 1024 * 1024 * 1024;

  // Run audio signal analysis when files change
  useEffect(() => {
    if (audioFiles.length === 0) {
      setSignalMetrics(null);
      return;
    }

    const runAnalysis = async () => {
      setIsAnalyzingAudio(true);
      try {
        // Analyze first file (or if single file — that one)
        const fileToAnalyze = audioFiles[0];
        const metrics = await analyzeAudioSignal(fileToAnalyze);
        setSignalMetrics(metrics);
      } catch (e) {
        console.warn('Audio analysis failed:', e);
        setSignalMetrics(null);
      } finally {
        setIsAnalyzingAudio(false);
      }
    };

    runAnalysis();
  }, [audioFiles]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const oversizedFiles = acceptedFiles.filter(f => f.size > MAX_FILE_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`).join(', ');
      toast.error(`Files too large (max ${MAX_FILE_SIZE_GB}GB): ${fileNames}`);
      const validFiles = acceptedFiles.filter(f => f.size <= MAX_FILE_SIZE_BYTES);
      if (validFiles.length > 0) {
        setAudioFiles(prev => [...prev, ...validFiles]);
      }
      return;
    }
    
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

    deepgramService.setNoiseReduction(noiseReduction);

    console.log('Starting transcription for files:', audioFiles.map(f => f.name));
    
    let dialogId: string | null = null;
    
    try {
      const originalFileName = audioFiles.length === 1 
        ? audioFiles[0].name 
        : `merged_${audioFiles.length}_files.mp3`;
      
      const newFileName = generateFileName(agentName.trim(), originalFileName);

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

      // Save audio quality metrics to dialog if available
      if (signalMetrics && dialogId) {
        try {
          const { supabase } = await import('../integrations/supabase/client');
          await (supabase as any).from('dialogs').update({
            audio_quality_metrics: signalMetrics
          }).eq('id', dialogId);
        } catch (e) {
          console.warn('Failed to save audio quality metrics:', e);
        }
      }

      let fileToTranscribe: File;

      if (audioFiles.length > 1) {
        console.log('Multiple files detected, merging on server...');
        
        setIsMerging(true);
        setMergingProgress(null);

        serverAudioMergingService.setProgressCallback((progress) => {
          setMergingProgress(progress);
        });

        fileToTranscribe = await serverAudioMergingService.mergeAudioFiles(audioFiles);
        setIsMerging(false);
        console.log('Files merged successfully:', fileToTranscribe.name);
      } else {
        fileToTranscribe = audioFiles[0];
      }

      const deepgramOptions: DeepgramOptions = {
        model: 'nova-2-general',
        language: selectedLanguage,
        speaker_labels: true,
        smart_formatting: true,
        profanity_filter: false,
        punctuation: true
      };

      const result = await transcribeDeepgram(fileToTranscribe, deepgramOptions);
      
      await saveTranscription(dialogId, result.text, 'plain');
      if (result.speakerUtterances && result.speakerUtterances.length > 0) {
        await saveSpeakerTranscription(dialogId, result.speakerUtterances, 'speaker');
        
        // Auto-validate diarization
        try {
          const { data: diarizationResult, error: diarizationError } = await supabase.functions.invoke('diarization-fix', {
            body: { utterances: result.speakerUtterances }
          });

          if (!diarizationError && diarizationResult?.success && diarizationResult.needs_correction) {
            // Get transcription_id from database
            const transcriptions = await databaseService.getTranscriptions(dialogId);
            const speakerTranscription = transcriptions.find(t => t.transcription_type === 'speaker');
            if (speakerTranscription) {
            const corrections = diarizationResult.corrected_utterances.map((u: any, i: number) => ({
              utterance_order: i,
              speaker: u.speaker
            }));
            const updatedCount = await databaseService.updateUtteranceSpeakers(transcriptionId, corrections);
            if (updatedCount > 0) {
              toast.success(`Diarization corrected: ${updatedCount} speaker fixes applied`);
            }
          } else if (diarizationError) {
            console.warn('Diarization validation failed:', diarizationError);
          }
        } catch (diarizationErr) {
          console.warn('Diarization validation error (non-blocking):', diarizationErr);
        }
      }

      const audioDurationMinutes = (result as any).audioDurationMinutes || 0;
      await updateDialog(dialogId, {
        status: 'completed',
        audioLengthMinutes: audioDurationMinutes
      });
      
      console.log('Dialog updated with audio duration:', audioDurationMinutes, 'minutes');

      toast.success('Transcription completed successfully!');
      navigate(`/dialog/${dialogId}`);
    } catch (err: any) {
      console.error('Transcription failed', err);
      toast.error(`Transcription failed: ${err.message}`);
      
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

      {/* Language Selection & Noise Reduction */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LanguageSelector
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Noise Reduction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="noise-reduction" className="font-medium">RNNoise denoising</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Remove background noise before transcription to improve diarization quality
                </p>
              </div>
              <Switch
                id="noise-reduction"
                checked={noiseReduction}
                onCheckedChange={setNoiseReduction}
              />
            </div>
          </CardContent>
        </Card>
      </div>

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
                <p className="text-xs text-muted-foreground mt-1">
                  Max file size: 2GB per file
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

          {/* Audio Quality Analysis */}
          {(isAnalyzingAudio || signalMetrics) && audioFiles.length > 0 && (
            <div className="mt-4">
              <AudioQualityIndicator
                signalMetrics={signalMetrics}
                isAnalyzing={isAnalyzingAudio}
              />
            </div>
          )}

          {/* Server-side merging info */}
          {audioFiles.length > 1 && (
            <div className="mt-4 p-3 bg-accent border border-border rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Server-side audio merging</p>
                  <p className="text-muted-foreground">
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
            <p className="text-destructive">{deepgramError}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Upload;
