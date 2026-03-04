import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { CheckCircle, Download, X, ArrowRight, Loader2 } from 'lucide-react';
import { SpeakerUtterance } from '../types';

export interface DiarizationResult {
  success: boolean;
  needs_correction: boolean;
  confidence: number;
  analysis: string;
  corrected_utterances: Array<{
    speaker: 'Agent' | 'Customer';
    original_speaker: string;
    text: string;
    start: number;
    end: number;
  }>;
  formatted_dialog: string;
  speaker_mapping: Record<string, string>;
}

interface DiarizationResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: DiarizationResult;
  originalUtterances: SpeakerUtterance[];
  onApply: () => Promise<void>;
  onDownload: () => void;
  fileName?: string;
}

const DiarizationResultsModal: React.FC<DiarizationResultsModalProps> = ({
  open,
  onOpenChange,
  result,
  originalUtterances,
  onApply,
  onDownload,
  fileName
}) => {
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApply();
      onOpenChange(false);
    } finally {
      setIsApplying(false);
    }
  };

  const changedCount = result.corrected_utterances.filter(
    (u, i) => i < originalUtterances.length && u.speaker !== originalUtterances[i].speaker
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Diarization Validation Results
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-sm text-muted-foreground">Needs Correction</div>
              <Badge variant={result.needs_correction ? 'destructive' : 'default'} className="mt-1">
                {result.needs_correction ? 'YES' : 'NO'}
              </Badge>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-sm text-muted-foreground">Confidence</div>
              <div className="text-lg font-semibold mt-1">{Math.round(result.confidence * 100)}%</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-sm text-muted-foreground">Changes</div>
              <div className="text-lg font-semibold mt-1">{changedCount} / {result.corrected_utterances.length}</div>
            </div>
          </div>

          {/* Analysis */}
          <div className="rounded-lg border p-3">
            <div className="text-sm text-muted-foreground mb-1">Analysis</div>
            <p className="text-sm">{result.analysis}</p>
          </div>

          {/* Speaker Mapping */}
          <div className="rounded-lg border p-3">
            <div className="text-sm text-muted-foreground mb-2">Speaker Mapping</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(result.speaker_mapping).map(([original, mapped]) => (
                <div key={original} className="flex items-center gap-1 text-sm">
                  <Badge variant="outline">{original}</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="secondary">{mapped}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Changed Utterances Preview */}
          <div className="flex-1 overflow-hidden">
            <div className="text-sm text-muted-foreground mb-2">
              Changed Utterances ({changedCount})
            </div>
            <ScrollArea className="h-[200px] rounded-lg border">
              <div className="p-3 space-y-2">
                {result.corrected_utterances.map((u, i) => {
                  const original = originalUtterances[i];
                  if (!original || u.speaker === original.speaker) return null;
                  return (
                    <div key={i} className="text-sm border-b pb-2 last:border-0">
                      <div className="flex items-center gap-1 mb-1">
                        <Badge variant="outline" className="text-xs line-through opacity-60">{original.speaker}</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="secondary" className="text-xs">{u.speaker}</Badge>
                      </div>
                      <p className="text-muted-foreground truncate">{u.text}</p>
                    </div>
                  );
                })}
                {changedCount === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No changes needed — diarization is correct.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button variant="outline" onClick={onDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download .txt
          </Button>
          <Button onClick={handleApply} disabled={isApplying || changedCount === 0}>
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Apply to Dialog
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DiarizationResultsModal;
