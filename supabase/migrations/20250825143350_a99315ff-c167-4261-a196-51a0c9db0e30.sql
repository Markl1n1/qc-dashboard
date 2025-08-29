
-- Create dialogs table for storing main dialog information
CREATE TABLE public.dialogs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  assigned_agent TEXT NOT NULL,
  assigned_supervisor TEXT NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  error_message TEXT,
  audio_length_minutes NUMERIC,
  estimated_cost NUMERIC DEFAULT 0,
  quality_score INTEGER,
  is_segmented BOOLEAN DEFAULT false,
  parent_dialog_id UUID REFERENCES public.dialogs(id) ON DELETE CASCADE,
  segment_count INTEGER,
  segment_index INTEGER,
  current_language TEXT DEFAULT 'original',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create dialog_transcriptions table for storing transcription data
CREATE TABLE public.dialog_transcriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dialog_id UUID REFERENCES public.dialogs(id) ON DELETE CASCADE NOT NULL,
  transcription_type TEXT NOT NULL CHECK (transcription_type IN ('plain', 'speaker', 'russian', 'russian_speaker')),
  content TEXT,
  confidence NUMERIC,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create dialog_speaker_utterances table for individual speaker utterances
CREATE TABLE public.dialog_speaker_utterances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transcription_id UUID REFERENCES public.dialog_transcriptions(id) ON DELETE CASCADE NOT NULL,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  confidence NUMERIC DEFAULT 0,
  start_time NUMERIC DEFAULT 0,
  end_time NUMERIC DEFAULT 0,
  utterance_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create dialog_analysis table for storing AI analysis results
CREATE TABLE public.dialog_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dialog_id UUID REFERENCES public.dialogs(id) ON DELETE CASCADE NOT NULL,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('openai')),
  overall_score INTEGER,
  category_scores JSONB DEFAULT '{}',
  mistakes JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  summary TEXT,
  confidence NUMERIC,
  token_usage JSONB,
  banned_words_detected JSONB DEFAULT '[]',
  sentiment JSONB,
  conversation_flow JSONB,
  processing_time NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Update system_config table with new admin settings
INSERT INTO public.system_config (key, value, description) 
VALUES 
  ('data_retention_days', '30', 'Number of days to retain dialog data before automatic deletion'),
  ('max_file_size_mb', '100', 'Maximum file size allowed for upload in MB'),
  ('max_concurrent_transcriptions', '5', 'Maximum number of concurrent transcription processes'),
  ('auto_delete_enabled', 'true', 'Enable automatic deletion of expired dialogs')
ON CONFLICT (key) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX idx_dialogs_user_id ON public.dialogs(user_id);
CREATE INDEX idx_dialogs_upload_date ON public.dialogs(upload_date);
CREATE INDEX idx_dialogs_expires_at ON public.dialogs(expires_at);
CREATE INDEX idx_dialogs_status ON public.dialogs(status);
CREATE INDEX idx_dialog_transcriptions_dialog_id ON public.dialog_transcriptions(dialog_id);
CREATE INDEX idx_dialog_transcriptions_type ON public.dialog_transcriptions(transcription_type);
CREATE INDEX idx_dialog_speaker_utterances_transcription_id ON public.dialog_speaker_utterances(transcription_id);
CREATE INDEX idx_dialog_speaker_utterances_order ON public.dialog_speaker_utterances(utterance_order);
CREATE INDEX idx_dialog_analysis_dialog_id ON public.dialog_analysis(dialog_id);
CREATE INDEX idx_dialog_analysis_type ON public.dialog_analysis(analysis_type);

-- Enable Row Level Security on all tables
ALTER TABLE public.dialogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialog_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialog_speaker_utterances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialog_analysis ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for dialogs table
CREATE POLICY "Users can view their own dialogs" 
  ON public.dialogs 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dialogs" 
  ON public.dialogs 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dialogs" 
  ON public.dialogs 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dialogs" 
  ON public.dialogs 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create RLS policies for dialog_transcriptions table
CREATE POLICY "Users can view transcriptions of their dialogs" 
  ON public.dialog_transcriptions 
  FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.dialogs WHERE id = dialog_id AND user_id = auth.uid()));

CREATE POLICY "Users can create transcriptions for their dialogs" 
  ON public.dialog_transcriptions 
  FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.dialogs WHERE id = dialog_id AND user_id = auth.uid()));

CREATE POLICY "Users can update transcriptions of their dialogs" 
  ON public.dialog_transcriptions 
  FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.dialogs WHERE id = dialog_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete transcriptions of their dialogs" 
  ON public.dialog_transcriptions 
  FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.dialogs WHERE id = dialog_id AND user_id = auth.uid()));

-- Create RLS policies for dialog_speaker_utterances table
CREATE POLICY "Users can view utterances of their dialog transcriptions" 
  ON public.dialog_speaker_utterances 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.dialog_transcriptions dt 
    JOIN public.dialogs d ON dt.dialog_id = d.id 
    WHERE dt.id = transcription_id AND d.user_id = auth.uid()
  ));

CREATE POLICY "Users can create utterances for their dialog transcriptions" 
  ON public.dialog_speaker_utterances 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.dialog_transcriptions dt 
    JOIN public.dialogs d ON dt.dialog_id = d.id 
    WHERE dt.id = transcription_id AND d.user_id = auth.uid()
  ));

CREATE POLICY "Users can update utterances of their dialog transcriptions" 
  ON public.dialog_speaker_utterances 
  FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.dialog_transcriptions dt 
    JOIN public.dialogs d ON dt.dialog_id = d.id 
    WHERE dt.id = transcription_id AND d.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete utterances of their dialog transcriptions" 
  ON public.dialog_speaker_utterances 
  FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.dialog_transcriptions dt 
    JOIN public.dialogs d ON dt.dialog_id = d.id 
    WHERE dt.id = transcription_id AND d.user_id = auth.uid()
  ));

-- Create RLS policies for dialog_analysis table
CREATE POLICY "Users can view analysis of their dialogs" 
  ON public.dialog_analysis 
  FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.dialogs WHERE id = dialog_id AND user_id = auth.uid()));

CREATE POLICY "Users can create analysis for their dialogs" 
  ON public.dialog_analysis 
  FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.dialogs WHERE id = dialog_id AND user_id = auth.uid()));

CREATE POLICY "Users can update analysis of their dialogs" 
  ON public.dialog_analysis 
  FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.dialogs WHERE id = dialog_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete analysis of their dialogs" 
  ON public.dialog_analysis 
  FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.dialogs WHERE id = dialog_id AND user_id = auth.uid()));

-- Create function to calculate dialog expiration date
CREATE OR REPLACE FUNCTION public.calculate_dialog_expiration()
RETURNS TRIGGER AS $$
DECLARE
  retention_days INTEGER;
BEGIN
  SELECT value::INTEGER INTO retention_days 
  FROM public.system_config 
  WHERE key = 'data_retention_days';
  
  IF retention_days IS NULL THEN
    retention_days := 30; -- Default fallback
  END IF;
  
  NEW.expires_at := NEW.created_at + (retention_days || ' days')::INTERVAL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to set expiration date on dialog creation
CREATE TRIGGER set_dialog_expiration
  BEFORE INSERT ON public.dialogs
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_dialog_expiration();

-- Create function for automatic data cleanup
CREATE OR REPLACE FUNCTION public.cleanup_expired_dialogs()
RETURNS INTEGER AS $$
DECLARE
  auto_delete_enabled BOOLEAN;
  deleted_count INTEGER;
BEGIN
  SELECT value::BOOLEAN INTO auto_delete_enabled 
  FROM public.system_config 
  WHERE key = 'auto_delete_enabled';
  
  IF auto_delete_enabled IS NULL OR auto_delete_enabled = false THEN
    RETURN 0;
  END IF;
  
  DELETE FROM public.dialogs 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update dialog retention period
CREATE OR REPLACE FUNCTION public.update_dialog_expiration_dates()
RETURNS INTEGER AS $$
DECLARE
  retention_days INTEGER;
  updated_count INTEGER;
BEGIN
  SELECT value::INTEGER INTO retention_days 
  FROM public.system_config 
  WHERE key = 'data_retention_days';
  
  IF retention_days IS NULL THEN
    retention_days := 30;
  END IF;
  
  UPDATE public.dialogs 
  SET expires_at = created_at + (retention_days || ' days')::INTERVAL
  WHERE expires_at IS NULL OR expires_at != created_at + (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
