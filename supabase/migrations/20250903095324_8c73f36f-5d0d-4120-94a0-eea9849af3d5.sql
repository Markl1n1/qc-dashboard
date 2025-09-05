-- Add Deepgram language-to-model mapping configuration
INSERT INTO public.system_config (key, value, description) VALUES 
('deepgram_nova2_languages', '["pl","ru"]', 'Languages assigned to Nova-2 model for Deepgram transcription'),
('deepgram_nova3_languages', '["es", "fr", "de", "en"]', 'Languages assigned to Nova-3 model for Deepgram transcription')
ON CONFLICT (key) DO NOTHING;