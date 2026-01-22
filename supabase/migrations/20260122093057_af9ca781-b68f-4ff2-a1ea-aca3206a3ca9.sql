-- Add INSERT policy for system_config table (only admins can insert)
CREATE POLICY "Only admins can insert system_config"
ON public.system_config
FOR INSERT
TO authenticated
WITH CHECK (get_current_user_role() = 'admin');