-- Allow unauthenticated access to signup_passcode for registration
CREATE POLICY "Allow unauthenticated signup_passcode access" 
ON public.system_config 
FOR SELECT 
USING (key = 'signup_passcode');