-- Remove the overly permissive system_config policy that allows all authenticated users to read system config
DROP POLICY IF EXISTS "Allow authenticated users to read system_config" ON public.system_config;

-- Ensure only admin-only policies remain for system_config security
-- The existing "Only admins can read system_config" and "Secure signup_passcode access" policies will remain active