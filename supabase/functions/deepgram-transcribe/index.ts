import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { load } from "https://deno.land/std@0.182.0/dotenv/mod.ts";

const env = await load();

const supabaseUrl = env["SUPABASE_URL"];
const supabaseKey = env["SUPABASE_ANON_KEY"];

const deepgramApiKey = env["DEEPGRAM_API_KEY"];

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audioUrl, language = 'en', punctuate = true, smart_format = false, diarize = true, filler_words = true, model, tier } = await req.json();

    if (!audioUrl) {
      return new Response(JSON.stringify({ error: 'audioUrl is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      }
    });

    if (!deepgramApiKey) {
      console.error("Deepgram API key not found in environment variables.");
      return new Response(JSON.stringify({ error: 'Deepgram API key not found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build Deepgram request parameters
    const deepgramParams: any = {
      model: 'nova-2',
      punctuate,
      smart_format,
      diarize,
      filler_words,
      language
    };

    // Add enhanced parameters for non-English languages
    if (language !== 'en') {
      deepgramParams.model = model || 'general';
      deepgramParams.tier = tier || 'enhanced';
    }

    // Fetch the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error(`Failed to fetch audio: ${audioResponse.status} ${audioResponse.statusText}`);
      return new Response(JSON.stringify({ error: 'Failed to fetch audio' }), {
        status: audioResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const audioBuffer = await audioResponse.arrayBuffer();

    const deepgramResponse = await fetch(
      `https://api.deepgram.com/v1/listen?${new URLSearchParams(deepgramParams)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramApiKey}`,
          'Content-Type': 'audio/wav'
        },
        body: audioBuffer
      }
    );

    const deepgramResult = await deepgramResponse.json();

    if (!deepgramResponse.ok) {
      console.error('Deepgram API error:', deepgramResult);
      return new Response(JSON.stringify({ error: 'Deepgram API error', details: deepgramResult }), {
        status: deepgramResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ data: deepgramResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
