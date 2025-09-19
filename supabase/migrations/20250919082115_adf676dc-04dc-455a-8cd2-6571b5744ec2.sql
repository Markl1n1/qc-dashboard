-- Fix system_config security vulnerability by removing the overly permissive policy
-- that allows any authenticated user to update system configuration

-- Drop the problematic policy that allows any authenticated user to update system config
DROP POLICY IF EXISTS "Authenticated users can update system config" ON public.system_config;

-- Verify that only the admin-restricted policies remain:
-- 1. "Only admins can read system_config" - SELECT for admins only
-- 2. "Only admins can update system_config" - UPDATE for admins only  
-- 3. "Secure signup_passcode access" - SELECT with restrictions on signup_passcode

-- The deepgram_api_keys table is already properly secured with:
-- "Only admins can manage Deepgram API keys" policy for ALL operations