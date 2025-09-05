-- Add missing keyterm entries to system_config
INSERT INTO public.system_config (key, value, description) VALUES 
('keyterm_prompt_ru', 'ВойсКЮСи, транскрипция, диаризация, анализ аудио', 'Russian keyterm prompts for Nova-3 transcription')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.system_config (key, value, description) VALUES 
('keyterm_prompt_de', 'VoiceQC, Transkription, Sprechertrennung, Audio-Analyse', 'German keyterm prompts for Nova-3 transcription')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.system_config (key, value, description) VALUES 
('keyterm_prompt_es', 'VoiceQC, transcripción, diarización, análisis de audio', 'Spanish keyterm prompts for Nova-3 transcription')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.system_config (key, value, description) VALUES 
('keyterm_prompt_fr', 'VoiceQC, transcription, diarisation, analyse audio', 'French keyterm prompts for Nova-3 transcription')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.system_config (key, value, description) VALUES 
('keyterm_prompt_pl', 'VoiceQC, transkrypcja, diaryzacja, analiza audio', 'Polish keyterm prompts for Nova-3 transcription')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Fix Nova-2 and Nova-3 language assignments to prevent the Russian + Nova-3 error
UPDATE public.system_config 
SET value = '["en"]'
WHERE key = 'deepgram_nova2_languages';

UPDATE public.system_config 
SET value = '["es","fr","de","it","pt","zh","ja","ko","ar","pl"]'
WHERE key = 'deepgram_nova3_languages';