-- Check current policies on system_config table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'system_config';

-- Update the RLS policy to restrict access to authenticated users only
DROP POLICY IF EXISTS "Allow public read access to system_config" ON public.system_config;

-- Create a new policy that only allows authenticated users to read system_config
CREATE POLICY "Allow authenticated users to read system_config" 
ON public.system_config 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Ensure RLS is enabled on the table
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;