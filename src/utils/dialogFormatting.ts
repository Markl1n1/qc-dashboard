
import { SpeakerUtterance } from '../types';

export const formatDialogForCopy = (utterances: SpeakerUtterance[]): string => {
  let formattedText = '';
  let currentSpeaker = '';

  for (const utterance of utterances) {
    // Only add speaker label if it's different from the previous one
    if (utterance.speaker !== currentSpeaker) {
      if (formattedText) {
        formattedText += '\n'; // Add extra line break between speakers
      }
      formattedText += `${utterance.speaker}: \n`;
      currentSpeaker = utterance.speaker;
    }
    
    formattedText += `- ${utterance.text}\n`;
  }

  return formattedText.trim();
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};
