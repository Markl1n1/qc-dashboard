
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🔥 [AssemblyAI] REQUEST RECEIVED');
  console.log('🔥 [AssemblyAI] Method:', req.method);
  console.log('🔥 [AssemblyAI] Headers:', Object.fromEntries(req.headers.entries()));

  if (req.method === 'OPTIONS') {
    console.log('🔥 [AssemblyAI] CORS preflight handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const assemblyAiApiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
    
    console.log('🔥 [AssemblyAI] Environment check:');
    console.log('🔥 [AssemblyAI] Supabase URL:', supabaseUrl ? 'PRESENT' : 'MISSING');
    console.log('🔥 [AssemblyAI] Supabase Anon Key:', supabaseAnonKey ? 'PRESENT' : 'MISSING');
    console.log('🔥 [AssemblyAI] AssemblyAI API Key:', assemblyAiApiKey ? 'PRESENT' : 'MISSING');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!assemblyAiApiKey) {
      throw new Error('AssemblyAI API key not configured in Supabase secrets');
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('🔥 [AssemblyAI] Auth header:', authHeader ? 'PRESENT' : 'MISSING');
    
    if (!authHeader) {
      console.error('❌ [AssemblyAI] No Authorization header provided');
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client with auth
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ [AssemblyAI] Auth verification failed:', authError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ [AssemblyAI] User authenticated:', user.email);

    // Parse request
    const requestData = await req.json();
    const { action, ...otherData } = requestData;
    
    console.log('🔥 [AssemblyAI] Processing action:', action);

    if (action === 'upload') {
      console.log('🔥 [AssemblyAI] UPLOAD ACTION');
      const { audioData, fileName } = otherData;
      
      if (!audioData) {
        throw new Error('No audio data provided');
      }
      
      console.log('🔥 [AssemblyAI] Processing file:', fileName);
      console.log('🔥 [AssemblyAI] Audio data length:', audioData.length);
      
      // Convert base64 to binary
      const audioBlob = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
      console.log('🔥 [AssemblyAI] Converted to binary, size:', audioBlob.length, 'bytes');
      
      const formData = new FormData();
      formData.append('file', new Blob([audioBlob]), fileName);

      console.log('🔥 [AssemblyAI] Uploading to AssemblyAI...');
      const response = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'Authorization': assemblyAiApiKey,
        },
        body: formData,
      });

      console.log('🔥 [AssemblyAI] Upload response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [AssemblyAI] Upload failed:', errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [AssemblyAI] Upload successful:', data.upload_url);
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'transcribe') {
      console.log('🔥 [AssemblyAI] TRANSCRIBE ACTION');
      console.log('🔥 [AssemblyAI] Options:', otherData);
      
      const response = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'Authorization': assemblyAiApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(otherData),
      });

      console.log('🔥 [AssemblyAI] Transcription response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [AssemblyAI] Transcription failed:', errorText);
        throw new Error(`Transcription failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [AssemblyAI] Transcription started:', { id: data.id, status: data.status });
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'poll') {
      console.log('🔥 [AssemblyAI] POLL ACTION');
      const { transcriptId } = otherData;
      
      if (!transcriptId) {
        throw new Error('No transcript ID provided');
      }
      
      console.log('🔥 [AssemblyAI] Polling transcript:', transcriptId);
      
      const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': assemblyAiApiKey,
        },
      });

      console.log('🔥 [AssemblyAI] Poll response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [AssemblyAI] Poll failed:', errorText);
        throw new Error(`Poll failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🔥 [AssemblyAI] Poll result - Status:', data.status);
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.error('❌ [AssemblyAI] Invalid action:', action);
    throw new Error(`Invalid action: ${action}`);

  } catch (error) {
    console.error('❌ [AssemblyAI] CRITICAL ERROR:', error);
    console.error('❌ [AssemblyAI] Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
