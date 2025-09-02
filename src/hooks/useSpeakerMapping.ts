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
    
    // Map Speaker 0
    if (analysisData.speaker_0 || analysisData.role_0) {
      const name = analysisData.speaker_0 || '';
      const role = analysisData.role_0 || '';
      mapping['Speaker 0'] = name ? `${name} (${role})` : role;
      console.log('🎭 useSpeakerMapping - mapped Speaker 0:', mapping['Speaker 0']);
    }
    
    // Map Speaker 1
    if (analysisData.speaker_1 || analysisData.role_1) {
      const name = analysisData.speaker_1 || '';
      const role = analysisData.role_1 || '';
      mapping['Speaker 1'] = name ? `${name} (${role})` : role;
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