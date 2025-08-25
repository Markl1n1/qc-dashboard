import React from 'react';
import { Button } from './ui/button';
import { Languages, Loader2, CheckCircle } from 'lucide-react';
import { TranslationProgress } from '../types';

interface SimpleTranslationButtonProps {
  onTranslate: () => void;
  isTranslating: boolean;
  progress: TranslationProgress | null;
  hasTranslation: boolean;
  disabled?: boolean;
}

export const SimpleTranslationButton: React.FC<SimpleTranslationButtonProps> = ({
  onTranslate,
  isTranslating,
  progress,
  hasTranslation,
  disabled = false
}) => {
  if (hasTranslation) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <span className="text-green-600">Russian Available</span>
      </Button>
    );
  }

  if (isTranslating) {
    const progressPercent = progress?.progress || 0;
    return (
      <Button variant="outline" size="sm" disabled className="gap-2 min-w-[140px]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>
          Translating... {progressPercent}%
        </span>
      </Button>
    );
  }

  return (
    <Button 
      onClick={onTranslate}
      variant="outline" 
      size="sm"
      className="gap-2"
      disabled={disabled}
    >
      <Languages className="h-4 w-4" />
      Translate to Russian
    </Button>
  );
};