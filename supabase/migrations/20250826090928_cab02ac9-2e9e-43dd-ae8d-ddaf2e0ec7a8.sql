
-- Create storage bucket for AI instructions (admin only)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-instructions', 'ai-instructions', false);

-- Create RLS policies for ai-instructions bucket (admin only access)
CREATE POLICY "Admin users can view AI instruction files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ai-instructions' AND 
  get_current_user_role() = 'admin'
);

CREATE POLICY "Admin users can upload AI instruction files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ai-instructions' AND 
  get_current_user_role() = 'admin'
);

CREATE POLICY "Admin users can delete AI instruction files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ai-instructions' AND 
  get_current_user_role() = 'admin'
);

-- Add AI configuration settings to system_config
INSERT INTO public.system_config (key, value, description) VALUES
('ai_confidence_threshold', '0.8', 'Confidence threshold for switching from GPT-5 Mini to GPT-5'),
('ai_max_tokens_gpt5_mini', '1000', 'Maximum output tokens for GPT-5 Mini model'),
('ai_max_tokens_gpt5', '2000', 'Maximum output tokens for GPT-5 model'),
('ai_temperature', '0.7', 'Temperature setting for OpenAI models (where supported)'),
('ai_reasoning_effort', 'medium', 'Reasoning effort level: low, medium, or high')
ON CONFLICT (key) DO NOTHING;
