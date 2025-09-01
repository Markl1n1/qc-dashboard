import { supabase } from '../integrations/supabase/client';
import { Dialog, SpeakerUtterance, AIAnalysis } from '../types';
import { logger } from './loggingService';

export interface DatabaseDialog {
  id: string;
  user_id: string;
  file_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  assigned_agent: string;
  assigned_supervisor: string;
  upload_date: string;
  error_message?: string;
  audio_length_minutes?: number;
  estimated_cost: number;
  quality_score?: number;
  is_segmented: boolean;
  parent_dialog_id?: string;
  segment_count?: number;
  segment_index?: number;
  current_language: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface DatabaseTranscription {
  id: string;
  dialog_id: string;
  transcription_type: 'plain' | 'speaker' | 'russian' | 'russian_speaker';
  content?: string;
  confidence?: number;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseUtterance {
  id: string;
  transcription_id: string;
  speaker: string;
  text: string;
  confidence: number;
  start_time: number;
  end_time: number;
  utterance_order: number;
  created_at: string;
}

export interface DatabaseAnalysis {
  id: string;
  dialog_id: string;
  analysis_type: 'openai';
  overall_score?: number;
  category_scores: Record<string, number>;
  mistakes: any[];
  recommendations: string[];
  summary?: string;
  confidence?: number;
  token_usage?: any;
  banned_words_detected: any[];
  sentiment?: any;
  conversation_flow?: any;
  processing_time?: number;
  created_at: string;
  updated_at: string;
  // New structured columns for parsed evaluation data
  comment?: string;
  utterance?: string;
  rule_category?: string;
  speaker_0?: string;
  role_0?: string;
  speaker_1?: string;
  role_1?: string;
}

/**
 * Input validation utilities
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const validateUuid = (id: string, fieldName: string): void => {
  if (!id || typeof id !== 'string') {
    throw new ValidationError(`${fieldName} is required and must be a string`);
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`);
  }
};

const validateRequired = (value: unknown, fieldName: string): void => {
  if (value === null || value === undefined || value === '') {
    throw new ValidationError(`${fieldName} is required`);
  }
};

class DatabaseService {
  /**
   * Create a new dialog with input validation
   */
  async createDialog(dialog: Omit<DatabaseDialog, 'id' | 'created_at' | 'updated_at' | 'expires_at'>): Promise<DatabaseDialog> {
    try {
      // Validate required fields
      validateRequired(dialog.user_id, 'user_id');
      validateRequired(dialog.file_name, 'file_name');
      validateRequired(dialog.assigned_agent, 'assigned_agent');
      validateRequired(dialog.assigned_supervisor, 'assigned_supervisor');
      
      validateUuid(dialog.user_id, 'user_id');

      const { data, error } = await supabase
        .from('dialogs')
        .insert([dialog])
        .select()
        .single();

      if (error) {
        logger.error('Failed to create dialog', error, { dialog });
        throw error;
      }

      logger.info('Dialog created successfully', { dialogId: data.id });
      return data as DatabaseDialog;
    } catch (error) {
      logger.error('Database service: createDialog failed', error as Error, { dialog });
      throw error;
    }
  }

  /**
   * Get dialogs with optional user filtering and input validation
   */
  async getDialogs(userId?: string): Promise<DatabaseDialog[]> {
    try {
      if (userId) {
        validateUuid(userId, 'userId');
      }

      let query = supabase.from('dialogs').select('*').order('upload_date', { ascending: false });
      
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      
      if (error) {
        logger.error('Failed to fetch dialogs', error, { userId });
        throw error;
      }

      return (data || []) as DatabaseDialog[];
    } catch (error) {
      logger.error('Database service: getDialogs failed', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get a single dialog by ID with validation
   */
  async getDialog(id: string): Promise<DatabaseDialog | null> {
    try {
      validateUuid(id, 'id');

      const { data, error } = await supabase
        .from('dialogs')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch dialog', error, { dialogId: id });
        throw error;
      }

      return data as DatabaseDialog | null;
    } catch (error) {
      logger.error('Database service: getDialog failed', error as Error, { dialogId: id });
      throw error;
    }
  }

  /**
   * Update dialog with validation
   */
  async updateDialog(id: string, updates: Partial<DatabaseDialog>): Promise<DatabaseDialog> {
    try {
      validateUuid(id, 'id');
      validateRequired(updates, 'updates');

      const { data, error } = await supabase
        .from('dialogs')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update dialog', error, { dialogId: id, updates });
        throw error;
      }

      logger.info('Dialog updated successfully', { dialogId: id });
      return data as DatabaseDialog;
    } catch (error) {
      logger.error('Database service: updateDialog failed', error as Error, { dialogId: id, updates });
      throw error;
    }
  }

  /**
   * Delete dialog with validation
   */
  async deleteDialog(id: string): Promise<void> {
    try {
      validateUuid(id, 'id');

      const { error } = await supabase
        .from('dialogs')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('Failed to delete dialog', error, { dialogId: id });
        throw error;
      }

      logger.info('Dialog deleted successfully', { dialogId: id });
    } catch (error) {
      logger.error('Database service: deleteDialog failed', error as Error, { dialogId: id });
      throw error;
    }
  }

  // Transcription operations
  async createTranscription(transcription: Omit<DatabaseTranscription, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseTranscription> {
    try {
      validateUuid(transcription.dialog_id, 'dialog_id');
      validateRequired(transcription.transcription_type, 'transcription_type');

      const { data, error } = await supabase
        .from('dialog_transcriptions')
        .insert([transcription])
        .select()
        .single();

      if (error) {
        logger.error('Failed to create transcription', error, { transcription });
        throw error;
      }

      return data as DatabaseTranscription;
    } catch (error) {
      logger.error('Database service: createTranscription failed', error as Error, { transcription });
      throw error;
    }
  }

  async getTranscriptions(dialogId: string): Promise<DatabaseTranscription[]> {
    const { data, error } = await supabase
      .from('dialog_transcriptions')
      .select('*')
      .eq('dialog_id', dialogId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as DatabaseTranscription[];
  }

  async updateTranscription(id: string, updates: Partial<DatabaseTranscription>): Promise<DatabaseTranscription> {
    const { data, error } = await supabase
      .from('dialog_transcriptions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as DatabaseTranscription;
  }

  // Speaker utterance operations
  async createUtterances(utterances: Omit<DatabaseUtterance, 'id' | 'created_at'>[]): Promise<DatabaseUtterance[]> {
    const { data, error } = await supabase
      .from('dialog_speaker_utterances')
      .insert(utterances)
      .select();

    if (error) throw error;
    return (data || []) as DatabaseUtterance[];
  }

  async getUtterances(transcriptionId: string): Promise<DatabaseUtterance[]> {
    const { data, error } = await supabase
      .from('dialog_speaker_utterances')
      .select('*')
      .eq('transcription_id', transcriptionId)
      .order('utterance_order', { ascending: true });

    if (error) throw error;
    return (data || []) as DatabaseUtterance[];
  }

  // Analysis operations
  async createAnalysis(analysis: Omit<DatabaseAnalysis, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseAnalysis> {
    const { data, error } = await supabase
      .from('dialog_analysis')
      .insert([analysis])
      .select()
      .single();

    if (error) throw error;
    return data as DatabaseAnalysis;
  }

  async getAnalysis(dialogId: string, analysisType?: 'openai'): Promise<DatabaseAnalysis[]> {
    let query = supabase
      .from('dialog_analysis')
      .select('*')
      .eq('dialog_id', dialogId);

    if (analysisType) {
      query = query.eq('analysis_type', analysisType);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as DatabaseAnalysis[];
  }

  async updateAnalysis(id: string, updates: Partial<DatabaseAnalysis>): Promise<DatabaseAnalysis> {
    const { data, error } = await supabase
      .from('dialog_analysis')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as DatabaseAnalysis;
  }

  async getStructuredAnalysis(dialogId: string, analysisType?: 'openai'): Promise<{
    overallScore: number;
    mistakes: Array<{
      rule_category: string;
      comment: string;
      utterance: string;
    }>;
    speakers: {
      speaker_0?: string;
      role_0?: string;
      speaker_1?: string;
      role_1?: string;
    };
    confidence: number;
    tokenUsage: any;
  } | null> {
    let query = supabase.from('dialog_analysis').select('*').eq('dialog_id', dialogId);
    
    if (analysisType) {
      query = query.eq('analysis_type', analysisType);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching structured analysis:', error);
      throw new Error(`Failed to fetch analysis: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      return null;
    }

    // Get the overall score from the first record
    const firstRecord = data[0];
    
    // Extract mistakes from records that have rule_category
    const mistakes = data
      .filter(record => record.rule_category && record.rule_category.trim() !== '')
      .map(record => ({
        rule_category: record.rule_category || '',
        comment: record.comment || '',
        utterance: record.utterance || ''
      }));

    // Extract speaker information from the first record
    const speakers = {
      speaker_0: firstRecord.speaker_0 || undefined,
      role_0: firstRecord.role_0 || undefined,
      speaker_1: firstRecord.speaker_1 || undefined,
      role_1: firstRecord.role_1 || undefined
    };

    return {
      overallScore: firstRecord.overall_score || 0,
      mistakes,
      speakers,
      confidence: firstRecord.confidence || 0,
      tokenUsage: firstRecord.token_usage || {}
    };
  }

  // System configuration operations
  async getSystemConfig(key: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;
    return data?.value || null;
  }

  async updateSystemConfig(key: string, value: string): Promise<void> {
    const { error } = await supabase
      .from('system_config')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);

    if (error) throw error;
  }

  async getAllSystemConfig(): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from('system_config')
      .select('key, value');

    if (error) throw error;
    
    const config: Record<string, string> = {};
    data?.forEach(item => {
      config[item.key] = item.value;
    });
    
    return config;
  }

  // Data cleanup operations
  async cleanupExpiredDialogs(): Promise<number> {
    const { data, error } = await supabase.rpc('cleanup_expired_dialogs');
    if (error) throw error;
    return data || 0;
  }

  async updateDialogExpirationDates(): Promise<number> {
    const { data, error } = await supabase.rpc('update_dialog_expiration_dates');
    if (error) throw error;
    return data || 0;
  }

  // Convert between database and application formats
  convertToDialogFormat(dbDialog: DatabaseDialog, transcriptions?: DatabaseTranscription[], analyses?: DatabaseAnalysis[]): Dialog {
    const dialog: Dialog = {
      id: dbDialog.id,
      fileName: dbDialog.file_name,
      status: dbDialog.status,
      assignedAgent: dbDialog.assigned_agent,
      assignedSupervisor: dbDialog.assigned_supervisor,
      uploadDate: dbDialog.upload_date,
      error: dbDialog.error_message,
      tokenEstimation: {
        audioLengthMinutes: dbDialog.audio_length_minutes || 0,
        estimatedCost: dbDialog.estimated_cost
      },
      qualityScore: dbDialog.quality_score,
      isSegmented: dbDialog.is_segmented,
      parentDialogId: dbDialog.parent_dialog_id,
      segmentCount: dbDialog.segment_count,
      segmentIndex: dbDialog.segment_index,
      currentLanguage: dbDialog.current_language === 'original' ? 'original' : 'russian'
    };

    // Add transcriptions if provided
    if (transcriptions) {
      const plainTranscription = transcriptions.find(t => t.transcription_type === 'plain');
      if (plainTranscription) {
        dialog.transcription = plainTranscription.content;
      }

      const russianTranscription = transcriptions.find(t => t.transcription_type === 'russian');
      if (russianTranscription) {
        dialog.russianTranscription = russianTranscription.content;
      }
    }

    // Add OpenAI analysis if available - use structured format if new columns exist
    if (analyses) {
      const openaiAnalyses = analyses.filter(a => a.analysis_type === 'openai');
      if (openaiAnalyses.length > 0) {
        // Check if we have new structured data (rule_category column)
        const structuredAnalyses = openaiAnalyses.filter(a => a.rule_category && a.rule_category.trim() !== '');
        
        if (structuredAnalyses.length > 0) {
          // Use new structured format
          const firstRecord = openaiAnalyses[0];
          const mistakes = structuredAnalyses.map(record => ({
            rule_category: record.rule_category || '',
            comment: record.comment || '',
            utterance: record.utterance || ''
          }));

          const speakers = {
            speaker_0: firstRecord.speaker_0 || undefined,
            role_0: firstRecord.role_0 || undefined,
            speaker_1: firstRecord.speaker_1 || undefined,
            role_1: firstRecord.role_1 || undefined
          };

          dialog.openaiEvaluation = {
            overallScore: firstRecord.overall_score || 0,
            categoryScores: {},
            mistakes: mistakes,
            recommendations: [],
            summary: `Analysis completed with score: ${firstRecord.overall_score || 0}/100`,
            confidence: firstRecord.confidence || 0,
            tokenUsage: firstRecord.token_usage || {},
            speakers: speakers
          };
        } else {
          // Fallback to old format for backward compatibility
          const openaiAnalysis = openaiAnalyses[0];
          dialog.openaiEvaluation = {
            overallScore: openaiAnalysis.overall_score || 0,
            categoryScores: openaiAnalysis.category_scores,
            mistakes: openaiAnalysis.mistakes,
            recommendations: openaiAnalysis.recommendations,
            summary: openaiAnalysis.summary || '',
            confidence: openaiAnalysis.confidence || 0,
            tokenUsage: openaiAnalysis.token_usage
          };
        }
      }
    }

    return dialog;
  }

  convertToSpeakerUtterances(dbUtterances: DatabaseUtterance[]): SpeakerUtterance[] {
    return dbUtterances.map(utterance => ({
      speaker: utterance.speaker,
      text: utterance.text,
      confidence: utterance.confidence,
      start: utterance.start_time,
      end: utterance.end_time
    }));
  }

  // New methods for speaker name updates
  async updateSpeakerNames(dialogId: string, speakersData: any[]): Promise<void> {
    try {
      if (!speakersData || speakersData.length === 0) return;

      // Get all transcriptions for this dialog
      const transcriptions = await this.getTranscriptions(dialogId);
      const speakerTranscriptions = transcriptions.filter(t => 
        t.transcription_type === 'speaker' || t.transcription_type === 'russian_speaker'
      );

      for (const transcription of speakerTranscriptions) {
        const utterances = await this.getUtterances(transcription.id);
        
        // Apply speaker name mapping
        const updates = utterances.map(utterance => {
          const newSpeakerName = this.mapSpeakerName(utterance.speaker, speakersData);
          if (newSpeakerName !== utterance.speaker) {
            return {
              id: utterance.id,
              speaker: newSpeakerName
            };
          }
          return null;
        }).filter(update => update !== null);

        // Batch update utterances with new speaker names
        if (updates.length > 0) {
          for (const update of updates) {
            await supabase
              .from('dialog_speaker_utterances')
              .update({ speaker: update!.speaker })
              .eq('id', update!.id);
          }
        }
      }

      console.log(`✅ Updated speaker names for dialog ${dialogId}`);
    } catch (error) {
      console.error('Error updating speaker names:', error);
      throw error;
    }
  }

  private mapSpeakerName(currentSpeaker: string, speakersData: any[]): string {
    // Handle the new speaker data format
    for (const speakerInfo of speakersData) {
      if (speakerInfo.speaker_0 && speakerInfo.role_0) {
        if (currentSpeaker === 'Speaker 0' || 
            (speakerInfo.role_0 === 'Agent' && currentSpeaker === 'Agent') ||
            (speakerInfo.role_0 === 'Customer' && currentSpeaker === 'Customer')) {
          return speakerInfo.speaker_0;
        }
      }
      
      if (speakerInfo.speaker_1 && speakerInfo.role_1) {
        if (currentSpeaker === 'Speaker 1' || 
            (speakerInfo.role_1 === 'Agent' && currentSpeaker === 'Agent') ||
            (speakerInfo.role_1 === 'Customer' && currentSpeaker === 'Customer')) {
          return speakerInfo.speaker_1;
        }
      }
    }
    
    return currentSpeaker; // Return original if no mapping found
  }

  applySpeakerNames(utterances: SpeakerUtterance[], speakersData: any[]): SpeakerUtterance[] {
    return utterances.map(utterance => ({
      ...utterance,
      speaker: this.mapSpeakerName(utterance.speaker, speakersData)
    }));
  }
}

export const databaseService = new DatabaseService();
export { ValidationError };
