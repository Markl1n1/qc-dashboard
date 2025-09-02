-- Add columns for storing original and Russian comments
ALTER TABLE public.dialog_analysis 
ADD COLUMN comment_original text,
ADD COLUMN comment_russian text;