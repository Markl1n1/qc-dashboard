
/**
 * Audio file utilities for proper MIME type detection and validation
 */

export interface AudioFileInfo {
  file: File;
  detectedMimeType: string;
  isValidAudio: boolean;
}

/**
 * Map file extensions to their correct MIME types
 */
const AUDIO_MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.wave': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.webm': 'audio/webm',
  '.3gp': 'audio/3gpp',
  '.amr': 'audio/amr',
  '.wma': 'audio/x-ms-wma'
};

/**
 * Get the correct MIME type for an audio file based on its extension
 */
export function getCorrectMimeType(fileName: string): string | null {
  const extension = getFileExtension(fileName);
  return AUDIO_MIME_TYPES[extension] || null;
}

/**
 * Extract file extension from filename (including the dot)
 */
export function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex !== -1 ? fileName.slice(lastDotIndex).toLowerCase() : '';
}

/**
 * Check if a file is a valid audio file based on extension and MIME type
 */
export function isValidAudioFile(file: File): boolean {
  const extension = getFileExtension(file.name);
  const hasValidExtension = Object.keys(AUDIO_MIME_TYPES).includes(extension);
  
  // Accept files with valid audio extensions even if MIME type is generic
  if (hasValidExtension) {
    console.log(`[AudioFileUtils] Valid audio extension detected: ${extension} for file: ${file.name}`);
    return true;
  }
  
  const hasValidMimeType = file.type.startsWith('audio/') || file.type === 'application/octet-stream';
  
  console.log(`[AudioFileUtils] File validation - Extension: ${extension}, MIME: ${file.type}, Valid extension: ${hasValidExtension}, Valid MIME: ${hasValidMimeType}`);
  
  return hasValidExtension && hasValidMimeType;
}

/**
 * Create a new File object with the correct MIME type
 */
export function createFileWithCorrectMimeType(originalFile: File): File {
  const correctMimeType = getCorrectMimeType(originalFile.name);
  
  if (!correctMimeType) {
    console.warn(`[AudioFileUtils] No correct MIME type found for: ${originalFile.name}`);
    return originalFile;
  }
  
  // Always create a new file with the correct MIME type for better compatibility
  // This is especially important for WAV files that often come as application/octet-stream
  console.log(`[AudioFileUtils] Correcting MIME type for ${originalFile.name}: ${originalFile.type} -> ${correctMimeType}`);
  
  // Create new File with correct MIME type
  const correctedFile = new File([originalFile], originalFile.name, {
    type: correctMimeType,
    lastModified: originalFile.lastModified
  });
  
  console.log(`[AudioFileUtils] File created with corrected MIME type: ${correctedFile.type}`);
  return correctedFile;
}

/**
 * Get detailed information about an audio file
 */
export function getAudioFileInfo(file: File): AudioFileInfo {
  const detectedMimeType = getCorrectMimeType(file.name) || file.type;
  const isValidAudio = isValidAudioFile(file);
  
  return {
    file: createFileWithCorrectMimeType(file),
    detectedMimeType,
    isValidAudio
  };
}

/**
 * Supported audio file extensions for display
 */
export const SUPPORTED_AUDIO_EXTENSIONS = Object.keys(AUDIO_MIME_TYPES);

/**
 * Human-readable list of supported formats
 */
export const SUPPORTED_FORMATS_TEXT = 'MP3, WAV, M4A, FLAC, OGG, AAC, WEBM, 3GP, AMR, WMA';
