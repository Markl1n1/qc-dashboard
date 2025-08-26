
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Mic, Users, Globe, Shield, Brain, FileText, Zap } from 'lucide-react';
import { AssemblyAIEnhancedOptions, AssemblyAIModel, PIIPolicy } from '../types/assemblyai';

interface EnhancedTranscriptionOptionsProps {
  options: AssemblyAIEnhancedOptions;
  onChange: (options: AssemblyAIEnhancedOptions) => void;
  disabled?: boolean;
}

const EnhancedTranscriptionOptions: React.FC<EnhancedTranscriptionOptionsProps> = ({
  options,
  onChange,
  disabled = false
}) => {
  const updateOption = <K extends keyof AssemblyAIEnhancedOptions>(
    key: K,
    value: AssemblyAIEnhancedOptions[K]
  ) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div className="space-y-6">
      {/* Core Audio Processing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Core Audio Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Speech Model</Label>
              <p className="text-sm text-muted-foreground">
                Choose between accuracy and speed
              </p>
            </div>
            <Select
              value={options.speech_model || 'universal-2'}
              onValueChange={(value) => updateOption('speech_model', value as AssemblyAIModel)}
              disabled={disabled}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="universal-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Recommended</Badge>
                    Universal-2
                  </div>
                </SelectItem>
                <SelectItem value="nano">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Nano (Fast)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Include Disfluencies</Label>
              <p className="text-sm text-muted-foreground">
                Keep filler words like "um", "uh", "like"
              </p>
            </div>
            <Switch
              checked={options.disfluencies !== false}
              onCheckedChange={(checked) => updateOption('disfluencies', checked)}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Filter Profanity</Label>
              <p className="text-sm text-muted-foreground">
                Replace profanity with ***
              </p>
            </div>
            <Switch
              checked={options.filter_profanity || false}
              onCheckedChange={(checked) => updateOption('filter_profanity', checked)}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Dual Channel Audio</Label>
              <p className="text-sm text-muted-foreground">
                Separate left/right audio channels
              </p>
            </div>
            <Switch
              checked={options.dual_channel || false}
              onCheckedChange={(checked) => updateOption('dual_channel', checked)}
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Speaker Diarization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Speaker Diarization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Speaker Labels</Label>
              <p className="text-sm text-muted-foreground">
                Identify different speakers in the audio
              </p>
            </div>
            <Switch
              checked={options.speaker_labels || false}
              onCheckedChange={(checked) => updateOption('speaker_labels', checked)}
              disabled={disabled}
            />
          </div>

          {options.speaker_labels && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Expected Speakers</Label>
                <p className="text-sm text-muted-foreground">
                  Number of speakers (leave empty for auto-detect)
                </p>
              </div>
              <Input
                type="number"
                min="2"
                max="10"
                value={options.speakers_expected || ''}
                onChange={(e) => updateOption('speakers_expected', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Auto"
                className="w-24"
                disabled={disabled}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Language Detection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Language Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Automatic Language Detection</Label>
              <p className="text-sm text-muted-foreground">
                Automatically detect the spoken language
              </p>
            </div>
            <Switch
              checked={options.language_detection !== false}
              onCheckedChange={(checked) => updateOption('language_detection', checked)}
              disabled={disabled}
            />
          </div>

          {options.language_detection === false && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Language Code</Label>
                <p className="text-sm text-muted-foreground">
                  Specify the language (e.g., en, es, fr)
                </p>
              </div>
              <Input
                value={options.language_code || ''}
                onChange={(e) => updateOption('language_code', e.target.value)}
                placeholder="en"
                className="w-24"
                disabled={disabled}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Advanced Content Analysis
            <Badge variant="secondary">Premium</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Content Safety Detection</Label>
              <p className="text-sm text-muted-foreground">
                Detect sensitive content and safety issues
              </p>
            </div>
            <Switch
              checked={options.content_safety_labels || false}
              onCheckedChange={(checked) => updateOption('content_safety_labels', checked)}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Entity Detection</Label>
              <p className="text-sm text-muted-foreground">
                Identify names, places, organizations
              </p>
            </div>
            <Switch
              checked={options.entity_detection || false}
              onCheckedChange={(checked) => updateOption('entity_detection', checked)}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Sentiment Analysis</Label>
              <p className="text-sm text-muted-foreground">
                Analyze emotional tone of speech
              </p>
            </div>
            <Switch
              checked={options.sentiment_analysis || false}
              onCheckedChange={(checked) => updateOption('sentiment_analysis', checked)}
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* PII Detection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>PII Detection Policy</Label>
              <p className="text-sm text-muted-foreground">
                Handle personally identifiable information
              </p>
            </div>
            <Select
              value={options.pii_policy || 'none'}
              onValueChange={(value) => updateOption('pii_policy', value === 'none' ? undefined : value as PIIPolicy)}
              disabled={disabled}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No PII Detection</SelectItem>
                <SelectItem value="remove">Remove PII</SelectItem>
                <SelectItem value="mask">Mask PII</SelectItem>
                <SelectItem value="entity_type">Replace with Entity Type</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {options.pii_policy && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <Shield className="h-4 w-4 inline mr-1" />
                PII detection will identify and {options.pii_policy === 'remove' ? 'remove' : 
                options.pii_policy === 'mask' ? 'mask with ***' : 'replace with entity types'} 
                sensitive information like phone numbers, emails, and addresses.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Generation
            <Badge variant="secondary">Premium</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto Chapters</Label>
              <p className="text-sm text-muted-foreground">
                Automatically generate chapter summaries
              </p>
            </div>
            <Switch
              checked={options.auto_chapters || false}
              onCheckedChange={(checked) => updateOption('auto_chapters', checked)}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>AI Summarization</Label>
              <p className="text-sm text-muted-foreground">
                Generate an AI-powered summary
              </p>
            </div>
            <Switch
              checked={options.summarization || false}
              onCheckedChange={(checked) => updateOption('summarization', checked)}
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedTranscriptionOptions;
