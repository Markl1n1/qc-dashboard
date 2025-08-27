
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';

export type SupportedLanguage = 'en' | 'de' | 'pl' | 'ru';

interface LanguageSelectorProps {
  value: SupportedLanguage;
  onValueChange: (value: SupportedLanguage) => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en' as const, name: 'English', flag: '🇺🇸' },
  { code: 'de' as const, name: 'German', flag: '🇩🇪' },
  { code: 'pl' as const, name: 'Polish', flag: '🇵🇱' },
  { code: 'ru' as const, name: 'Russian', flag: '🇷🇺' },
];

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ value, onValueChange }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="language-select">Transcription Language</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id="language-select">
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((language) => (
            <SelectItem key={language.code} value={language.code}>
              <span className="flex items-center gap-2">
                <span>{language.flag}</span>
                <span>{language.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSelector;
