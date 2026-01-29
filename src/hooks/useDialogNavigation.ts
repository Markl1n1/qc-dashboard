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
      // Нормализуем текст для поиска (убираем пробелы, пунктуацию, приводим к нижнему регистру)
      const normalize = (text: string) => {
        return (text || '')
          .normalize('NFKC')
          .replace(/[«»„""'']/g, '"')
          .replace(/[‐-‒–—−]/g, '-')
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/[\r\n\u0085\u2028\u2029]+/g, ' ')
          .replace(/\u00A0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase()
          .replace(/^"+|"+$/g, '')
          .replace(/^[.]+|[.]+$/g, '')
          .trim();
      };
      
      const normalizedSearch = normalize(utteranceText);
      
      // Пробуем найти точное совпадение по data-utterance
      let element = document.querySelector(`[data-utterance="${utteranceText}"]`);
      
      // Если не нашли, ищем по нормализованному тексту
      if (!element) {
        const allUtterances = document.querySelectorAll('[data-utterance-normalized]');
        for (const el of allUtterances) {
          const normalized = el.getAttribute('data-utterance-normalized');
          if (normalized && normalized === normalizedSearch) {
            element = el;
            break;
          }
        }
      }
      
      // Если все еще не нашли, ищем по частичному совпадению нормализованного текста
      if (!element) {
        const allUtterances = document.querySelectorAll('[data-utterance-normalized]');
        for (const el of allUtterances) {
          const normalized = el.getAttribute('data-utterance-normalized');
          if (normalized && normalized.includes(normalizedSearch)) {
            element = el;
            break;
          }
        }
      }
      
      // Если все еще не нашли, ищем по частичному совпадению оригинального текста
      if (!element) {
        const searchSubstring = utteranceText.substring(0, Math.min(100, utteranceText.length));
        const allUtterances = document.querySelectorAll('[data-utterance]');
        for (const el of allUtterances) {
          const utterance = el.getAttribute('data-utterance');
          if (utterance && utterance.includes(searchSubstring)) {
            element = el;
            break;
          }
        }
      }
      
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        
        // Добавляем визуальное выделение
        element.classList.add('ring-2', 'ring-primary', 'shadow-lg');
        setTimeout(() => {
          element?.classList.remove('ring-2', 'ring-primary', 'shadow-lg');
        }, 3000);
      } else {
        console.warn('Could not find utterance element:', utteranceText);
      }
    }, 200); // Увеличена задержка для гарантии рендера
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