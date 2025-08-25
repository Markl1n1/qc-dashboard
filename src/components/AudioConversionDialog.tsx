
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { AudioMetadata, analyzeAudioFile } from '../utils/audioMetadataUtils';
import { audioConversionService, ConversionOptions, ConversionProgress } from '../services/audioConversionService';
import AudioQualityIndicator from './AudioQualityIndicator';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface AudioConversionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file: File;
  metadata: AudioMetadata;
  onConversionComplete: (convertedFile: File) => void;
}

const AudioConversionDialog: React.FC<AudioConversionDialogProps> = ({
  isOpen,
  onClose,
  file,
  metadata,
  onConversionComplete
}) => {
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [targetSampleRate, setTargetSampleRate] = useState('16000');
  const [conversionSupported, setConversionSupported] = useState(false);
  const [supportReason, setSupportReason] = useState<string>('');
  const [conversionResult, setConversionResult] = useState<{ 
    success: boolean; 
    file?: File; 
    newMetadata?: AudioMetadata;
    error?: string;
  } | null>(null);

  useEffect(() => {
    // Check if conversion is supported in this environment
    const supportInfo = audioConversionService.getConversionInfo();
    setConversionSupported(supportInfo.supported);
    
    if (!supportInfo.supported) {
      setSupportReason(supportInfo.reason || 'Audio conversion not available');
      console.warn('Audio conversion not supported:', supportInfo.reason);
    }
  }, []);

  const handleConvert = async () => {
    setIsConverting(true);
    setConversionResult(null);
    
    try {
      audioConversionService.setProgressCallback(setProgress);
      
      const options: ConversionOptions = {
        targetSampleRate: parseInt(targetSampleRate),
        targetBitDepth: 16,
        targetChannels: Math.min(2, metadata.channels || 1)
      };
      
      const convertedFile = await audioConversionService.convertAudioFile(file, options);
      
      // Re-analyze the converted file to verify the conversion
      const newMetadata = await analyzeAudioFile(convertedFile);
      
      if (newMetadata) {
        console.log('[AudioConversionDialog] Post-conversion metadata:', newMetadata);
        
        setConversionResult({
          success: true,
          file: convertedFile,
          newMetadata
        });
      } else {
        setConversionResult({
          success: false,
          error: 'Could not analyze converted file'
        });
      }
    } catch (error) {
      console.error('Conversion failed:', error);
      setConversionResult({
        success: false,
        error: error instanceof Error ? error.message : 'Conversion failed'
      });
    } finally {
      setIsConverting(false);
      setProgress(null);
    }
  };

  const handleUseConverted = () => {
    if (conversionResult?.file) {
      onConversionComplete(conversionResult.file);
      onClose();
    }
  };

  const handleSkip = () => {
    onConversionComplete(file);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Audio Quality & Conversion</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Conversion Support Check */}
          {!conversionSupported && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {supportReason}
              </AlertDescription>
            </Alert>
          )}

          <div>
            <h4 className="font-medium mb-2">Original Audio</h4>
            <AudioQualityIndicator metadata={metadata} showDetails />
          </div>
          
          {!metadata.isOptimalForTranscription && !conversionResult && conversionSupported && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sampleRate">Target Sample Rate</Label>
                <Select value={targetSampleRate} onValueChange={setTargetSampleRate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16000">16,000 Hz (Recommended for Speech)</SelectItem>
                    <SelectItem value="22050">22,050 Hz (Higher Quality)</SelectItem>
                    <SelectItem value="44100">44,100 Hz (CD Quality)</SelectItem>
                    <SelectItem value="48000">48,000 Hz (Professional)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {isConverting && progress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{progress.message}</span>
                    <span>{progress.progress}%</span>
                  </div>
                  <Progress value={progress.progress} />
                </div>
              )}
            </div>
          )}

          {/* Conversion Result */}
          {conversionResult && (
            <div className="space-y-4">
              {conversionResult.success && conversionResult.newMetadata ? (
                <div className="space-y-3">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Audio conversion completed successfully!
                    </AlertDescription>
                  </Alert>
                  
                  <div>
                    <h4 className="font-medium mb-2">Converted Audio</h4>
                    <AudioQualityIndicator metadata={conversionResult.newMetadata} showDetails />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Original Size:</div>
                      <div>{Math.round(file.size / 1024)} KB</div>
                    </div>
                    <div>
                      <div className="font-medium">Converted Size:</div>
                      <div>{Math.round(conversionResult.file!.size / 1024)} KB</div>
                    </div>
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Conversion failed: {conversionResult.error}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter>
          {!conversionResult ? (
            // Before conversion
            !metadata.isOptimalForTranscription && conversionSupported ? (
              <>
                <Button variant="outline" onClick={handleSkip} disabled={isConverting}>
                  Use Original
                </Button>
                <Button onClick={handleConvert} disabled={isConverting}>
                  {isConverting ? 'Converting...' : 'Convert Audio'}
                </Button>
              </>
            ) : (
              <Button onClick={handleSkip}>
                Use File
              </Button>
            )
          ) : (
            // After conversion
            conversionResult.success ? (
              <>
                <Button variant="outline" onClick={handleSkip}>
                  Use Original
                </Button>
                <Button onClick={handleUseConverted}>
                  Use Converted
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setConversionResult(null)}>
                  Try Again
                </Button>
                <Button onClick={handleSkip}>
                  Use Original
                </Button>
              </>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AudioConversionDialog;
