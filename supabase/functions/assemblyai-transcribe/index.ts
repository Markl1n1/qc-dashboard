
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log(`[AssemblyAI Edge Function] ${req.method} request received`);
  console.log(`[AssemblyAI Edge Function] Request URL: ${req.url}`);
  console.log(`[AssemblyAI Edge Function] Request headers:`, Object.fromEntries(req.headers.entries()));

  if (req.method === 'OPTIONS') {
    console.log('[AssemblyAI Edge Function] Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    console.log(`[AssemblyAI Edge Function] Supabase URL: ${supabaseUrl}`);
    console.log(`[AssemblyAI Edge Function] Supabase Anon Key: ${supabaseAnonKey ? 'Present' : 'Missing'}`);
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    // Get user from token
    console.log('[AssemblyAI Edge Function] Verifying user authentication...');
    const authHeader = req.headers.get('Authorization');
    console.log(`[AssemblyAI Edge Function] Auth header: ${authHeader ? 'Present' : 'Missing'}`);
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError) {
      console.error('[AssemblyAI Edge Function] Auth error:', authError);
      return new Response(JSON.stringify({ error: `Authentication failed: ${authError.message}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!user) {
      console.error('[AssemblyAI Edge Function] No user found');
      return new Response(JSON.stringify({ error: 'User not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[AssemblyAI Edge Function] Authenticated user: ${user.email}`);

    // Check for AssemblyAI API key
    const assemblyAiApiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
    console.log(`[AssemblyAI Edge Function] AssemblyAI API Key: ${assemblyAiApiKey ? 'Present' : 'Missing'}`);
    
    if (!assemblyAiApiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    // Parse request body
    let requestData;
    try {
      requestData = await req.json();
      console.log('[AssemblyAI Edge Function] Request data parsed:', {
        action: requestData.action,
        hasAudioData: !!requestData.audioData,
        audioDataLength: requestData.audioData ? requestData.audioData.length : 0,
        fileName: requestData.fileName,
        transcriptId: requestData.transcriptId,
        otherKeys: Object.keys(requestData).filter(k => !['action', 'audioData', 'fileName', 'transcriptId'].includes(k))
      });
    } catch (parseError) {
      console.error('[AssemblyAI Edge Function] Failed to parse request body:', parseError);
      throw new Error(`Invalid request body: ${parseError.message}`);
    }

    const { action, ...otherData } = requestData;

    if (action === 'upload') {
      console.log('[AssemblyAI Edge Function] Processing upload action...');
      const { audioData, fileName } = otherData;
      
      if (!audioData) {
        throw new Error('No audio data provided for upload');
      }
      
      console.log(`[AssemblyAI Edge Function] Converting base64 to blob for file: ${fileName}`);
      
      // Convert base64 to blob for upload with chunked processing
      let audioBlob;
      try {
        // Process base64 in chunks to prevent memory issues
        const chunkSize = 32768; // 32KB chunks
        const chunks: Uint8Array[] = [];
        
        for (let i = 0; i < audioData.length; i += chunkSize) {
          const chunk = audioData.slice(i, i + chunkSize);
          const binaryChunk = atob(chunk);
          const bytes = new Uint8Array(binaryChunk.length);
          
          for (let j = 0; j < binaryChunk.length; j++) {
            bytes[j] = binaryChunk.charCodeAt(j);
          }
          
          chunks.push(bytes);
        }
        
        // Combine all chunks
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        
        audioBlob = result;
        console.log(`[AssemblyAI Edge Function] Successfully converted base64 to blob, size: ${audioBlob.length} bytes`);
      } catch (conversionError) {
        console.error('[AssemblyAI Edge Function] Base64 conversion error:', conversionError);
        throw new Error(`Failed to process audio data: ${conversionError.message}`);
      }
      
      const formData = new FormData();
      formData.append('file', new Blob([audioBlob]), fileName);

      console.log('[AssemblyAI Edge Function] Uploading to AssemblyAI...');
      const response = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'Authorization': assemblyAiApiKey,
        },
        body: formData,
      });

      console.log(`[AssemblyAI Edge Function] Upload response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AssemblyAI Edge Function] Upload failed:', errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[AssemblyAI Edge Function] Upload successful:', data);
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'transcribe') {
      console.log('[AssemblyAI Edge Function] Processing transcribe action...');
      console.log('[AssemblyAI Edge Function] Transcription options:', otherData);
      
      const response = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'Authorization': assemblyAiApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(otherData),
      });

      console.log(`[AssemblyAI Edge Function] Transcribe response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AssemblyAI Edge Function] Transcription request failed:', errorText);
        throw new Error(`Transcription request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[AssemblyAI Edge Function] Transcription started:', { id: data.id, status: data.status });
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'poll') {
      console.log('[AssemblyAI Edge Function] Processing poll action...');
      const { transcriptId } = otherData;
      
      if (!transcriptId) {
        throw new Error('No transcript ID provided for polling');
      }
      
      console.log(`[AssemblyAI Edge Function] Polling transcript: ${transcriptId}`);
      
      const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': assemblyAiApiKey,
        },
      });

      console.log(`[AssemblyAI Edge Function] Poll response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AssemblyAI Edge Function] Poll request failed:', errorText);
        throw new Error(`Failed to get transcription status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[AssemblyAI Edge Function] Poll result - Status: ${data.status}, Text length: ${data.text?.length || 0}`);
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.error('[AssemblyAI Edge Function] Invalid action:', action);
    throw new Error(`Invalid action: ${action}`);

  } catch (error) {
    console.error('[AssemblyAI Edge Function] Error details:', error);
    console.error('[AssemblyAI Edge Function] Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
