
import { supabase } from '../integrations/supabase/client';
import { Dialog, SpeakerUtterance, AIAnalysis } from '../types';

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
  analysis_type: 'lemur' | 'openai';
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
}

class DatabaseService {
  // Dialog operations
  async createDialog(dialog: Omit<DatabaseDialog, 'id' | 'created_at' | 'updated_at' | 'expires_at'>): Promise<DatabaseDialog> {
    const { data, error } = await supabase
      .from('dialogs')
      .insert([dialog])
      .select()
      .single();

    if (error) throw error;
    return data as DatabaseDialog;
  }

  async getDialogs(userId?: string): Promise<DatabaseDialog[]> {
    let query = supabase.from('dialogs').select('*').order('upload_date', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as DatabaseDialog[];
  }

  async getDialog(id: string): Promise<DatabaseDialog | null> {
    const { data, error } = await supabase
      .from('dialogs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as DatabaseDialog | null;
  }

  async updateDialog(id: string, updates: Partial<DatabaseDialog>): Promise<DatabaseDialog> {
    const { data, error } = await supabase
      .from('dialogs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as DatabaseDialog;
  }

  async deleteDialog(id: string): Promise<void> {
    const { error } = await supabase
      .from('dialogs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Transcription operations
  async createTranscription(transcription: Omit<DatabaseTranscription, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseTranscription> {
    const { data, error } = await supabase
      .from('dialog_transcriptions')
      .insert([transcription])
      .select()
      .single();

    if (error) throw error;
    return data as DatabaseTranscription;
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

  async getAnalysis(dialogId: string, analysisType?: 'lemur' | 'openai'): Promise<DatabaseAnalysis[]> {
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

    // Add analyses if provided
    if (analyses) {
      const lemurAnalysis = analyses.find(a => a.analysis_type === 'lemur');
      if (lemurAnalysis) {
        dialog.lemurEvaluation = {
          overallScore: lemurAnalysis.overall_score || 0,
          categoryScores: lemurAnalysis.category_scores,
          mistakes: lemurAnalysis.mistakes,
          recommendations: lemurAnalysis.recommendations,
          summary: lemurAnalysis.summary || '',
          confidence: lemurAnalysis.confidence || 0,
          tokenUsage: lemurAnalysis.token_usage
        };
      }

      const openaiAnalysis = analyses.find(a => a.analysis_type === 'openai');
      if (openaiAnalysis) {
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
}

export const databaseService = new DatabaseService();
