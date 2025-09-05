
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Mic2, Users, Globe, Sparkles, Zap } from 'lucide-react';
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

  const languageOptions = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'nl', name: 'Dutch' },
    { code: 'sv', name: 'Swedish' },
    { code: 'no', name: 'Norwegian' },
    { code: 'da', name: 'Danish' },
    { code: 'fi', name: 'Finnish' },
    { code: 'pl', name: 'Polish' },
    { code: 'cs', name: 'Czech' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'tr', name: 'Turkish' },
    { code: 'ar', name: 'Arabic' }
  ];

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
              value={options.model || 'nova-2-general'}
              onValueChange={(value) => updateOption('model', value)}
              disabled={disabled}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nova-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    <Badge variant="default" className="bg-gradient-to-r from-purple-500 to-pink-500">Premium</Badge>
                    Nova-3
                  </div>
                </SelectItem>
                <SelectItem value="nova-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Best</Badge>
                    Nova-2
                  </div>
                </SelectItem>
                <SelectItem value="nova">Nova</SelectItem>
                <SelectItem value="enhanced">Enhanced</SelectItem>
                <SelectItem value="base">Base</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Model Information */}
          {options.model === 'nova-3-general' && (
            <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">Nova-3 Premium Features</span>
              </div>
              <p className="text-xs text-purple-700">
                Latest model with enhanced multilingual support, superior noise handling, 
                and improved accuracy for complex audio environments.
              </p>
            </div>
          )}

          {options.model === 'nova-2-general' && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Nova-2 Features</span>
              </div>
              <p className="text-xs text-blue-700">
                Excellent for non-English languages, handles filler words well, 
                and provides reliable accuracy across various audio qualities.
              </p>
            </div>
          )}

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
                based on conversation patterns and common phrases. Results will be color-coded for easy reading.
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
            <Badge variant="outline" className="text-xs">36+ Languages</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Automatic Language Detection</Label>
              <p className="text-sm text-muted-foreground">
                Detect language automatically with confidence scoring
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
                <Label>Select Language</Label>
                <p className="text-sm text-muted-foreground">
                  Choose the expected audio language
                </p>
              </div>
              <Select
                value={options.language || 'en'}
                onValueChange={(value) => updateOption('language', value)}
                disabled={disabled}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {options.language_detection && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Auto-Detection Active</span>
              </div>
              <p className="text-xs text-green-700">
                Language will be detected automatically with confidence scores displayed in results.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeepgramOptions;
