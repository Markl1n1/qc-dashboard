import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { 
  Upload, 
  FileAudio, 
  Settings, 
  Key,
  Globe,
  Zap,
  AlertCircle
} from 'lucide-react';
import { useEnhancedTranscription } from '../hooks/useEnhancedTranscription';
import { AssemblyAIEnhancedOptions, AssemblyAIRegion } from '../types/assemblyai';
import EnhancedTranscriptionOptions from '../components/EnhancedTranscriptionOptions';
import EnhancedTranscriptionResults from '../components/EnhancedTranscriptionResults';
import ApiKeyManager from '../components/ApiKeyManager';
import AssemblyAIRegionSelector from '../components/AssemblyAIRegionSelector';
import SpeakerTimelineView from '../components/SpeakerTimelineView';
import AdvancedLanguageDetection from '../components/AdvancedLanguageDetection';
import { EnhancedAssemblyAIResult } from '../services/enhancedAssemblyAIService';
import { AssemblyAIKeyManager } from '../services/assemblyaiKeyManager';
import { toast } from 'sonner';

const EnhancedTranscription: React.FC = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [result, setResult] = useState<EnhancedAssemblyAIResult | null>(null);
  const [options, setOptions] = useState<AssemblyAIEnhancedOptions>({
    speech_model: 'universal-2',
    language_detection: true,
    disfluencies: true,
    speaker_labels: false,
    content_safety_labels: false,
    entity_detection: false,
    sentiment_analysis: false,
    auto_chapters: false,
    summarization: false
  });
  const [activeTab, setActiveTab] = useState('upload');

  const { 
    transcribe, 
    setRegion,
    getCurrentRegion,
    isLoading, 
    progress, 
    error 
  } = useEnhancedTranscription();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setAudioFile(file);
      setResult(null);
      setActiveTab('upload');
      console.log('Audio file selected:', file.name);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.webm']
    },
    multiple: false,
    maxSize: 5 * 1024 * 1024 * 1024 // 5GB limit
  });

  const handleTranscribe = async () => {
    if (!audioFile) {
      toast.error('Please select an audio file first');
      return;
    }

    // Check if we have any API keys
    const activeKey = AssemblyAIKeyManager.getActiveKey(getCurrentRegion());
    if (!activeKey) {
      toast.error('No active API keys found. Please add an AssemblyAI API key.');
      setActiveTab('settings');
      return;
    }

    try {
      console.log('Starting enhanced transcription with options:', options);
      const transcriptionResult = await transcribe(audioFile, options);
      setResult(transcriptionResult);
      setActiveTab('results');
      toast.success('Transcription completed successfully!');
    } catch (err: any) {
      console.error('Enhanced transcription failed:', err);
      toast.error(`Transcription failed: ${err.message}`);
    }
  };

  const handleDownload = (format: 'json' | 'txt' | 'srt') => {
    if (!result) return;

    let content = '';
    let filename = '';
    let mimeType = '';

    switch (format) {
      case 'json':
        content = JSON.stringify(result, null, 2);
        filename = `transcription-${Date.now()}.json`;
        mimeType = 'application/json';
        break;
      case 'txt':
        content = result.text;
        filename = `transcription-${Date.now()}.txt`;
        mimeType = 'text/plain';
        break;
      case 'srt':
        // Convert speaker utterances to SRT format
        content = result.speakerUtterances.map((utterance, index) => {
          const start = new Date(utterance.start * 1000).toISOString().substr(11, 12);
          const end = new Date(utterance.end * 1000).toISOString().substr(11, 12);
          return `${index + 1}\n${start} --> ${end}\n[${utterance.speaker}] ${utterance.text}\n`;
        }).join('\n');
        filename = `transcription-${Date.now()}.srt`;
        mimeType = 'text/plain';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Downloaded ${format.toUpperCase()} file`);
  };

  const getFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const hasActiveKeys = AssemblyAIKeyManager.getAllKeys().some(key => key.isActive);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Enhanced Audio Transcription</h1>
        <p className="text-muted-foreground">
          Advanced transcription with speaker diarization, language detection, and AI analysis
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="options" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Options
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger 
            value="results" 
            disabled={!result}
            className="flex items-center gap-2"
          >
            <FileAudio className="h-4 w-4" />
            Results
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <div className="space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">Region</p>
                      <p className="text-sm text-muted-foreground">
                        {getCurrentRegion().toUpperCase()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Key className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">API Keys</p>
                      <p className="text-sm text-muted-foreground">
                        {hasActiveKeys ? 'Configured' : 'Not Set'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="font-medium">Model</p>
                      <p className="text-sm text-muted-foreground">
                        {options.speech_model || 'universal-2'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Audio File</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`
                    flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                    ${isDragActive 
                      ? 'border-primary bg-primary/10' 
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent'
                    }
                  `}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <FileAudio className="h-12 w-12 text-muted-foreground" />
                    {isDragActive ? (
                      <p className="text-lg font-medium">Drop the audio file here...</p>
                    ) : (
                      <div className="text-center">
                        <p className="text-lg font-medium mb-2">
                          Drag & drop an audio file, or click to select
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Supports MP3, WAV, M4A, AAC, OGG, FLAC, WebM (max 5GB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {audioFile && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{audioFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {getFileSize(audioFile.size)} • {audioFile.type}
                        </p>
                      </div>
                      <Badge variant="outline">Ready</Badge>
                    </div>
                  </div>
                )}

                {!hasActiveKeys && (
                  <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <p className="text-sm text-orange-800">
                        <strong>API Key Required:</strong> Please add an AssemblyAI API key in the Settings tab before transcribing.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Progress */}
            {progress && (
              <Card>
                <CardHeader>
                  <CardTitle>Transcription Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{progress.message}</span>
                      <span>{progress.progress}%</span>
                    </div>
                    <Progress value={progress.progress} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error Display */}
            {error && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">Transcription Error</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setActiveTab('options')}
                disabled={isLoading}
              >
                Configure Options
              </Button>
              
              <Button
                onClick={handleTranscribe}
                disabled={!audioFile || isLoading || !hasActiveKeys}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Zap className="h-4 w-4 animate-spin" />
                    Transcribing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Start Transcription
                  </>
                )}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Options Tab */}
        <TabsContent value="options">
          <div className="space-y-6">
            <AdvancedLanguageDetection
              autoDetection={options.language_detection !== false}
              onAutoDetectionChange={(enabled) => 
                setOptions({ ...options, language_detection: enabled, language_code: enabled ? undefined : options.language_code })
              }
              selectedLanguage={options.language_code}
              onLanguageChange={(language) => 
                setOptions({ ...options, language_code: language })
              }
            />
            
            <EnhancedTranscriptionOptions
              options={options}
              onChange={setOptions}
              disabled={isLoading}
            />
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="space-y-6">
            <AssemblyAIRegionSelector
              selectedRegion={getCurrentRegion()}
              onRegionChange={setRegion}
              disabled={isLoading}
            />
            
            <ApiKeyManager />
          </div>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results">
          {result ? (
            <div className="space-y-6">
              <Tabs defaultValue="transcript" className="w-full">
                <TabsList>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="timeline" disabled={result.speakerUtterances.length === 0}>
                    Speaker Timeline
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="transcript">
                  <EnhancedTranscriptionResults
                    result={result}
                    onDownload={handleDownload}
                  />
                </TabsContent>
                
                <TabsContent value="timeline">
                  <SpeakerTimelineView
                    utterances={result.speakerUtterances}
                  />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileAudio className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">No Results Yet</p>
                <p className="text-muted-foreground">
                  Upload and transcribe an audio file to see results here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedTranscription;
