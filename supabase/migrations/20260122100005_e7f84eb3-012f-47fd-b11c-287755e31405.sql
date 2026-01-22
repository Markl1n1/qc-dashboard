-- Ensure system_config table has RLS enabled (should already be enabled)
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well (prevents bypassing RLS even for table owner)
ALTER TABLE public.system_config FORCE ROW LEVEL SECURITY;

-- Drop any existing overly permissive policies that might exist
DROP POLICY IF EXISTS "Anyone can read system_config" ON public.system_config;
DROP POLICY IF EXISTS "Public can read system_config" ON public.system_config;
DROP POLICY IF EXISTS "Allow public read" ON public.system_config;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.system_config;

-- The existing policies are correct:
-- "Only admins can read system_config" - Restrictive SELECT for admins
-- "Only admins can update system_config" - Restrictive UPDATE for admins
-- "Only admins can insert system_config" - Restrictive INSERT for admins
-- "Secure signup_passcode access" - Additional restrictive SELECT hiding passcode

-- Add a comment to document the security design
COMMENT ON TABLE public.system_config IS 'System configuration table. Access restricted to admins only via RLS. Edge functions use service role to bypass RLS for reading configuration values like model settings and keyterm prompts.';