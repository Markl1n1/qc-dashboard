-- Remove public access to signup passcode for security
-- This prevents the passcode from being exposed to unauthenticated users
DROP POLICY IF EXISTS "Allow unauthenticated signup_passcode access" ON system_config;

-- Ensure only authenticated admins can access system config
-- The existing policies should handle this, but let's be explicit
CREATE POLICY "Secure signup_passcode access" 
ON system_config 
FOR SELECT 
USING (
  key != 'signup_passcode' OR 
  get_current_user_role() = 'admin'
);

-- Add comment for clarity
COMMENT ON POLICY "Secure signup_passcode access" ON system_config IS 'Prevents unauthenticated access to signup passcode while allowing admin access';