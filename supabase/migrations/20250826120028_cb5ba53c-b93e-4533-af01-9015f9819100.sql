
-- Create table to store Deepgram API keys
CREATE TABLE public.deepgram_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  failure_count INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  deactivated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to log API key usage
CREATE TABLE public.deepgram_usage_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES public.deepgram_api_keys(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL DEFAULT 'transcription',
  success BOOLEAN NOT NULL,
  error_message TEXT,
  response_time_ms INTEGER,
  file_size_bytes BIGINT,
  audio_duration_seconds NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security
ALTER TABLE public.deepgram_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deepgram_usage_log ENABLE ROW LEVEL SECURITY;

-- Create policies for deepgram_api_keys (admin only)
CREATE POLICY "Only admins can manage Deepgram API keys" 
  ON public.deepgram_api_keys 
  FOR ALL 
  USING (get_current_user_role() = 'admin');

-- Create policies for deepgram_usage_log (admin read, system write)
CREATE POLICY "Only admins can read usage logs" 
  ON public.deepgram_usage_log 
  FOR SELECT 
  USING (get_current_user_role() = 'admin');

CREATE POLICY "System can insert usage logs" 
  ON public.deepgram_usage_log 
  FOR INSERT 
  WITH CHECK (true);

-- Create function to get next available API key
CREATE OR REPLACE FUNCTION public.get_next_deepgram_key()
RETURNS TABLE(id UUID, api_key TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT dk.id, dk.api_key
  FROM public.deepgram_api_keys dk
  WHERE dk.is_active = true
  ORDER BY 
    COALESCE(dk.last_used_at, '1970-01-01'::timestamp with time zone) ASC,
    dk.success_count DESC,
    dk.failure_count ASC
  LIMIT 1;
END;
$$;

-- Create function to update API key status
CREATE OR REPLACE FUNCTION public.update_deepgram_key_status(
  key_id UUID,
  is_success BOOLEAN,
  error_msg TEXT DEFAULT NULL,
  response_time INTEGER DEFAULT NULL,
  file_size BIGINT DEFAULT NULL,
  duration NUMERIC DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_consecutive_failures INTEGER;
BEGIN
  -- Update the API key statistics
  IF is_success THEN
    UPDATE public.deepgram_api_keys 
    SET 
      success_count = success_count + 1,
      consecutive_failures = 0,
      last_used_at = now(),
      updated_at = now()
    WHERE id = key_id;
  ELSE
    UPDATE public.deepgram_api_keys 
    SET 
      failure_count = failure_count + 1,
      consecutive_failures = consecutive_failures + 1,
      last_failure_at = now(),
      updated_at = now()
    WHERE id = key_id
    RETURNING consecutive_failures INTO current_consecutive_failures;
    
    -- Deactivate key if it has 5 consecutive failures
    IF current_consecutive_failures >= 5 THEN
      UPDATE public.deepgram_api_keys 
      SET 
        is_active = false,
        deactivated_at = now(),
        updated_at = now()
      WHERE id = key_id;
    END IF;
  END IF;
  
  -- Log the usage
  INSERT INTO public.deepgram_usage_log (
    api_key_id, 
    success, 
    error_message, 
    response_time_ms, 
    file_size_bytes, 
    audio_duration_seconds
  ) VALUES (
    key_id, 
    is_success, 
    error_msg, 
    response_time, 
    file_size, 
    duration
  );
END;
$$;

-- Create indexes for performance
CREATE INDEX idx_deepgram_keys_active ON public.deepgram_api_keys(is_active);
CREATE INDEX idx_deepgram_keys_last_used ON public.deepgram_api_keys(last_used_at);
CREATE INDEX idx_usage_log_key_id ON public.deepgram_usage_log(api_key_id);
CREATE INDEX idx_usage_log_created_at ON public.deepgram_usage_log(created_at);
