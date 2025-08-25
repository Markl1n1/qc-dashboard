
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Force console logging to be visible in edge function
  console.warn('🔥 [Edge Function] REQUEST RECEIVED - Console logging active');
  console.warn('🔥 [Edge Function] Method:', req.method);
  console.warn('🔥 [Edge Function] URL:', req.url);
  console.warn('🔥 [Edge Function] Headers:', Object.fromEntries(req.headers.entries()));

  if (req.method === 'OPTIONS') {
    console.warn('🔥 [Edge Function] CORS preflight request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with detailed logging
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    console.warn('🔥 [Edge Function] Environment check:');
    console.warn('🔥 [Edge Function] Supabase URL:', supabaseUrl ? 'PRESENT' : 'MISSING');
    console.warn('🔥 [Edge Function] Supabase Anon Key:', supabaseAnonKey ? 'PRESENT' : 'MISSING');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ [Edge Function] Missing Supabase configuration');
      throw new Error('Missing Supabase configuration');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });
    console.warn('✅ [Edge Function] Supabase client created');

    // Authentication with detailed logging
    const authHeader = req.headers.get('Authorization');
    console.warn('🔥 [Edge Function] Auth header check:', authHeader ? 'PRESENT' : 'MISSING');
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError) {
      console.error('❌ [Edge Function] Auth error:', authError);
      return new Response(JSON.stringify({ error: `Authentication failed: ${authError.message}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!user) {
      console.error('❌ [Edge Function] No user authenticated');
      return new Response(JSON.stringify({ error: 'User not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.warn('✅ [Edge Function] User authenticated:', user.email);

    // Check AssemblyAI API key
    const assemblyAiApiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
    console.warn('🔥 [Edge Function] AssemblyAI API Key check:', assemblyAiApiKey ? 'PRESENT' : 'MISSING');
    
    if (!assemblyAiApiKey) {
      console.error('❌ [Edge Function] AssemblyAI API key not configured');
      throw new Error('AssemblyAI API key not configured');
    }

    // Parse request body with detailed logging
    console.warn('🔥 [Edge Function] Parsing request body...');
    let requestData;
    try {
      requestData = await req.json();
      console.warn('🔥 [Edge Function] Request data parsed:', {
        action: requestData.action,
        hasAudioData: !!requestData.audioData,
        audioDataLength: requestData.audioData ? requestData.audioData.length : 0,
        fileName: requestData.fileName,
        transcriptId: requestData.transcriptId,
        otherKeys: Object.keys(requestData).filter(k => !['action', 'audioData', 'fileName', 'transcriptId'].includes(k))
      });
    } catch (parseError) {
      console.error('❌ [Edge Function] Failed to parse request body:', parseError);
      throw new Error(`Invalid request body: ${parseError.message}`);
    }

    const { action, ...otherData } = requestData;
    console.warn('🔥 [Edge Function] Processing action:', action);

    if (action === 'upload') {
      console.warn('🔥 [Edge Function] UPLOAD ACTION STARTED');
      const { audioData, fileName } = otherData;
      
      if (!audioData) {
        console.error('❌ [Edge Function] No audio data provided');
        throw new Error('No audio data provided for upload');
      }
      
      console.warn('🔥 [Edge Function] Converting base64 to blob for file:', fileName);
      console.warn('🔥 [Edge Function] Audio data length:', audioData.length);
      
      // Convert base64 to blob with detailed logging
      let audioBlob;
      try {
        console.warn('🔥 [Edge Function] Starting chunked base64 conversion...');
        const chunkSize = 32768;
        const chunks: Uint8Array[] = [];
        
        for (let i = 0; i < audioData.length; i += chunkSize) {
          const chunk = audioData.slice(i, i + chunkSize);
          const binaryChunk = atob(chunk);
          const bytes = new Uint8Array(binaryChunk.length);
          
          for (let j = 0; j < binaryChunk.length; j++) {
            bytes[j] = binaryChunk.charCodeAt(j);
          }
          
          chunks.push(bytes);
          
          if (i % (chunkSize * 10) === 0) {
            console.warn('🔥 [Edge Function] Processed', Math.round((i / audioData.length) * 100), '% of base64 conversion');
          }
        }
        
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        
        audioBlob = result;
        console.warn('✅ [Edge Function] Base64 conversion completed, final size:', audioBlob.length, 'bytes');
      } catch (conversionError) {
        console.error('❌ [Edge Function] Base64 conversion error:', conversionError);
        throw new Error(`Failed to process audio data: ${conversionError.message}`);
      }
      
      const formData = new FormData();
      formData.append('file', new Blob([audioBlob]), fileName);

      console.warn('🔥 [Edge Function] Uploading to AssemblyAI API...');
      const response = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'Authorization': assemblyAiApiKey,
        },
        body: formData,
      });

      console.warn('🔥 [Edge Function] AssemblyAI upload response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Edge Function] AssemblyAI upload failed:', errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.warn('✅ [Edge Function] Upload successful:', data);
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'transcribe') {
      console.warn('🔥 [Edge Function] TRANSCRIBE ACTION STARTED');
      console.warn('🔥 [Edge Function] Transcription options:', otherData);
      
      const response = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'Authorization': assemblyAiApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(otherData),
      });

      console.warn('🔥 [Edge Function] AssemblyAI transcribe response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Edge Function] AssemblyAI transcription request failed:', errorText);
        throw new Error(`Transcription request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.warn('✅ [Edge Function] Transcription started:', { id: data.id, status: data.status });
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'poll') {
      console.warn('🔥 [Edge Function] POLL ACTION STARTED');
      const { transcriptId } = otherData;
      
      if (!transcriptId) {
        console.error('❌ [Edge Function] No transcript ID provided');
        throw new Error('No transcript ID provided for polling');
      }
      
      console.warn('🔥 [Edge Function] Polling transcript:', transcriptId);
      
      const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': assemblyAiApiKey,
        },
      });

      console.warn('🔥 [Edge Function] AssemblyAI poll response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Edge Function] AssemblyAI poll request failed:', errorText);
        throw new Error(`Failed to get transcription status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.warn('🔥 [Edge Function] Poll result - Status:', data.status, 'Text length:', data.text?.length || 0);
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.error('❌ [Edge Function] Invalid action provided:', action);
    throw new Error(`Invalid action: ${action}`);

  } catch (error) {
    console.error('❌ [Edge Function] CRITICAL ERROR:', error);
    console.error('❌ [Edge Function] Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
