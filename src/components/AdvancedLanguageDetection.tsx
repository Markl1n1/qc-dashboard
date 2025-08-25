
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Globe, Languages, Zap } from 'lucide-react';

interface LanguageDetectionResult {
  code: string;
  confidence: number;
  name?: string;
}

interface AdvancedLanguageDetectionProps {
  detectedLanguage?: LanguageDetectionResult;
  autoDetection?: boolean;
  onAutoDetectionChange?: (enabled: boolean) => void;
  selectedLanguage?: string;
  onLanguageChange?: (language: string) => void;
  disabled?: boolean;
}

// Comprehensive language support based on AssemblyAI documentation
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', region: 'Global' },
  { code: 'es', name: 'Spanish', region: 'Global' },
  { code: 'fr', name: 'French', region: 'Global' },
  { code: 'de', name: 'German', region: 'Europe' },
  { code: 'it', name: 'Italian', region: 'Europe' },
  { code: 'pt', name: 'Portuguese', region: 'Global' },
  { code: 'nl', name: 'Dutch', region: 'Europe' },
  { code: 'hi', name: 'Hindi', region: 'Asia' },
  { code: 'ja', name: 'Japanese', region: 'Asia' },
  { code: 'zh', name: 'Chinese', region: 'Asia' },
  { code: 'ko', name: 'Korean', region: 'Asia' },
  { code: 'ru', name: 'Russian', region: 'Europe/Asia' },
  { code: 'ar', name: 'Arabic', region: 'MENA' },
  { code: 'tr', name: 'Turkish', region: 'Europe/Asia' },
  { code: 'pl', name: 'Polish', region: 'Europe' },
  { code: 'uk', name: 'Ukrainian', region: 'Europe' },
  { code: 'cs', name: 'Czech', region: 'Europe' },
  { code: 'sk', name: 'Slovak', region: 'Europe' },
  { code: 'hu', name: 'Hungarian', region: 'Europe' },
  { code: 'ro', name: 'Romanian', region: 'Europe' },
  { code: 'bg', name: 'Bulgarian', region: 'Europe' },
  { code: 'hr', name: 'Croatian', region: 'Europe' },
  { code: 'sr', name: 'Serbian', region: 'Europe' },
  { code: 'sl', name: 'Slovenian', region: 'Europe' },
  { code: 'et', name: 'Estonian', region: 'Europe' },
  { code: 'lv', name: 'Latvian', region: 'Europe' },
  { code: 'lt', name: 'Lithuanian', region: 'Europe' },
  { code: 'fi', name: 'Finnish', region: 'Europe' },
  { code: 'sv', name: 'Swedish', region: 'Europe' },
  { code: 'no', name: 'Norwegian', region: 'Europe' },
  { code: 'da', name: 'Danish', region: 'Europe' },
  { code: 'is', name: 'Icelandic', region: 'Europe' },
  { code: 'ga', name: 'Irish', region: 'Europe' },
  { code: 'mt', name: 'Maltese', region: 'Europe' },
  { code: 'he', name: 'Hebrew', region: 'MENA' },
  { code: 'fa', name: 'Persian', region: 'MENA' },
  { code: 'ur', name: 'Urdu', region: 'Asia' },
  { code: 'bn', name: 'Bengali', region: 'Asia' },
  { code: 'ta', name: 'Tamil', region: 'Asia' },
  { code: 'te', name: 'Telugu', region: 'Asia' },
  { code: 'ml', name: 'Malayalam', region: 'Asia' },
  { code: 'kn', name: 'Kannada', region: 'Asia' },
  { code: 'gu', name: 'Gujarati', region: 'Asia' },
  { code: 'pa', name: 'Punjabi', region: 'Asia' },
  { code: 'th', name: 'Thai', region: 'Asia' },
  { code: 'vi', name: 'Vietnamese', region: 'Asia' },
  { code: 'id', name: 'Indonesian', region: 'Asia' },
  { code: 'ms', name: 'Malay', region: 'Asia' },
  { code: 'tl', name: 'Filipino', region: 'Asia' },
  { code: 'sw', name: 'Swahili', region: 'Africa' },
  { code: 'zu', name: 'Zulu', region: 'Africa' },
  { code: 'af', name: 'Afrikaans', region: 'Africa' },
];

const AdvancedLanguageDetection: React.FC<AdvancedLanguageDetectionProps> = ({
  detectedLanguage,
  autoDetection = true,
  onAutoDetectionChange,
  selectedLanguage,
  onLanguageChange,
  disabled = false
}) => {
  const getLanguageName = (code: string): string => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
    return lang ? lang.name : code.toUpperCase();
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.9) return 'High';
    if (confidence >= 0.7) return 'Medium';
    return 'Low';
  };

  return (
    <div className="space-y-4">
      {/* Language Detection Results */}
      {detectedLanguage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Detection Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {detectedLanguage.code.toUpperCase()}
                    </Badge>
                    <span className="font-medium">
                      {getLanguageName(detectedLanguage.code)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Detected Language
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-medium ${getConfidenceColor(detectedLanguage.confidence)}`}>
                      {Math.round(detectedLanguage.confidence * 100)}%
                    </span>
                    <Badge 
                      variant={detectedLanguage.confidence >= 0.7 ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {getConfidenceLabel(detectedLanguage.confidence)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Confidence
                  </p>
                </div>
              </div>
              
              <Progress 
                value={detectedLanguage.confidence * 100} 
                className="h-2"
              />
              
              {detectedLanguage.confidence < 0.7 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Low confidence detected.</strong> Consider manually selecting the language for better accuracy.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Language Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Language Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Automatic Language Detection</Label>
              <p className="text-sm text-muted-foreground">
                Let AssemblyAI automatically detect the spoken language
              </p>
            </div>
            <Switch
              checked={autoDetection}
              onCheckedChange={onAutoDetectionChange}
              disabled={disabled}
            />
          </div>

          {!autoDetection && (
            <div className="space-y-2">
              <Label>Select Language</Label>
              <Select
                value={selectedLanguage}
                onValueChange={onLanguageChange}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a language" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <div className="flex items-center justify-between w-full">
                        <span>{lang.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {lang.code.toUpperCase()}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                AssemblyAI supports 99+ languages. Select the primary language of your audio.
              </p>
            </div>
          )}

          {autoDetection && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Automatic detection enabled.</strong> AssemblyAI will identify the language and optimize transcription accordingly. This works best with clear audio and single-language content.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Language Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Language Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0">Tip 1</Badge>
              <p>For multilingual audio, automatic detection works best. AssemblyAI can handle code-switching between languages.</p>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0">Tip 2</Badge>
              <p>Manual language selection can improve accuracy for accented speech or domain-specific vocabulary.</p>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0">Tip 3</Badge>
              <p>Some features like PII detection and content safety work best with English audio.</p>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0">Tip 4</Badge>
              <p>Regional variants (e.g., en-US, en-GB) are automatically handled by the universal model.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedLanguageDetection;
