export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Relationships: []
      }
      deepgram_api_keys: {
        Row: {
          api_key: string
          consecutive_failures: number
          created_at: string
          deactivated_at: string | null
          failure_count: number
          id: string
          is_active: boolean
          key_name: string
          last_failure_at: string | null
          last_used_at: string | null
          success_count: number
          updated_at: string
        }
        Insert: {
          api_key: string
          consecutive_failures?: number
          created_at?: string
          deactivated_at?: string | null
          failure_count?: number
          id?: string
          is_active?: boolean
          key_name: string
          last_failure_at?: string | null
          last_used_at?: string | null
          success_count?: number
          updated_at?: string
        }
        Update: {
          api_key?: string
          consecutive_failures?: number
          created_at?: string
          deactivated_at?: string | null
          failure_count?: number
          id?: string
          is_active?: boolean
          key_name?: string
          last_failure_at?: string | null
          last_used_at?: string | null
          success_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      deepgram_usage_log: {
        Row: {
          api_key_id: string
          audio_duration_seconds: number | null
          created_at: string
          error_message: string | null
          file_size_bytes: number | null
          id: string
          request_type: string
          response_time_ms: number | null
          success: boolean
        }
        Insert: {
          api_key_id: string
          audio_duration_seconds?: number | null
          created_at?: string
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          request_type?: string
          response_time_ms?: number | null
          success: boolean
        }
        Update: {
          api_key_id?: string
          audio_duration_seconds?: number | null
          created_at?: string
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          request_type?: string
          response_time_ms?: number | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "deepgram_usage_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "deepgram_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      dialog_analysis: {
        Row: {
          analysis_type: string
          banned_words_detected: Json | null
          category_scores: Json | null
          comment: string | null
          comment_original: string | null
          comment_russian: string | null
          confidence: number | null
          conversation_flow: Json | null
          created_at: string
          dialog_id: string
          id: string
          mistakes: Json | null
          overall_score: number | null
          processing_time: number | null
          recommendations: Json | null
          role_0: string | null
          role_1: string | null
          rule_category: string | null
          sentiment: Json | null
          speaker_0: string | null
          speaker_1: string | null
          summary: string | null
          token_usage: Json | null
          updated_at: string
          utterance: string | null
        }
        Insert: {
          analysis_type: string
          banned_words_detected?: Json | null
          category_scores?: Json | null
          comment?: string | null
          comment_original?: string | null
          comment_russian?: string | null
          confidence?: number | null
          conversation_flow?: Json | null
          created_at?: string
          dialog_id: string
          id?: string
          mistakes?: Json | null
          overall_score?: number | null
          processing_time?: number | null
          recommendations?: Json | null
          role_0?: string | null
          role_1?: string | null
          rule_category?: string | null
          sentiment?: Json | null
          speaker_0?: string | null
          speaker_1?: string | null
          summary?: string | null
          token_usage?: Json | null
          updated_at?: string
          utterance?: string | null
        }
        Update: {
          analysis_type?: string
          banned_words_detected?: Json | null
          category_scores?: Json | null
          comment?: string | null
          comment_original?: string | null
          comment_russian?: string | null
          confidence?: number | null
          conversation_flow?: Json | null
          created_at?: string
          dialog_id?: string
          id?: string
          mistakes?: Json | null
          overall_score?: number | null
          processing_time?: number | null
          recommendations?: Json | null
          role_0?: string | null
          role_1?: string | null
          rule_category?: string | null
          sentiment?: Json | null
          speaker_0?: string | null
          speaker_1?: string | null
          summary?: string | null
          token_usage?: Json | null
          updated_at?: string
          utterance?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dialog_analysis_dialog_id_fkey"
            columns: ["dialog_id"]
            isOneToOne: false
            referencedRelation: "dialogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dialog_speaker_utterances: {
        Row: {
          confidence: number | null
          created_at: string
          end_time: number | null
          id: string
          speaker: string
          start_time: number | null
          text: string
          transcription_id: string
          utterance_order: number
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          end_time?: number | null
          id?: string
          speaker: string
          start_time?: number | null
          text: string
          transcription_id: string
          utterance_order: number
        }
        Update: {
          confidence?: number | null
          created_at?: string
          end_time?: number | null
          id?: string
          speaker?: string
          start_time?: number | null
          text?: string
          transcription_id?: string
          utterance_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "dialog_speaker_utterances_transcription_id_fkey"
            columns: ["transcription_id"]
            isOneToOne: false
            referencedRelation: "dialog_transcriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      dialog_transcriptions: {
        Row: {
          confidence: number | null
          content: string | null
          created_at: string
          dialog_id: string
          id: string
          language: string | null
          transcription_type: string
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          content?: string | null
          created_at?: string
          dialog_id: string
          id?: string
          language?: string | null
          transcription_type: string
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          content?: string | null
          created_at?: string
          dialog_id?: string
          id?: string
          language?: string | null
          transcription_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dialog_transcriptions_dialog_id_fkey"
            columns: ["dialog_id"]
            isOneToOne: false
            referencedRelation: "dialogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dialogs: {
        Row: {
          assigned_agent: string
          assigned_supervisor: string
          audio_length_minutes: number | null
          created_at: string
          current_language: string | null
          error_message: string | null
          estimated_cost: number | null
          expires_at: string | null
          file_name: string
          id: string
          is_segmented: boolean | null
          parent_dialog_id: string | null
          quality_score: number | null
          segment_count: number | null
          segment_index: number | null
          status: string
          updated_at: string
          upload_date: string
          user_id: string
        }
        Insert: {
          assigned_agent: string
          assigned_supervisor: string
          audio_length_minutes?: number | null
          created_at?: string
          current_language?: string | null
          error_message?: string | null
          estimated_cost?: number | null
          expires_at?: string | null
          file_name: string
          id?: string
          is_segmented?: boolean | null
          parent_dialog_id?: string | null
          quality_score?: number | null
          segment_count?: number | null
          segment_index?: number | null
          status?: string
          updated_at?: string
          upload_date?: string
          user_id: string
        }
        Update: {
          assigned_agent?: string
          assigned_supervisor?: string
          audio_length_minutes?: number | null
          created_at?: string
          current_language?: string | null
          error_message?: string | null
          estimated_cost?: number | null
          expires_at?: string | null
          file_name?: string
          id?: string
          is_segmented?: boolean | null
          parent_dialog_id?: string | null
          quality_score?: number | null
          segment_count?: number | null
          segment_index?: number | null
          status?: string
          updated_at?: string
          upload_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dialogs_parent_dialog_id_fkey"
            columns: ["parent_dialog_id"]
            isOneToOne: false
            referencedRelation: "dialogs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          role: string | null
          theme: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          role?: string | null
          theme?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          role?: string | null
          theme?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_dialogs: { Args: never; Returns: number }
      get_current_user_role: { Args: never; Returns: string }
      get_next_deepgram_key: {
        Args: never
        Returns: {
          api_key: string
          id: string
        }[]
      }
      update_deepgram_key_status: {
        Args: {
          duration?: number
          error_msg?: string
          file_size?: number
          is_success: boolean
          key_id: string
          response_time?: number
        }
        Returns: undefined
      }
      update_dialog_expiration_dates: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
