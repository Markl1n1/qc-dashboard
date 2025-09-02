-- Create audio-files storage bucket for temporary file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-files', 'audio-files', false);

-- Create storage policies for audio files
CREATE POLICY "Users can upload audio files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'audio-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "System can access audio files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'audio-files');