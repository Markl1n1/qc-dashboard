
/**
 * Audio metadata extraction utilities for detailed audio file analysis
 */

export interface AudioMetadata {
  sampleRate: number;
  bitDepth: number;
  channels: number;
  duration?: number;
  format: string;
  fileSize: number;
  isOptimalForTranscription: boolean;
  recommendedActions: string[];
}

/**
 * Parse WAV file header to extract audio metadata
 */
export function parseWAVHeader(buffer: ArrayBuffer): AudioMetadata | null {
  try {
    const view = new DataView(buffer);
    
    // Check for RIFF header
    const riffHeader = String.fromCharCode(
      view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)
    );
    if (riffHeader !== 'RIFF') {
      return null;
    }
    
    // Check for WAVE format
    const waveHeader = String.fromCharCode(
      view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)
    );
    if (waveHeader !== 'WAVE') {
      return null;
    }
    
    // Find fmt chunk
    let offset = 12;
    while (offset < buffer.byteLength - 8) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3)
      );
      
      const chunkSize = view.getUint32(offset + 4, true);
      
      if (chunkId === 'fmt ') {
        const channels = view.getUint16(offset + 10, true);
        const sampleRate = view.getUint32(offset + 12, true);
        const bitsPerSample = view.getUint16(offset + 22, true);
        
        const recommendedActions: string[] = [];
        let isOptimal = true;
        
        if (sampleRate < 16000) {
          recommendedActions.push(`Increase sample rate to at least 16kHz (current: ${sampleRate}Hz)`);
          isOptimal = false;
        }
        
        if (bitsPerSample < 16) {
          recommendedActions.push(`Increase bit depth to at least 16-bit (current: ${bitsPerSample}-bit)`);
          isOptimal = false;
        }
        
        if (channels > 2) {
          recommendedActions.push(`Consider reducing to mono or stereo (current: ${channels} channels)`);
        }
        
        return {
          sampleRate,
          bitDepth: bitsPerSample,
          channels,
          format: 'WAV',
          fileSize: buffer.byteLength,
          isOptimalForTranscription: isOptimal,
          recommendedActions
        };
      }
      
      offset += 8 + chunkSize;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing WAV header:', error);
    return null;
  }
}

/**
 * Analyze audio file and extract metadata
 */
export async function analyzeAudioFile(file: File): Promise<AudioMetadata | null> {
  try {
    // Read first 1KB for header analysis
    const headerBuffer = await file.slice(0, 1024).arrayBuffer();
    
    if (file.name.toLowerCase().endsWith('.wav')) {
      const metadata = parseWAVHeader(headerBuffer);
      if (metadata) {
        return {
          ...metadata,
          fileSize: file.size
        };
      }
    }
    
    // For other formats, provide basic analysis
    const recommendedActions: string[] = [];
    let isOptimal = true;
    
    // File size heuristics for other formats
    if (file.size < 100000) { // Less than 100KB
      recommendedActions.push('File seems very small, ensure adequate audio quality');
      isOptimal = false;
    }
    
    return {
      sampleRate: 0, // Unknown
      bitDepth: 0, // Unknown
      channels: 0, // Unknown
      format: file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN',
      fileSize: file.size,
      isOptimalForTranscription: isOptimal,
      recommendedActions
    };
  } catch (error) {
    console.error('Error analyzing audio file:', error);
    return null;
  }
}

/**
 * Get quality assessment text
 */
export function getQualityAssessment(metadata: AudioMetadata): {
  level: 'excellent' | 'good' | 'fair' | 'poor';
  description: string;
} {
  if (metadata.sampleRate === 0) {
    return {
      level: 'fair',
      description: 'Quality unknown - metadata not available'
    };
  }
  
  if (metadata.sampleRate >= 44100 && metadata.bitDepth >= 16) {
    return {
      level: 'excellent',
      description: 'High quality audio, optimal for transcription'
    };
  }
  
  if (metadata.sampleRate >= 16000 && metadata.bitDepth >= 16) {
    return {
      level: 'good',
      description: 'Good quality audio, suitable for transcription'
    };
  }
  
  if (metadata.sampleRate >= 8000) {
    return {
      level: 'fair',
      description: 'Fair quality audio, conversion recommended'
    };
  }
  
  return {
    level: 'poor',
    description: 'Low quality audio, conversion highly recommended'
  };
}
