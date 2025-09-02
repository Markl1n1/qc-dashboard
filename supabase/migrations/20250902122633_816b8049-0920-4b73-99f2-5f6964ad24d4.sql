-- Drop the existing check constraint
ALTER TABLE dialog_analysis DROP CONSTRAINT IF EXISTS dialog_analysis_analysis_type_check;

-- Add the updated check constraint to include 'openai_background'
ALTER TABLE dialog_analysis ADD CONSTRAINT dialog_analysis_analysis_type_check 
CHECK (analysis_type = ANY (ARRAY['lemur'::text, 'openai'::text, 'openai_background'::text]));