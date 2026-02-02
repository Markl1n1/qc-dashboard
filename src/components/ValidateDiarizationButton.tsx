import React, { useState } from 'react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { CheckCircle, Loader2 } from 'lucide-react';
import { SpeakerUtterance } from '../types';
import { supabase } from '../integrations/supabase/client';
import { useOptimizedUserRole } from '../hooks/useOptimizedUserRole';
import { toast } from 'sonner';

interface ValidateDiarizationButtonProps {
  utterances: SpeakerUtterance[];
  disabled?: boolean;
  fileName?: string;
}

const ValidateDiarizationButton: React.FC<ValidateDiarizationButtonProps> = ({
  utterances,
  disabled = false,
  fileName
}) => {
  const { isAdmin, isLoading: isRoleLoading } = useOptimizedUserRole();
  const [isValidating, setIsValidating] = useState(false);

  const handleValidate = async () => {
    if (!isAdmin || disabled || utterances.length === 0) return;

    setIsValidating(true);
    toast.info('Validating diarization...', { duration: 3000 });

    try {
      const { data, error } = await supabase.functions.invoke('diarization-fix', {
        body: { utterances }
      });

      if (error) {
        console.error('Diarization fix error:', error);
        toast.error(`Validation failed: ${error.message}`);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Validation failed');
        return;
      }

      // Get formatted dialog from response
      const formattedDialog = data.formatted_dialog || generateFormattedDialog(data.corrected_utterances);
      
      // Create metadata header
      const header = [
        '=' .repeat(60),
        'DIARIZATION VALIDATION RESULT',
        '='.repeat(60),
        '',
        `Needs Correction: ${data.needs_correction ? 'YES' : 'NO'}`,
        `Confidence: ${Math.round((data.confidence || 0) * 100)}%`,
        `Analysis: ${data.analysis || 'N/A'}`,
        '',
        'Speaker Mapping:',
        ...Object.entries(data.speaker_mapping || {}).map(([original, mapped]) => `  ${original} → ${mapped}`),
        '',
        '='.repeat(60),
        'CORRECTED DIALOG',
        '='.repeat(60),
        ''
      ].join('\n');

      const fullContent = header + formattedDialog;

      // Download as .txt file
      const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'dialog';
      link.download = `validated_${baseName}_${timestamp}.txt`;
      link.href = url;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        data.needs_correction 
          ? 'Diarization corrected and downloaded!' 
          : 'Diarization validated - no corrections needed'
      );

    } catch (err) {
      console.error('Validation error:', err);
      toast.error('Failed to validate diarization');
    } finally {
      setIsValidating(false);
    }
  };

  // Generate formatted dialog from corrected utterances
  const generateFormattedDialog = (correctedUtterances: Array<{speaker: string; text: string; start: number; end: number}>) => {
    if (!correctedUtterances || correctedUtterances.length === 0) return '';
    
    let currentSpeaker = '';
    const lines: string[] = [];

    for (const utterance of correctedUtterances) {
      if (utterance.speaker !== currentSpeaker) {
        if (lines.length > 0) lines.push('');
        lines.push(`${utterance.speaker}:`);
        currentSpeaker = utterance.speaker;
      }
      lines.push(`- ${utterance.text}`);
    }

    return lines.join('\n');
  };

  // Show loading state while checking role
  if (isRoleLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  // Non-admin users see disabled button with tooltip
  if (!isAdmin) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button 
                variant="outline" 
                size="sm" 
                disabled
                className="opacity-50 cursor-not-allowed"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Validate Diarization
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Функционал ещё тестируется</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Admin users see active button
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleValidate}
      disabled={disabled || isValidating || utterances.length === 0}
    >
      {isValidating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Validating...
        </>
      ) : (
        <>
          <CheckCircle className="h-4 w-4 mr-2" />
          Validate Diarization
        </>
      )}
    </Button>
  );
};

export default ValidateDiarizationButton;
