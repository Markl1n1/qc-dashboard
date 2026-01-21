import React, { useState, useCallback } from 'react';
import { useDropzone, Accept } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { FileAudio, Upload, AlertCircle, Loader2 } from 'lucide-react';
import { Dialog as DialogType } from '../types';
import { useDeepgramTranscription } from '../hooks/useDeepgramTranscription';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';
import { DeepgramOptions } from '../types/deepgram';
import { serverAudioMergingService, ServerMergingProgress } from '../services/serverAudioMergingService';
import { toast } from 'sonner';

interface RetryTranscriptionDialogProps {
  dialog: DialogType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const RetryTranscriptionDialog: React.FC<RetryTranscriptionDialogProps> = ({
  dialog,
  open,
  onOpenChange,
  onSuccess
}) => {
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergingProgress, setMergingProgress] = useState<ServerMergingProgress | null>(null);

  const { updateDialog, saveTranscription, saveSpeakerTranscription } = useDatabaseDialogs();
  const { 
    transcribe: transcribeDeepgram, 
    isLoading: isDeepgramLoading, 
    progress: deepgramProgress 
  } = useDeepgramTranscription();

  const acceptedFileTypes: Accept = {
    'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.mp4', '.webm', '.mp2', '.opus']
  };

  const MAX_FILE_SIZE_GB = 2;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_GB * 1024 * 1024 * 1024;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const oversizedFiles = acceptedFiles.filter(f => f.size > MAX_FILE_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`).join(', ');
      toast.error(`Files too large (max ${MAX_FILE_SIZE_GB}GB): ${fileNames}`);
      const validFiles = acceptedFiles.filter(f => f.size <= MAX_FILE_SIZE_BYTES);
      if (validFiles.length > 0) {
        setAudioFiles(validFiles);
      }
      return;
    }
    setAudioFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    multiple: true,
  });

  const handleRetry = async () => {
    if (!dialog || audioFiles.length === 0) return;

    try {
      // Reset dialog status to processing
      await updateDialog(dialog.id, {
        status: 'processing',
        error: undefined
      });

      let fileToTranscribe: File;

      // If multiple files, merge them first
      if (audioFiles.length > 1) {
        setIsMerging(true);
        setMergingProgress(null);

        serverAudioMergingService.setProgressCallback((progress) => {
          setMergingProgress(progress);
        });

        fileToTranscribe = await serverAudioMergingService.mergeAudioFiles(audioFiles);
        setIsMerging(false);
      } else {
        fileToTranscribe = audioFiles[0];
      }

      // Prepare Deepgram options
      const deepgramOptions: DeepgramOptions = {
        model: 'nova-2-general',
        language: 'en',
        speaker_labels: true,
        smart_formatting: true,
        profanity_filter: false,
        punctuation: true
      };

      const result = await transcribeDeepgram(fileToTranscribe, deepgramOptions);

      // Save transcription to database
      await saveTranscription(dialog.id, result.text, 'plain');
      if (result.speakerUtterances && result.speakerUtterances.length > 0) {
        await saveSpeakerTranscription(dialog.id, result.speakerUtterances, 'speaker');
      }

      // Update dialog status to completed
      const audioDurationMinutes = (result as any).audioDurationMinutes || 0;
      await updateDialog(dialog.id, {
        status: 'completed',
        audioLengthMinutes: audioDurationMinutes,
        error: undefined
      });

      toast.success('Transcription completed successfully!');
      setAudioFiles([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error('Retry transcription failed', err);
      toast.error(`Retry failed: ${err.message}`);

      // Update dialog with new error
      if (dialog) {
        await updateDialog(dialog.id, {
          status: 'failed',
          error: err.message
        });
      }
    } finally {
      setIsMerging(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setAudioFiles([]);
      onOpenChange(false);
    }
  };

  const isProcessing = isMerging || isDeepgramLoading;

  if (!dialog) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Retry Transcription
          </DialogTitle>
          <DialogDescription>
            Upload the audio file again to retry transcription for "{dialog.fileName}"
          </DialogDescription>
        </DialogHeader>

        {/* Error info */}
        {dialog.error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Previous error:</p>
              <p className="text-xs text-destructive/80 mt-1">{dialog.error}</p>
            </div>
          </div>
        )}

        {/* File dropzone */}
        {!isProcessing && (
          <div 
            {...getRootProps()} 
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-md cursor-pointer bg-muted hover:bg-accent transition-colors"
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <p className="text-sm">Drop the audio files here...</p>
            ) : (
              <div className="text-center px-4">
                <FileAudio className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm">Drag & drop audio files, or click to select</p>
                {audioFiles.length > 0 && (
                  <p className="text-xs text-primary mt-2">
                    {audioFiles.length} file(s) selected
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Selected files list */}
        {audioFiles.length > 0 && !isProcessing && (
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">Selected files:</p>
            <ul className="list-disc list-inside space-y-1">
              {audioFiles.map((file, i) => (
                <li key={i} className="truncate text-xs">
                  {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Progress indicators */}
        {isMerging && mergingProgress && (
          <div className="space-y-2">
            <p className="text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {mergingProgress.message}
            </p>
            <Progress value={mergingProgress.progress} />
          </div>
        )}

        {isDeepgramLoading && deepgramProgress && (
          <div className="space-y-2">
            <p className="text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {deepgramProgress.message}
            </p>
            <Progress value={deepgramProgress.progress} />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleRetry}
            disabled={audioFiles.length === 0 || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Retry Transcription'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RetryTranscriptionDialog;
