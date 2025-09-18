import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export const useDialogNavigation = () => {
  const [searchParams] = useSearchParams();
  const [currentTab, setCurrentTab] = useState(() => {
    return searchParams.get('tab') || 'transcription';
  });
  const [highlightedUtterance, setHighlightedUtterance] = useState<string | null>(null);

  const navigateToAnalysis = useCallback((issueIndex: number) => {
    setCurrentTab('results');
    setTimeout(() => {
      const element = document.getElementById(`issue-${issueIndex}`);
      element?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 100);
  }, []);

  const navigateToSpeaker = useCallback((utteranceText: string) => {
    setHighlightedUtterance(utteranceText);
    setCurrentTab('transcription');
    setTimeout(() => {
      const element = document.querySelector(`[data-utterance="${utteranceText.substring(0, 50)}"]`);
      element?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 100);
  }, []);

  const navigateToResults = useCallback(() => {
    setCurrentTab('results');
  }, []);

  return {
    currentTab,
    setCurrentTab,
    highlightedUtterance,
    setHighlightedUtterance,
    navigateToAnalysis,
    navigateToSpeaker,
    navigateToResults
  };
};