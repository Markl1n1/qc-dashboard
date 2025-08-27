
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';

interface Language {
  code: string;
  name: string;
}

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (languageCode: string) => void;
}

const TRANSCRIPTION_LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'pl', name: 'Polish' },
  { code: 'ru', name: 'Russian' },
];

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguage,
  onLanguageChange,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audio Language</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup value={selectedLanguage} onValueChange={onLanguageChange}>
          <div className="grid grid-cols-2 gap-4">
            {TRANSCRIPTION_LANGUAGES.map((language) => (
              <div key={language.code} className="flex items-center space-x-2">
                <RadioGroupItem value={language.code} id={language.code} />
                <Label 
                  htmlFor={language.code} 
                  className="cursor-pointer font-medium"
                >
                  {language.name}
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
};

export default LanguageSelector;
