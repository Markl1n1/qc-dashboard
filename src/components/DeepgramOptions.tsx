
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Mic2, Users, Globe, Sparkles } from 'lucide-react';
import { DeepgramOptions as DeepgramOptionsType } from '../types/deepgram';

interface DeepgramOptionsProps {
  options: DeepgramOptionsType;
  onChange: (options: DeepgramOptionsType) => void;
  disabled?: boolean;
}

const DeepgramOptions: React.FC<DeepgramOptionsProps> = ({
  options,
  onChange,
  disabled = false
}) => {
  const updateOption = <K extends keyof DeepgramOptionsType>(
    key: K,
    value: DeepgramOptionsType[K]
  ) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div className="space-y-4">
      {/* Model Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic2 className="h-4 w-4" />
            Model & Quality
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Transcription Model</Label>
              <p className="text-sm text-muted-foreground">
                Choose between speed and accuracy
              </p>
            </div>
            <Select
              value={options.model || 'nova-2'}
              onValueChange={(value) => updateOption('model', value)}
              disabled={disabled}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nova-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Best</Badge>
                    Nova-2
                  </div>
                </SelectItem>
                <SelectItem value="nova">Nova</SelectItem>
                <SelectItem value="enhanced">Enhanced</SelectItem>
                <SelectItem value="base">Base</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Smart Formatting</Label>
              <p className="text-sm text-muted-foreground">
                Apply punctuation and capitalization
              </p>
            </div>
            <Switch
              checked={options.smart_formatting !== false}
              onCheckedChange={(checked) => updateOption('smart_formatting', checked)}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Profanity Filter</Label>
              <p className="text-sm text-muted-foreground">
                Replace profanity with ***
              </p>
            </div>
            <Switch
              checked={options.profanity_filter || false}
              onCheckedChange={(checked) => updateOption('profanity_filter', checked)}
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Speaker Diarization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Speaker Recognition
            <Badge variant="secondary" className="text-xs">Agent/Customer</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Speaker Diarization</Label>
              <p className="text-sm text-muted-foreground">
                Separate and identify speakers (Agent vs Customer)
              </p>
            </div>
            <Switch
              checked={options.speaker_labels || false}
              onCheckedChange={(checked) => updateOption('speaker_labels', checked)}
              disabled={disabled}
            />
          </div>

          {options.speaker_labels && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Smart Speaker Detection</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Deepgram will automatically detect speakers and label them as "Agent" or "Customer" 
                based on conversation patterns and common phrases.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Language Detection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            Language Detection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Automatic Language Detection</Label>
              <p className="text-sm text-muted-foreground">
                Detect language automatically (supports 36+ languages)
              </p>
            </div>
            <Switch
              checked={options.language_detection || false}
              onCheckedChange={(checked) => updateOption('language_detection', checked)}
              disabled={disabled}
            />
          </div>

          {!options.language_detection && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Language Code</Label>
                <p className="text-sm text-muted-foreground">
                  Specify the language (e.g., en, es, fr)
                </p>
              </div>
              <Select
                value={options.language || 'en'}
                onValueChange={(value) => updateOption('language', value)}
                disabled={disabled}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="it">Italian</SelectItem>
                  <SelectItem value="pt">Portuguese</SelectItem>
                  <SelectItem value="ru">Russian</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                  <SelectItem value="ko">Korean</SelectItem>
                  <SelectItem value="zh">Chinese</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeepgramOptions;
