import React from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Languages, Loader2 } from 'lucide-react';
import { Dialog } from '../types';

interface LanguageToggleProps {
  dialog: Dialog;
  onToggle: () => void;
  onStartTranslation: () => void;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ 
  dialog, 
  onToggle, 
  onStartTranslation 
}) => {
  const hasRussianTranslation = dialog.russianTranscription && dialog.russianSpeakerTranscription;
  const isTranslating = dialog.isTranslating;
  const currentLanguage = dialog.currentLanguage || 'original';

  if (isTranslating) {
    return (
      <div className="flex items-center gap-2">
        <Button disabled variant="outline" size="sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Translating... {dialog.translationProgress || 0}%
        </Button>
        <Badge variant="secondary">
          Background Process
        </Badge>
      </div>
    );
  }

  if (!hasRussianTranslation) {
    return (
      <Button 
        onClick={onStartTranslation}
        variant="outline" 
        size="sm"
        className="gap-2"
      >
        <Languages className="h-4 w-4" />
        Translate to Russian
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button 
        onClick={onToggle}
        variant={currentLanguage === 'russian' ? 'default' : 'outline'}
        size="sm"
        className="gap-2"
      >
        <Languages className="h-4 w-4" />
        {currentLanguage === 'russian' ? 'Русский' : 'Original'}
      </Button>
      <Badge variant="secondary">
        Available in both languages
      </Badge>
    </div>
  );
};