
-- Phase 1: Critical Database Security Fixes

-- First, drop the dangerous public read policy
DROP POLICY IF EXISTS "Anyone can read system config" ON public.system_config;

-- Create a security definer function to safely check user roles without RLS recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create role-based policies for system_config that only allow admin access
CREATE POLICY "Only admins can read system_config" 
ON public.system_config 
FOR SELECT 
TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Only admins can update system_config" 
ON public.system_config 
FOR UPDATE 
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- Ensure we have at least one admin user in the system
-- This will create an admin role for the first user if no admin exists
DO $$
BEGIN
  -- Check if there are any admin users
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
    -- Make the first user an admin (you may need to adjust this logic)
    UPDATE public.profiles 
    SET role = 'admin' 
    WHERE id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1);
  END IF;
END $$;
