-- Add new columns to dialog_analysis table for parsed evaluation data
ALTER TABLE public.dialog_analysis 
ADD COLUMN comment TEXT,
ADD COLUMN utterance TEXT,
ADD COLUMN rule_category TEXT,
ADD COLUMN speaker_0 TEXT,
ADD COLUMN role_0 TEXT,
ADD COLUMN speaker_1 TEXT,
ADD COLUMN role_1 TEXT;

-- Add index for better performance on rule_category queries
CREATE INDEX idx_dialog_analysis_rule_category ON public.dialog_analysis(rule_category);

-- Add index for dialog_id and rule_category combination
CREATE INDEX idx_dialog_analysis_dialog_rule ON public.dialog_analysis(dialog_id, rule_category);