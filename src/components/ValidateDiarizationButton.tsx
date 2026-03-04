import React, { useState } from 'react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { CheckCircle, Loader2 } from 'lucide-react';
import { SpeakerUtterance } from '../types';
import { supabase } from '../integrations/supabase/client';
import { useOptimizedUserRole } from '../hooks/useOptimizedUserRole';
import { databaseService } from '../services/databaseService';
import { toast } from 'sonner';
import DiarizationResultsModal, { DiarizationResult } from './DiarizationResultsModal';

interface ValidateDiarizationButtonProps {
  utterances: SpeakerUtterance[];
  disabled?: boolean;
  fileName?: string;
  dialogId?: string;
  onCorrectionsApplied?: () => void;
}

const ValidateDiarizationButton: React.FC<ValidateDiarizationButtonProps> = ({
  utterances,
  disabled = false,
  fileName,
  transcriptionId,
  onCorrectionsApplied
}) => {
  const { isAdmin, isLoading: isRoleLoading } = useOptimizedUserRole();
  const [isValidating, setIsValidating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<DiarizationResult | null>(null);

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

      setValidationResult(data as DiarizationResult);
      setModalOpen(true);
    } catch (err) {
      console.error('Validation error:', err);
      toast.error('Failed to validate diarization');
    } finally {
      setIsValidating(false);
    }
  };

  const handleApply = async () => {
    if (!validationResult || !transcriptionId) {
      toast.error('Cannot apply: missing transcription ID');
      return;
    }

    const corrections = validationResult.corrected_utterances.map((u, i) => ({
      utterance_order: i,
      speaker: u.speaker
    }));

    const updatedCount = await databaseService.updateUtteranceSpeakers(transcriptionId, corrections);
    toast.success(`Applied ${updatedCount} speaker corrections to database`);
    onCorrectionsApplied?.();
  };

  const handleDownload = () => {
    if (!validationResult) return;

    const header = [
      '='.repeat(60),
      'DIARIZATION VALIDATION RESULT',
      '='.repeat(60),
      '',
      `Needs Correction: ${validationResult.needs_correction ? 'YES' : 'NO'}`,
      `Confidence: ${Math.round(validationResult.confidence * 100)}%`,
      `Analysis: ${validationResult.analysis}`,
      '',
      'Speaker Mapping:',
      ...Object.entries(validationResult.speaker_mapping).map(([original, mapped]) => `  ${original} → ${mapped}`),
      '',
      '='.repeat(60),
      'CORRECTED DIALOG',
      '='.repeat(60),
      ''
    ].join('\n');

    const fullContent = header + validationResult.formatted_dialog;
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
  };

  if (isRoleLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (!isAdmin) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="outline" size="sm" disabled className="opacity-50 cursor-not-allowed">
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

  return (
    <>
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

      {validationResult && (
        <DiarizationResultsModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          result={validationResult}
          originalUtterances={utterances}
          onApply={handleApply}
          onDownload={handleDownload}
          fileName={fileName}
        />
      )}
    </>
  );
};

export default ValidateDiarizationButton;
