import { useMemo } from 'react';

interface SpeakerMappingData {
  speaker_0?: string;
  speaker_1?: string;
  role_0?: string;
  role_1?: string;
}

export const useSpeakerMapping = (analysisData: SpeakerMappingData | null) => {
  const speakerMapping = useMemo(() => {
    console.log('🎭 useSpeakerMapping - input analysisData:', analysisData);
    
    if (!analysisData) {
      console.log('🎭 useSpeakerMapping - no analysisData, returning empty mapping');
      return {};
    }
    
    const mapping: Record<string, string> = {};
    
    // Map Speaker 0 with fallback logic
    const speaker0Name = analysisData.speaker_0?.trim();
    const role0Name = analysisData.role_0?.trim();
    
    if (speaker0Name) {
      mapping['Speaker 0'] = role0Name ? `${speaker0Name} (${role0Name})` : speaker0Name;
    } else if (role0Name) {
      mapping['Speaker 0'] = role0Name;
    }
    
    if (mapping['Speaker 0']) {
      console.log('🎭 useSpeakerMapping - mapped Speaker 0:', mapping['Speaker 0']);
    }
    
    // Map Speaker 1 with fallback logic
    const speaker1Name = analysisData.speaker_1?.trim();
    const role1Name = analysisData.role_1?.trim();
    
    if (speaker1Name) {
      mapping['Speaker 1'] = role1Name ? `${speaker1Name} (${role1Name})` : speaker1Name;
    } else if (role1Name) {
      mapping['Speaker 1'] = role1Name;
    }
    
    if (mapping['Speaker 1']) {
      console.log('🎭 useSpeakerMapping - mapped Speaker 1:', mapping['Speaker 1']);
    }
    
    console.log('🎭 useSpeakerMapping - final mapping:', mapping);
    return mapping;
  }, [analysisData]);
  
  const mapSpeakerName = (originalSpeaker: string): string => {
    return speakerMapping[originalSpeaker] || originalSpeaker;
  };
  
  return { speakerMapping, mapSpeakerName };
};