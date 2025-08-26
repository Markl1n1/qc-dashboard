
import { supabase } from '../integrations/supabase/client';
import { logger } from './loggingService';

interface TranscriptionResult {
  id: string;
  transcript: string;
  confidence: number;
  speaker_labels?: any[];
  metadata?: any;
}

interface TranscriptionError {
  message: string;
  code?: string;
  details?: any;
}

export class TranscriptionService {
  /**
   * Upload and transcribe an audio file
   */
  async transcribeFile(
    file: File,
    options: {
      model?: string;
      language?: string;
      punctuate?: boolean;
      diarize?: boolean;
    } = {}
  ): Promise<TranscriptionResult> {
    if (!file) {
      throw new Error('File is required for transcription');
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      throw new Error('File size exceeds maximum limit of 100MB');
    }

    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/m4a'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}. Supported types: ${allowedTypes.join(', ')}`);
    }

    logger.info('Starting transcription', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      options
    });

    try {
      const startTime = Date.now();
      
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, file);

      if (uploadError) {
        logger.error('File upload failed', uploadError, { fileName: file.name });
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get file URL
      const { data: urlData } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get file URL');
      }

      // Call transcription function
      const { data: transcriptionData, error: transcriptionError } = await supabase.functions
        .invoke('deepgram-transcribe', {
          body: {
            audioUrl: urlData.publicUrl,
            options: {
              model: options.model || 'nova-2',
              language: options.language || 'en',
              punctuate: options.punctuate !== false,
              diarize: options.diarize || false,
              smart_format: true,
              utterances: true
            }
          }
        });

      if (transcriptionError) {
        logger.error('Transcription failed', transcriptionError, { 
          fileName: file.name,
          options 
        });
        throw new Error(`Transcription failed: ${transcriptionError.message}`);
      }

      const duration = Date.now() - startTime;
      logger.info('Transcription completed successfully', {
        fileName: file.name,
        duration: `${duration}ms`,
        transcriptLength: transcriptionData?.transcript?.length || 0
      });

      return {
        id: transcriptionData.id || Math.random().toString(36),
        transcript: transcriptionData.transcript || '',
        confidence: transcriptionData.confidence || 0,
        speaker_labels: transcriptionData.speaker_labels,
        metadata: transcriptionData.metadata
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown transcription error';
      logger.error('Transcription service error', error as Error, {
        fileName: file.name,
        fileSize: file.size
      });
      throw new Error(errorMessage);
    }
  }

  /**
   * Get transcription status
   */
  async getTranscriptionStatus(transcriptionId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: TranscriptionResult;
    error?: TranscriptionError;
  }> {
    if (!transcriptionId?.trim()) {
      throw new Error('Transcription ID is required');
    }

    try {
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('id', transcriptionId)
        .single();

      if (error) {
        logger.error('Failed to get transcription status', error, { transcriptionId });
        throw new Error(`Failed to get status: ${error.message}`);
      }

      return {
        status: data.status,
        result: data.status === 'completed' ? {
          id: data.id,
          transcript: data.transcript,
          confidence: data.confidence,
          speaker_labels: data.speaker_labels,
          metadata: data.metadata
        } : undefined,
        error: data.status === 'failed' ? {
          message: data.error_message || 'Transcription failed',
          code: data.error_code,
          details: data.error_details
        } : undefined
      };

    } catch (error) {
      logger.error('Error getting transcription status', error as Error, { transcriptionId });
      throw error;
    }
  }
}

export const transcriptionService = new TranscriptionService();
