import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS_PER_WINDOW = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes after exceeding rate limit
const FAILED_ATTEMPT_DELAY_MS = 2000; // 2 second delay on failed attempts

// In-memory rate limiting (per function instance)
const rateLimitStore = new Map<string, { attempts: number; firstAttempt: number; lockedUntil?: number }>();

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         req.headers.get('x-real-ip') || 
         'unknown';
}

function checkRateLimit(clientIp: string): { allowed: boolean; remainingAttempts: number; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(clientIp);

  // Clean up old entries
  if (record && record.firstAttempt < now - RATE_LIMIT_WINDOW_MS && !record.lockedUntil) {
    rateLimitStore.delete(clientIp);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS_PER_WINDOW };
  }

  // Check if locked out
  if (record?.lockedUntil && record.lockedUntil > now) {
    return { 
      allowed: false, 
      remainingAttempts: 0, 
      retryAfter: Math.ceil((record.lockedUntil - now) / 1000) 
    };
  }

  // Reset lockout if expired
  if (record?.lockedUntil && record.lockedUntil <= now) {
    rateLimitStore.delete(clientIp);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS_PER_WINDOW };
  }

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS_PER_WINDOW };
  }

  const remainingAttempts = MAX_ATTEMPTS_PER_WINDOW - record.attempts;
  return { allowed: remainingAttempts > 0, remainingAttempts: Math.max(0, remainingAttempts) };
}

function recordAttempt(clientIp: string, success: boolean): void {
  const now = Date.now();
  const record = rateLimitStore.get(clientIp);

  if (!record || record.firstAttempt < now - RATE_LIMIT_WINDOW_MS) {
    if (success) {
      rateLimitStore.delete(clientIp);
    } else {
      rateLimitStore.set(clientIp, { attempts: 1, firstAttempt: now });
    }
    return;
  }

  if (success) {
    rateLimitStore.delete(clientIp);
    return;
  }

  record.attempts++;
  
  // Lock out if exceeded max attempts
  if (record.attempts >= MAX_ATTEMPTS_PER_WINDOW) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    console.log(`Security Event: IP ${clientIp} locked out for ${LOCKOUT_DURATION_MS / 1000} seconds due to excessive failed attempts`);
  }
  
  rateLimitStore.set(clientIp, record);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { 
        status: 405, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  const clientIp = getClientIp(req);

  try {
    // Check rate limit before processing
    const rateLimitCheck = checkRateLimit(clientIp);
    if (!rateLimitCheck.allowed) {
      console.log(`Security Event: Rate limit exceeded for IP ${clientIp}`);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Too many attempts. Please try again later.",
          retryAfter: rateLimitCheck.retryAfter
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(rateLimitCheck.retryAfter || 300)
          } 
        }
      );
    }

    const { passcode } = await req.json();
    
    if (!passcode || typeof passcode !== 'string') {
      console.log('Security Event: Passcode verification attempt with invalid input');
      recordAttempt(clientIp, false);
      return new Response(
        JSON.stringify({ valid: false, error: "Passcode is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Create Supabase client with service role key for secure access
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Security Event: Missing Supabase configuration');
      return new Response(
        JSON.stringify({ valid: false, error: "Server configuration error" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Securely fetch the signup passcode from system_config
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'signup_passcode')
      .single();

    if (error) {
      console.error('Security Event: Error fetching signup passcode:', error.message);
      return new Response(
        JSON.stringify({ valid: false, error: "Server error" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    if (!data) {
      console.error('Security Event: No signup passcode found in system config');
      return new Response(
        JSON.stringify({ valid: false, error: "Passcode not configured" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const isValid = data.value === passcode;
    
    // Record the attempt for rate limiting
    recordAttempt(clientIp, isValid);
    
    if (!isValid) {
      console.log(`Security Event: Invalid passcode verification attempt from IP ${clientIp}`);
      
      // Log failed attempt to audit_logs
      await supabase.from('audit_logs').insert({
        action: 'passcode_verification_failed',
        details: {
          ip: clientIp,
          timestamp: new Date().toISOString(),
          user_agent: req.headers.get('user-agent') || 'unknown'
        }
      });
      
      // Add delay on failed attempts to slow down brute-force
      await new Promise(resolve => setTimeout(resolve, FAILED_ATTEMPT_DELAY_MS));
    } else {
      console.log('Security Event: Valid passcode verification');
    }

    return new Response(
      JSON.stringify({ valid: isValid }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error('Security Event: Error in passcode verification:', error);
    recordAttempt(clientIp, false);
    return new Response(
      JSON.stringify({ valid: false, error: "Server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});