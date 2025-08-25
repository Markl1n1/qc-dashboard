
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Copy, Check } from 'lucide-react';
import { SpeakerUtterance } from '../types';
import { formatDialogForCopy, copyToClipboard } from '../utils/dialogFormatting';
import { useToast } from '../hooks/use-toast';

interface DialogCopyButtonProps {
  utterances: SpeakerUtterance[];
  language?: 'original' | 'russian';
}

const DialogCopyButton: React.FC<DialogCopyButtonProps> = ({ utterances, language = 'original' }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!utterances || utterances.length === 0) {
      toast({
        title: "Nothing to copy",
        description: "No dialog content available",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const formattedText = formatDialogForCopy(utterances);
      const success = await copyToClipboard(formattedText);

      if (success) {
        setIsCopied(true);
        toast({
          title: "Copied to clipboard",
          description: `Dialog ${language === 'russian' ? '(Russian)' : '(Original)'} copied to clipboard`,
        });

        // Reset copied state after 2 seconds
        setTimeout(() => setIsCopied(false), 2000);
      } else {
        throw new Error('Copy operation failed');
      }
    } catch (error) {
      console.error('Failed to copy dialog:', error);
      toast({
        title: "Copy failed",
        description: "Failed to copy dialog to clipboard",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      disabled={isLoading || !utterances || utterances.length === 0}
      className="flex items-center gap-2"
    >
      {isCopied ? (
        <>
          <Check className="h-4 w-4 text-green-600" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          {isLoading ? 'Copying...' : 'Copy'}
        </>
      )}
    </Button>
  );
};

export default DialogCopyButton;
