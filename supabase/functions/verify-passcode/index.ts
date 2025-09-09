import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  try {
    const { passcode } = await req.json();
    
    if (!passcode || typeof passcode !== 'string') {
      console.log('Security Event: Passcode verification attempt with invalid input');
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
    
    if (!isValid) {
      console.log('Security Event: Invalid passcode verification attempt');
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
    return new Response(
      JSON.stringify({ valid: false, error: "Server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});