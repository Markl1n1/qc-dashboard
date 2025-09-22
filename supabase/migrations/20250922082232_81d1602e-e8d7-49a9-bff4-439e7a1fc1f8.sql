-- Create audit_logs table for tracking admin actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for audit_logs (with IF NOT EXISTS equivalent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Only admins can read audit logs' 
    AND tablename = 'audit_logs'
  ) THEN
    CREATE POLICY "Only admins can read audit logs" 
    ON public.audit_logs 
    FOR SELECT 
    USING (get_current_user_role() = 'admin');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'System can insert audit logs' 
    AND tablename = 'audit_logs'
  ) THEN
    CREATE POLICY "System can insert audit logs" 
    ON public.audit_logs 
    FOR INSERT 
    WITH CHECK (true);
  END IF;
END $$;

-- Add indexes only if they don't exist
CREATE INDEX IF NOT EXISTS idx_dialogs_status ON public.dialogs(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at ON public.audit_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON public.system_config(key);

-- Update existing dialogs to have proper expiration dates
UPDATE public.dialogs 
SET expires_at = created_at + INTERVAL '14 days'
WHERE expires_at IS NULL;