
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeepgramRequest {
  audio: string; // base64 encoded
  mimeType: string;
  options: {
    model?: string;
    language?: string;
    detect_language?: boolean;
    diarize?: boolean;
    punctuate?: boolean;
    utterances?: boolean;
    smart_format?: boolean;
    profanity_filter?: boolean;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DEEPGRAM_API_KEY = 'fad53278adc2597e39856ec7ac1bf4a4d9adbe16';
    
    if (!DEEPGRAM_API_KEY) {
      throw new Error('Deepgram API key not configured');
    }

    const { audio, mimeType, options }: DeepgramRequest = await req.json();
    
    console.log('🎙️ Processing Deepgram transcription request', {
      mimeType,
      options,
      audioLength: audio.length
    });

    // Convert base64 to binary
    const audioBuffer = Uint8Array.from(atob(audio), c => c.charCodeAt(0));

    // Prepare Deepgram request parameters
    const params = new URLSearchParams();
    
    // Language handling and model selection
    let finalModel = 'nova-2'; // Default model
    
    if (options.language) {
      params.append('language', options.language);
      
      // For non-English languages, use enhanced model
      if (options.language !== 'en') {
        finalModel = 'general';
        params.append('model', 'general');
        params.append('tier', 'enhanced');
        console.log('✅ Using enhanced model for non-English language:', options.language);
      } else {
        // For English, use Nova-2
        params.append('model', 'nova-2');
        console.log('✅ Using Nova-2 model for English language');
      }
    } else {
      // Default to Nova-2 if no language specified
      params.append('model', 'nova-2');
    }

    // Core parameters
    params.append('punctuate', 'true');
    params.append('smart_format', 'false'); // Always false as requested
    params.append('filler_words', 'true');

    // Speaker diarization - CRITICAL: Ensure both parameters are set
    if (options.diarize) {
      params.append('diarize', 'true');
      params.append('utterances', 'true');
      console.log('✅ Diarization enabled: diarize=true, utterances=true');
    }

    // Additional options
    if (options.profanity_filter) {
      params.append('profanity_filter', 'true');
    }

    const deepgramUrl = `https://api.deepgram.com/v1/listen?${params.toString()}`;
    
    console.log('📡 Calling Deepgram API with model:', finalModel);
    console.log('📋 Full URL:', deepgramUrl);
    console.log('📋 Parameters:', Object.fromEntries(params.entries()));

    const deepgramResponse = await fetch(deepgramUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        // Remove Content-Type header to let Deepgram auto-detect format
      },
      body: audioBuffer
    });

    if (!deepgramResponse.ok) {
      const errorText = await deepgramResponse.text();
      console.error('❌ Deepgram API error:', {
        status: deepgramResponse.status,
        statusText: deepgramResponse.statusText,
        error: errorText,
        model: finalModel,
        url: deepgramUrl
      });
      
      throw new Error(`Deepgram API error: ${deepgramResponse.status} ${deepgramResponse.statusText}`);
    }

    const deepgramResult = await deepgramResponse.json();
    console.log('✅ Deepgram response received', {
      hasResults: !!deepgramResult.results,
      hasUtterances: !!deepgramResult.results?.utterances,
      utteranceCount: deepgramResult.results?.utterances?.length || 0,
      model: finalModel,
      detectedLanguage: deepgramResult.metadata?.model_info?.language
    });

    // Process the result
    const transcript = deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    
    // Process speaker utterances if available
    let speakerUtterances: any[] = [];
    if (deepgramResult.results?.utterances) {
      console.log('📊 Processing utterances, count:', deepgramResult.results.utterances.length);
      
      speakerUtterances = deepgramResult.results.utterances.map((utterance: any, index: number) => {
        // Use actual speaker numbers from Deepgram
        const speakerNumber = utterance.speaker !== undefined ? utterance.speaker : 0;
        const speakerLabel = `Speaker ${speakerNumber}`;
        
        console.log(`🎤 Utterance ${index}: speaker=${speakerNumber}, confidence=${utterance.confidence}, text="${utterance.transcript.substring(0, 50)}..."`);
        
        return {
          speaker: speakerLabel,
          text: utterance.transcript,
          confidence: utterance.confidence,
          start: utterance.start,
          end: utterance.end
        };
      });

      // Log speaker distribution for debugging
      const speakerDistribution = speakerUtterances.reduce((acc: any, utterance: any) => {
        acc[utterance.speaker] = (acc[utterance.speaker] || 0) + 1;
        return acc;
      }, {});
      console.log('📈 Speaker distribution:', speakerDistribution);
    }

    // Detect language if available
    let detectedLanguage = null;
    if (deepgramResult.metadata?.model_info?.language) {
      detectedLanguage = {
        language: deepgramResult.metadata.model_info.language,
        confidence: deepgramResult.metadata.model_info.language_confidence || 0.95
      };
    }

    const result = {
      text: transcript,
      speakerUtterances,
      detectedLanguage,
      metadata: {
        duration: deepgramResult.metadata?.duration || 0,
        channels: deepgramResult.metadata?.channels || 1,
        model: finalModel
      }
    };

    console.log('✅ Processed transcription result', {
      textLength: result.text.length,
      utteranceCount: result.speakerUtterances.length,
      hasLanguageDetection: !!result.detectedLanguage,
      model: finalModel
    });

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Deepgram transcription error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
