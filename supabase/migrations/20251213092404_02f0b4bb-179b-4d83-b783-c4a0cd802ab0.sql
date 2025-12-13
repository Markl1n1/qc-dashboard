-- Create transcription_logs table for detailed debugging
CREATE TABLE public.transcription_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dialog_id UUID REFERENCES public.dialogs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Deepgram identifiers
  deepgram_request_id TEXT,
  deepgram_sha256 TEXT,
  
  -- File info
  file_name TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  
  -- Duration metrics
  audio_duration_reported NUMERIC,
  last_utterance_end NUMERIC,
  first_utterance_start NUMERIC,
  coverage_percentage NUMERIC,
  
  -- Utterance stats
  total_utterances INTEGER,
  total_talk_time_seconds NUMERIC,
  total_pause_time_seconds NUMERIC,
  unique_speakers INTEGER,
  
  -- Gap analysis
  max_gap_seconds NUMERIC,
  avg_gap_seconds NUMERIC,
  gaps_over_5s INTEGER,
  
  -- Performance metrics
  processing_time_ms INTEGER,
  deepgram_response_time_ms INTEGER,
  upload_time_ms INTEGER,
  
  -- Raw data for deep analysis
  raw_metadata JSONB,
  gap_analysis JSONB,
  utterance_summary JSONB,
  
  -- Validation
  validation_warnings JSONB DEFAULT '[]'::jsonb,
  is_potentially_truncated BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.transcription_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view logs of their dialogs"
ON public.transcription_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM dialogs
    WHERE dialogs.id = transcription_logs.dialog_id
    AND dialogs.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all transcription logs"
ON public.transcription_logs FOR SELECT
USING (get_current_user_role() = 'admin');

CREATE POLICY "System can insert transcription logs"
ON public.transcription_logs FOR INSERT
WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX idx_transcription_logs_dialog_id ON public.transcription_logs(dialog_id);
CREATE INDEX idx_transcription_logs_created_at ON public.transcription_logs(created_at DESC);