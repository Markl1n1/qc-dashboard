-- Make audio-files bucket private instead of public
UPDATE storage.buckets SET public = false WHERE id = 'audio-files';

-- Drop the overly permissive storage policy
DROP POLICY IF EXISTS "System can access audio files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can access their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read audio files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads from audio-files" ON storage.objects;

-- Create secure storage policies for audio-files bucket
-- Authenticated users can upload files to the bucket
CREATE POLICY "Authenticated users can upload audio files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio-files');

-- Authenticated users can view files in the bucket (needed for signed URL generation)
CREATE POLICY "Authenticated users can view audio files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'audio-files');

-- Authenticated users can delete their uploaded files
CREATE POLICY "Authenticated users can delete audio files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'audio-files');

-- Service role has full access (used by edge functions)
-- Note: service_role already bypasses RLS, this is for documentation only