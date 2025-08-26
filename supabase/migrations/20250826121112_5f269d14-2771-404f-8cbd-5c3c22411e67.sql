
-- Phase 1: Critical Security Fixes - Fix database function search paths
-- This prevents potential SQL injection and ensures functions only access the public schema

-- Fix get_next_deepgram_key function
CREATE OR REPLACE FUNCTION public.get_next_deepgram_key()
 RETURNS TABLE(id uuid, api_key text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT dk.id, dk.api_key
  FROM public.deepgram_api_keys dk
  WHERE dk.is_active = true
  ORDER BY 
    COALESCE(dk.last_used_at, '1970-01-01'::timestamp with time zone) ASC,
    dk.success_count DESC,
    dk.failure_count ASC
  LIMIT 1;
END;
$function$;

-- Fix update_deepgram_key_status function
CREATE OR REPLACE FUNCTION public.update_deepgram_key_status(key_id uuid, is_success boolean, error_msg text DEFAULT NULL::text, response_time integer DEFAULT NULL::integer, file_size bigint DEFAULT NULL::bigint, duration numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_consecutive_failures INTEGER;
BEGIN
  -- Update the API key statistics
  IF is_success THEN
    UPDATE public.deepgram_api_keys 
    SET 
      success_count = success_count + 1,
      consecutive_failures = 0,
      last_used_at = now(),
      updated_at = now()
    WHERE id = key_id;
  ELSE
    UPDATE public.deepgram_api_keys 
    SET 
      failure_count = failure_count + 1,
      consecutive_failures = consecutive_failures + 1,
      last_failure_at = now(),
      updated_at = now()
    WHERE id = key_id
    RETURNING consecutive_failures INTO current_consecutive_failures;
    
    -- Deactivate key if it has 5 consecutive failures
    IF current_consecutive_failures >= 5 THEN
      UPDATE public.deepgram_api_keys 
      SET 
        is_active = false,
        deactivated_at = now(),
        updated_at = now()
      WHERE id = key_id;
    END IF;
  END IF;
  
  -- Log the usage
  INSERT INTO public.deepgram_usage_log (
    api_key_id, 
    success, 
    error_message, 
    response_time_ms, 
    file_size_bytes, 
    audio_duration_seconds
  ) VALUES (
    key_id, 
    is_success, 
    error_msg, 
    response_time, 
    file_size, 
    duration
  );
END;
$function$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$function$;

-- Fix get_current_user_role function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (
    SELECT role 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$function$;

-- Fix calculate_dialog_expiration function
CREATE OR REPLACE FUNCTION public.calculate_dialog_expiration()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Fix cleanup_expired_dialogs function
CREATE OR REPLACE FUNCTION public.cleanup_expired_dialogs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  auto_delete_enabled BOOLEAN;
  deleted_count INTEGER;
BEGIN
  SELECT value::BOOLEAN INTO auto_delete_enabled 
  FROM public.system_config 
  WHERE key = 'auto_delete_enabled';
  
  IF auto_delete_enabled IS NULL OR auto_delete_enabled = false THEN
    RETURN 0;
  END IF;
  
  DELETE FROM public.dialogs 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

-- Fix update_dialog_expiration_dates function
CREATE OR REPLACE FUNCTION public.update_dialog_expiration_dates()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  retention_days INTEGER;
  updated_count INTEGER;
BEGIN
  SELECT value::INTEGER INTO retention_days 
  FROM public.system_config 
  WHERE key = 'data_retention_days';
  
  IF retention_days IS NULL THEN
    retention_days := 30;
  END IF;
  
  UPDATE public.dialogs 
  SET expires_at = created_at + (retention_days || ' days')::INTERVAL
  WHERE expires_at IS NULL OR expires_at != created_at + (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$function$;
