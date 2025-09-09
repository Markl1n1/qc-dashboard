
export const extractTextSnippet = (utterances: any[], position: number, searchText: string): string => {
  if (!utterances || position < 0 || position >= utterances.length) {
    return searchText;
  }
  
  const utterance = utterances[position];
  if (!utterance || !utterance.text) {
    return searchText;
  }
  
  // If searchText is found in the utterance, return a snippet around it
  const text = utterance.text;
  const index = text.toLowerCase().indexOf(searchText.toLowerCase());
  
  if (index !== -1) {
    // Extract snippet with some context (50 chars before and after)
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + searchText.length + 50);
    let snippet = text.substring(start, end);
    
    // Add ellipsis if we truncated
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    return snippet;
  }
  
  // If not found, return first 100 chars of the utterance
  return text.length > 100 ? text.substring(0, 100) + '...' : text;
};

export const cleanTextForAnalysis = (text: string): string => {
  // Remove speaker labels and formatting artifacts
  return text
    .replace(/^\[(Agent|Customer)\]:\s*/i, '')
    .replace(/^(Agent|Customer):\s*/i, '')
    .replace(/\[\d+\]\s*(Agent|Customer):\s*/gi, '')
    .trim();
};

export const shouldExcludeFromHighlighting = (text: string): boolean => {
  // Exclude common speaker labels and formatting
  const excludePatterns = [
    /^Agent$/i,
    /^Customer$/i,
    /^\[(Agent|Customer)\]$/i,
    /^(Agent|Customer):$/i
  ];
  
  return excludePatterns.some(pattern => pattern.test(text.trim()));
};
