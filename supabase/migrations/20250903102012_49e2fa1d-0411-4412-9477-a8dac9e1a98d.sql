-- Add keyterm prompts configuration for different languages
INSERT INTO public.system_config (key, value, description) VALUES 
('keyterm_prompt_en', 'VoiceQC, transcription, diarization, audio analysis, quality control', 'English keyterm prompts for Deepgram Nova-3 model'),
('keyterm_prompt_ru', 'ВойсКЮСи, транскрипция, диаризация, анализ аудио', 'Russian keyterm prompts for Deepgram Nova-3 model'),
('keyterm_prompt_de', 'VoiceQC, Transkription, Sprechertrennung, Audio-Analyse', 'German keyterm prompts for Deepgram Nova-3 model'),
('keyterm_prompt_es', 'VoiceQC, transcripción, diarización, análisis de audio', 'Spanish keyterm prompts for Deepgram Nova-3 model'),
('keyterm_prompt_fr', 'VoiceQC, transcription, diarisation, analyse audio', 'French keyterm prompts for Deepgram Nova-3 model'),
('keyterm_prompt_it', 'VoiceQC, trascrizione, diarizzazione, analisi audio', 'Italian keyterm prompts for Deepgram Nova-3 model'),
('keyterm_prompt_pt', 'VoiceQC, transcrição, diarização, análise de áudio', 'Portuguese keyterm prompts for Deepgram Nova-3 model'),
('keyterm_prompt_zh', 'VoiceQC, 转录, 说话人分离, 音频分析', 'Chinese keyterm prompts for Deepgram Nova-3 model'),
('keyterm_prompt_ja', 'VoiceQC, 転写, 話者分離, 音声解析', 'Japanese keyterm prompts for Deepgram Nova-3 model'),
('keyterm_prompt_ko', 'VoiceQC, 전사, 화자 분리, 오디오 분석', 'Korean keyterm prompts for Deepgram Nova-3 model'),
('keyterm_prompt_ar', 'VoiceQC, النسخ, فصل المتحدثين, تحليل الصوت', 'Arabic keyterm prompts for Deepgram Nova-3 model'),
('keyterm_prompt_hi', 'VoiceQC, ट्रांसक्रिप्शन, डायराइज़ेशन, ऑडियो विश्लेषण', 'Hindi keyterm prompts for Deepgram Nova-3 model'),
('keyterm_prompt_nl', 'VoiceQC, transcriptie, sprekerherkenning, audio-analyse', 'Dutch keyterm prompts for Deepgram Nova-3 model'),
('keyterm_prompt_pl', 'VoiceQC, transkrypcja, diaryzacja, analiza audio', 'Polish keyterm prompts for Deepgram Nova-3 model'),
('keyterm_prompt_sv', 'VoiceQC, transkription, talaridentifiering, ljudanalys', 'Swedish keyterm prompts for Deepgram Nova-3 model')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- Update storage bucket policy to allow signed URL generation
UPDATE storage.buckets SET public = true WHERE id = 'audio-files';