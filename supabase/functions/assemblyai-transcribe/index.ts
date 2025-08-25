
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Regional endpoints
const REGIONAL_ENDPOINTS = {
  us: 'https://api.assemblyai.com/v2/',
  eu: 'https://api.eu.assemblyai.com/v2/'
};

serve(async (req) => {
  console.log('🔥 [Enhanced Edge Function] REQUEST RECEIVED');
  console.log('🔥 [Enhanced Edge Function] Method:', req.method);
  console.log('🔥 [Enhanced Edge Function] URL:', req.url);

  if (req.method === 'OPTIONS') {
    console.log('🔥 [Enhanced Edge Function] CORS preflight handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    console.log('🔥 [Enhanced Edge Function] Environment check:');
    console.log('🔥 [Enhanced Edge Function] Supabase URL:', supabaseUrl ? 'PRESENT' : 'MISSING');
    console.log('🔥 [Enhanced Edge Function] Supabase Anon Key:', supabaseAnonKey ? 'PRESENT' : 'MISSING');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    // Authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ [Enhanced Edge Function] Auth failed:', authError);
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ [Enhanced Edge Function] User authenticated:', user.email);

    // Get AssemblyAI API key
    const assemblyAiApiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
    
    if (!assemblyAiApiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    // Parse request
    const requestData = await req.json();
    const { action, region = 'us', ...otherData } = requestData;
    
    console.log('🔥 [Enhanced Edge Function] Processing action:', action);
    console.log('🔥 [Enhanced Edge Function] Region:', region);

    // Get regional endpoint
    const baseEndpoint = REGIONAL_ENDPOINTS[region as keyof typeof REGIONAL_ENDPOINTS] || REGIONAL_ENDPOINTS.us;
    console.log('🔥 [Enhanced Edge Function] Using endpoint:', baseEndpoint);

    if (action === 'upload') {
      console.log('🔥 [Enhanced Edge Function] ENHANCED UPLOAD ACTION');
      const { audioData, fileName } = otherData;
      
      if (!audioData) {
        throw new Error('No audio data provided');
      }
      
      console.log('🔥 [Enhanced Edge Function] Processing file:', fileName);
      console.log('🔥 [Enhanced Edge Function] Audio data length:', audioData.length);
      
      // Enhanced chunked processing for large files
      let audioBlob: Uint8Array;
      
      try {
        console.log('🔥 [Enhanced Edge Function] Starting enhanced base64 conversion...');
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
          
          // Progress logging for large files
          if (i % (chunkSize * 10) === 0) {
            console.log('🔥 [Enhanced Edge Function] Conversion progress:', Math.round((i / audioData.length) * 100), '%');
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
        console.log('✅ [Enhanced Edge Function] Enhanced conversion completed, size:', audioBlob.length, 'bytes');
      } catch (conversionError) {
        console.error('❌ [Enhanced Edge Function] Conversion error:', conversionError);
        throw new Error(`Enhanced conversion failed: ${conversionError.message}`);
      }
      
      const formData = new FormData();
      formData.append('file', new Blob([audioBlob]), fileName);

      console.log('🔥 [Enhanced Edge Function] Uploading to regional endpoint...');
      const response = await fetch(`${baseEndpoint}upload`, {
        method: 'POST',
        headers: {
          'Authorization': assemblyAiApiKey,
        },
        body: formData,
      });

      console.log('🔥 [Enhanced Edge Function] Regional upload response:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Enhanced Edge Function] Regional upload failed:', errorText);
        
        // Check for quota/billing errors
        if (errorText.includes('quota') || errorText.includes('billing') || errorText.includes('limit')) {
          throw new Error(`API quota exceeded: ${errorText}`);
        }
        
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [Enhanced Edge Function] Regional upload successful');
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'transcribe') {
      console.log('🔥 [Enhanced Edge Function] ENHANCED TRANSCRIBE ACTION');
      console.log('🔥 [Enhanced Edge Function] Enhanced options:', otherData);
      
      // Log enabled features
      const enabledFeatures = [];
      if (otherData.speaker_labels) enabledFeatures.push('speaker_diarization');
      if (otherData.language_detection) enabledFeatures.push('language_detection');
      if (otherData.content_safety_labels) enabledFeatures.push('content_safety');
      if (otherData.pii_policy) enabledFeatures.push('pii_detection');
      if (otherData.entity_detection) enabledFeatures.push('entity_detection');
      if (otherData.sentiment_analysis) enabledFeatures.push('sentiment_analysis');
      if (otherData.auto_chapters) enabledFeatures.push('auto_chapters');
      if (otherData.summarization) enabledFeatures.push('summarization');
      
      console.log('🔥 [Enhanced Edge Function] Enabled features:', enabledFeatures);
      
      const response = await fetch(`${baseEndpoint}transcript`, {
        method: 'POST',
        headers: {
          'Authorization': assemblyAiApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(otherData),
      });

      console.log('🔥 [Enhanced Edge Function] Enhanced transcription response:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Enhanced Edge Function] Enhanced transcription failed:', errorText);
        
        // Check for quota/billing errors
        if (errorText.includes('quota') || errorText.includes('billing') || errorText.includes('limit')) {
          throw new Error(`API quota exceeded: ${errorText}`);
        }
        
        throw new Error(`Enhanced transcription failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [Enhanced Edge Function] Enhanced transcription started:', { id: data.id, status: data.status });
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'poll') {
      console.log('🔥 [Enhanced Edge Function] ENHANCED POLL ACTION');
      const { transcriptId } = otherData;
      
      if (!transcriptId) {
        throw new Error('No transcript ID provided');
      }
      
      console.log('🔥 [Enhanced Edge Function] Polling transcript:', transcriptId);
      
      const response = await fetch(`${baseEndpoint}transcript/${transcriptId}`, {
        headers: {
          'Authorization': assemblyAiApiKey,
        },
      });

      console.log('🔥 [Enhanced Edge Function] Enhanced poll response:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Enhanced Edge Function] Enhanced poll failed:', errorText);
        throw new Error(`Poll failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🔥 [Enhanced Edge Function] Poll result - Status:', data.status);
      
      if (data.status === 'completed') {
        // Log available enhanced features in response
        const features = [];
        if (data.language_code) features.push(`language: ${data.language_code}`);
        if (data.content_safety_labels) features.push('content_safety');
        if (data.entities && data.entities.length > 0) features.push(`entities: ${data.entities.length}`);
        if (data.sentiment_analysis_results) features.push('sentiment');
        if (data.chapters && data.chapters.length > 0) features.push(`chapters: ${data.chapters.length}`);
        if (data.summary) features.push('summary');
        
        console.log('🔥 [Enhanced Edge Function] Enhanced features in response:', features);
      }
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.error('❌ [Enhanced Edge Function] Invalid action:', action);
    throw new Error(`Invalid action: ${action}`);

  } catch (error) {
    console.error('❌ [Enhanced Edge Function] CRITICAL ERROR:', error);
    console.error('❌ [Enhanced Edge Function] Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
