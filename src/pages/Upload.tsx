import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Upload as UploadIcon, FileAudio, X, Settings, CheckCircle, AlertTriangle, Loader2, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useDialogStore } from '../store/dialogStore';
import { useAssemblyAI } from '../hooks/useAssemblyAI';
import { TranscriptionProvider, AssemblyAIConfig } from '../types';
import ApiKeyInput from '../components/ApiKeyInput';
import TranscriptionProgress from '../components/TranscriptionProgress';
import AudioQualityIndicator from '../components/AudioQualityIndicator';
import AudioConversionDialog from '../components/AudioConversionDialog';
import DraggableFileList from '../components/DraggableFileList';
import MultiFileTranscriptionProgress from '../components/MultiFileTranscriptionProgress';
import UploadProgressTracker from '../components/UploadProgressTracker';
import { AudioMetadata, analyzeAudioFile } from '../utils/audioMetadataUtils';
import { audioConversionService } from '../services/audioConversionService';
import { simpleApiKeyService } from '../services/simpleApiKeyService';
import { v4 as uuidv4 } from 'uuid';

interface FileWithMetadata {
  file: File;
  id: string;
  metadata?: AudioMetadata | null;
}

interface FileUploadProgress {
  fileName: string;
  stages: Array<{
    id: string;
    name: string;
    status: 'pending' | 'in-progress' | 'complete' | 'error';
    message?: string;
    progress?: number;
  }>;
  overallProgress: number;
}

const Upload = () => {
  const navigate = useNavigate();
  const { addDialog, updateDialog } = useDialogStore();
  const { transcribe, validateApiKey, isLoading, progress, error } = useAssemblyAI();

  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [uploading, setUploading] = useState(false);
  const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider>('assemblyai');
  // Use hardcoded API key for testing
  const [apiKey, setApiKey] = useState(simpleApiKeyService.getAPIKey('assemblyai') || '');
  const [speakerLabels, setSpeakerLabels] = useState(true);
  const [speakersExpected, setSpeakersExpected] = useState(2);
  const [languageDetection, setLanguageDetection] = useState(true);
  const [zeroDataRetention, setZeroDataRetention] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [conversionDialogFile, setConversionDialogFile] = useState<{ file: File; metadata: AudioMetadata } | null>(null);
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());
  const [multiFileProgress, setMultiFileProgress] = useState<Record<string, any>>({});
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[]>([]);

  // Check conversion support status - now includes Web Audio API
  const conversionSupported = audioConversionService.isConversionSupported();
  const conversionInfo = audioConversionService.getConversionInfo();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles = await Promise.all(
      acceptedFiles.map(async (file) => {
        const id = `${file.name}-${Date.now()}-${Math.random()}`;
        const metadata = await analyzeAudioFile(file);
        return { file, id, metadata };
      })
    );
    
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac', '.webm', '.3gp', '.amr', '.wma']
    },
    multiple: true
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleFileReorder = (reorderedFiles: FileWithMetadata[]) => {
    setFiles(reorderedFiles);
  };

  const handleConversionComplete = (originalId: string, convertedFile: File) => {
    setFiles(prev => prev.map(f => 
      f.id === originalId 
        ? { ...f, file: convertedFile }
        : f
    ));
    setConversionDialogFile(null);
  };

  const createUploadStages = async (fileName: string, file: File): Promise<FileUploadProgress> => {
    const stages = [
      {
        id: 'validation',
        name: 'File Validation',
        status: 'pending' as const,
        message: 'Validating audio file format and quality'
      }
    ];

    // Add conversion stage for files that need it
    const shouldConvert = await audioConversionService.shouldConvertWav(file);
    if (shouldConvert.shouldConvert) {
      stages.push({
        id: 'conversion',
        name: 'Audio Optimization',
        status: 'pending' as const,
        message: 'Optimizing audio for transcription'
      });
    }

    stages.push(
      {
        id: 'upload',
        name: 'Uploading to Transcriber',
        status: 'pending' as const,
        message: 'Uploading audio file to AssemblyAI'
      },
      {
        id: 'transcription',
        name: 'Transcribing Audio',
        status: 'pending' as const,
        message: 'Processing speech-to-text conversion'
      }
    );

    return {
      fileName,
      stages,
      overallProgress: 0
    };
  };

  const updateUploadProgress = (fileName: string, stageId: string, status: 'pending' | 'in-progress' | 'complete' | 'error', message?: string, progress?: number) => {
    setUploadProgress(prev => 
      prev.map(fileProgress => {
        if (fileProgress.fileName !== fileName) return fileProgress;

        const updatedStages = fileProgress.stages.map(stage => {
          if (stage.id === stageId) {
            return { ...stage, status, message, progress };
          }
          return stage;
        });

        // Calculate overall progress
        const completedStages = updatedStages.filter(s => s.status === 'complete').length;
        const inProgressStages = updatedStages.filter(s => s.status === 'in-progress');
        const currentProgress = inProgressStages.length > 0 && inProgressStages[0].progress 
          ? inProgressStages[0].progress / 100 
          : 0;
        const overallProgress = ((completedStages + currentProgress) / updatedStages.length) * 100;

        return {
          ...fileProgress,
          stages: updatedStages,
          overallProgress
        };
      })
    );
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one audio file');
      return;
    }

    if (!apiKey) {
      toast.error('API key not configured');
      return;
    }

    if (!validateApiKey(apiKey)) {
      toast.error('Invalid API key format');
      return;
    }

    setUploading(true);
    const processingIds = new Set<string>();

    try {
      // Initialize progress tracking for all files
      const progressTrackers = await Promise.all(
        files.map(async (fileWithMetadata) => {
          return await createUploadStages(fileWithMetadata.file.name, fileWithMetadata.file);
        })
      );
      setUploadProgress(progressTrackers);

      for (const fileWithMetadata of files) {
        let { file } = fileWithMetadata;
        const { id, metadata } = fileWithMetadata;
        const fileName = file.name;

        processingIds.add(id);
        setProcessingFiles(new Set(processingIds));

        try {
          // Stage 1: Validation
          updateUploadProgress(fileName, 'validation', 'in-progress', 'Validating file format...', 0);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const shouldConvert = await audioConversionService.shouldConvertWav(file);
          
          if (shouldConvert.shouldConvert) {
            updateUploadProgress(fileName, 'validation', 'complete', shouldConvert.reason || 'Validation complete');
            
            // Stage 2: Conversion (if needed)
            updateUploadProgress(fileName, 'conversion', 'in-progress', 'Converting audio for optimal transcription...', 0);
            
            try {
              file = await audioConversionService.convertWavToOptimalMp3(file, shouldConvert.currentSampleRate);
              updateUploadProgress(fileName, 'conversion', 'complete', 'Audio optimization complete');
              toast.success(`${fileName}: Audio optimized for transcription`);
            } catch (conversionError) {
              console.warn(`Conversion failed for ${fileName}, using original:`, conversionError);
              updateUploadProgress(fileName, 'conversion', 'complete', 'Using original file - AssemblyAI will handle optimization');
              toast.info(`${fileName}: Using original file - AssemblyAI will optimize automatically`);
            }
          } else {
            updateUploadProgress(fileName, 'validation', 'complete', 'File validation complete - optimal quality detected');
          }

          // Stage 3: Upload
          updateUploadProgress(fileName, 'upload', 'in-progress', 'Uploading to AssemblyAI...', 0);

          const assemblyAIConfig: AssemblyAIConfig = {
            apiKey,
            speaker_labels: speakerLabels,
            speakers_expected: speakersExpected,
            language_detection: languageDetection,
            zeroDataRetention
          };

          // Create dialog with all required properties
          const dialogId = uuidv4();
          addDialog({
            id: dialogId,
            fileName: file.name,
            status: 'processing',
            assignedAgent: 'System',
            assignedSupervisor: 'Auto',
            uploadDate: new Date().toISOString()
          });

          updateUploadProgress(fileName, 'upload', 'complete', 'Upload complete');

          // Stage 4: Transcription
          updateUploadProgress(fileName, 'transcription', 'in-progress', 'Transcribing audio...', 0);

          // Process the dialog using transcription service
          try {
            const result = await transcribe(file, assemblyAIConfig);
            
            // Update dialog with transcription results
            updateDialog(dialogId, {
              status: 'completed',
              transcription: result.text,
              speakerTranscription: result.speakerUtterances || []
            });

            updateUploadProgress(fileName, 'transcription', 'complete', 'Transcription complete');
            toast.success(`${file.name} has been transcribed successfully`);
            
          } catch (transcriptionError) {
            console.error('Transcription error:', transcriptionError);
            updateDialog(dialogId, {
              status: 'failed',
              error: transcriptionError instanceof Error ? transcriptionError.message : 'Transcription failed'
            });
            throw transcriptionError;
          }

        } catch (fileError) {
          console.error(`Failed to process ${fileName}:`, fileError);
          
          // Mark current stage as error
          const currentStage = progressTrackers.find(p => p.fileName === fileName)?.stages.find(s => s.status === 'in-progress')?.id || 'upload';
          updateUploadProgress(fileName, currentStage, 'error', `Error: ${fileError instanceof Error ? fileError.message : 'Processing failed'}`);
          
          toast.error(`Failed to process ${fileName}`);
        }

        processingIds.delete(id);
        setProcessingFiles(new Set(processingIds));
      }

      // Clear files and redirect after successful processing
      setFiles([]);
      setUploadProgress([]);
      navigate('/');
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
      setProcessingFiles(new Set());
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload Audio Files</h1>
          <p className="text-muted-foreground mt-2">
            Upload your audio files for transcription and analysis
          </p>
        </div>
      </div>

      {/* Audio Conversion Status */}
      {!conversionSupported ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Audio Conversion Notice:</strong> {conversionInfo.reason}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Audio Optimization Available:</strong> WAV files will be automatically optimized for transcription quality using Web Audio API.
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Progress Section */}
      {uploadProgress.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Processing Files</h2>
          {uploadProgress.map((progress) => (
            <UploadProgressTracker
              key={progress.fileName}
              fileName={progress.fileName}
              stages={progress.stages}
              overallProgress={progress.overallProgress}
            />
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* File Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadIcon className="h-5 w-5" />
                Select Audio Files
              </CardTitle>
              <CardDescription>
                Drag and drop your audio files here, or click to browse. Supports MP3, WAV, M4A, FLAC, and more.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                `}
              >
                <input {...getInputProps()} />
                <UploadIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                {isDragActive ? (
                  <p className="text-lg">Drop the files here...</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-lg">Drag & drop audio files here</p>
                    <p className="text-sm text-muted-foreground">or click to select files</p>
                  </div>
                )}
              </div>

              {files.length > 0 && (
                <div className="mt-6">
                  <DraggableFileList
                    files={files.map(f => f.file)}
                    onRemove={(index) => {
                      const fileId = files[index]?.id;
                      if (fileId) removeFile(fileId);
                    }}
                    onReorder={(reorderedFiles) => {
                      const reorderedWithMetadata = reorderedFiles.map((file, index) => {
                        const existingFileData = files.find(f => f.file.name === file.name && f.file.size === file.size);
                        return existingFileData || { file, id: `${file.name}-${Date.now()}-${index}` };
                      });
                      handleFileReorder(reorderedWithMetadata);
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* API Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>AssemblyAI API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Hardcoded for testing"
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  API key is hardcoded for testing purposes
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Transcription Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="speaker-labels">Speaker Detection</Label>
                <Switch
                  id="speaker-labels"
                  checked={speakerLabels}
                  onCheckedChange={setSpeakerLabels}
                />
              </div>

              {speakerLabels && (
                <div className="space-y-2">
                  <Label>Expected Speakers</Label>
                  <Select
                    value={speakersExpected.toString()}
                    onValueChange={(value) => setSpeakersExpected(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} speakers
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="language-detection">Auto Language Detection</Label>
                <Switch
                  id="language-detection"
                  checked={languageDetection}
                  onCheckedChange={setLanguageDetection}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="zero-data-retention">Zero Data Retention</Label>
                <Switch
                  id="zero-data-retention"
                  checked={zeroDataRetention}
                  onCheckedChange={setZeroDataRetention}
                />
              </div>
            </CardContent>
          </Card>

          {/* Process Button */}
          <Button
            onClick={handleSubmit}
            disabled={files.length === 0 || uploading || !apiKey}
            className="w-full"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Files...
              </>
            ) : (
              <>
                <UploadIcon className="mr-2 h-4 w-4" />
                Process {files.length} {files.length === 1 ? 'File' : 'Files'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Conversion Dialog */}
      {conversionDialogFile && (
        <AudioConversionDialog
          isOpen={true}
          onClose={() => setConversionDialogFile(null)}
          file={conversionDialogFile.file}
          metadata={conversionDialogFile.metadata}
          onConversionComplete={(convertedFile) => {
            handleConversionComplete(conversionDialogFile.file.name, convertedFile);
          }}
        />
      )}
    </div>
  );
};

export default Upload;
