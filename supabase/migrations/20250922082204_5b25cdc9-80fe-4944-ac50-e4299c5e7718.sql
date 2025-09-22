-- Create audit_logs table for tracking admin actions
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view audit logs
CREATE POLICY "Only admins can read audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (get_current_user_role() = 'admin');

-- Create policy for system to insert audit logs
CREATE POLICY "System can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (true);

-- Add indexes for better performance
CREATE INDEX idx_dialogs_created_at ON public.dialogs(created_at);
CREATE INDEX idx_dialogs_user_id_created_at ON public.dialogs(user_id, created_at);
CREATE INDEX idx_dialogs_status ON public.dialogs(status);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_audit_logs_action_created_at ON public.audit_logs(action, created_at);
CREATE INDEX idx_system_config_key ON public.system_config(key);

-- Add trigger to automatically update expires_at for new dialogs
CREATE OR REPLACE FUNCTION public.set_dialog_expiration()
RETURNS TRIGGER AS $$
DECLARE
  retention_days INTEGER;
BEGIN
  SELECT value::INTEGER INTO retention_days 
  FROM public.system_config 
  WHERE key = 'data_retention_days';
  
  IF retention_days IS NULL THEN
    retention_days := 30; -- Default fallback
  END IF;
  
  NEW.expires_at := NEW.created_at + (retention_days || ' days')::INTERVAL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER dialog_expiration_trigger
  BEFORE INSERT ON public.dialogs
  FOR EACH ROW EXECUTE FUNCTION public.set_dialog_expiration();

-- Update existing dialogs to have proper expiration dates
UPDATE public.dialogs 
SET expires_at = created_at + INTERVAL '14 days'
WHERE expires_at IS NULL;