
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
      audioLength: audio.length,
      model: options.model || 'nova-2'
    });

    // Convert base64 to binary
    const audioBuffer = Uint8Array.from(atob(audio), c => c.charCodeAt(0));

    // Prepare Deepgram request parameters
    const params = new URLSearchParams();
    
    // Core parameters - support both Nova-2 and Nova-3
    const model = options.model || 'nova-2';
    params.append('model', model);
    params.append('punctuate', 'true');
    params.append('smart_format', options.smart_format !== false ? 'true' : 'false');
    
    // Language detection
    if (options.detect_language) {
      params.append('detect_language', 'true');
    } else if (options.language) {
      params.append('language', options.language);
    }

    // Speaker diarization
    if (options.diarize) {
      params.append('diarize', 'true');
      params.append('utterances', 'true');
    }

    // Additional options
    if (options.profanity_filter) {
      params.append('profanity_filter', 'true');
    }

    const deepgramUrl = `https://api.deepgram.com/v1/listen?${params.toString()}`;
    
    console.log('📡 Calling Deepgram API with model:', model, 'URL:', deepgramUrl);

    const deepgramResponse = await fetch(deepgramUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': mimeType || 'audio/wav'
      },
      body: audioBuffer
    });

    if (!deepgramResponse.ok) {
      const errorText = await deepgramResponse.text();
      console.error('❌ Deepgram API error:', {
        status: deepgramResponse.status,
        statusText: deepgramResponse.statusText,
        error: errorText,
        model: model
      });
      
      // Check for specific Nova-3 errors
      if (deepgramResponse.status === 400 && errorText.includes('model')) {
        throw new Error(`Model ${model} is not available. Please check your Deepgram plan supports this model.`);
      }
      
      throw new Error(`Deepgram API error: ${deepgramResponse.status} ${deepgramResponse.statusText}`);
    }

    const deepgramResult = await deepgramResponse.json();
    console.log('✅ Deepgram response received', {
      hasResults: !!deepgramResult.results,
      hasUtterances: !!deepgramResult.results?.utterances,
      model: model,
      detectedLanguage: deepgramResult.metadata?.model_info?.language
    });

    // Process the result
    const transcript = deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    
    // Process speaker utterances if available
    let speakerUtterances: any[] = [];
    if (deepgramResult.results?.utterances) {
      speakerUtterances = deepgramResult.results.utterances.map((utterance: any, index: number) => {
        // Enhanced speaker detection for Agent/Customer
        const speakerLabel = detectSpeakerRole(utterance.transcript, utterance.speaker, index);
        
        return {
          speaker: speakerLabel,
          text: utterance.transcript,
          confidence: utterance.confidence,
          start: utterance.start,
          end: utterance.end
        };
      });
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
        model: model
      }
    };

    console.log('✅ Processed transcription result', {
      textLength: result.text.length,
      utteranceCount: result.speakerUtterances.length,
      hasLanguageDetection: !!result.detectedLanguage,
      model: model
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

// Enhanced speaker role detection function
function detectSpeakerRole(text: string, speakerNumber: string, utteranceIndex: number): string {
  const lowerText = text.toLowerCase();
  
  // Keywords that suggest agent role
  const agentKeywords = [
    'thank you for calling',
    'how can i help',
    'my name is',
    'i can assist',
    'let me check',
    'i understand',
    'is there anything else',
    'have a great day',
    'i apologize',
    'let me transfer',
    'i can help you with',
    'thank you for holding'
  ];

  // Keywords that suggest customer role
  const customerKeywords = [
    'i have a problem',
    'i need help',
    'my account',
    'i want to',
    'can you help me',
    'i\'m calling about',
    'i received',
    'my order',
    'i can\'t',
    'what happened to'
  ];

  // Check for agent patterns
  const isAgent = agentKeywords.some(keyword => lowerText.includes(keyword));
  if (isAgent) {
    return 'Agent';
  }

  // Check for customer patterns
  const isCustomer = customerKeywords.some(keyword => lowerText.includes(keyword));
  if (isCustomer) {
    return 'Customer';
  }

  // Fallback logic: first speaker is usually agent in customer service
  if (utteranceIndex < 3) {
    return speakerNumber === '0' ? 'Agent' : 'Customer';
  }

  // Default labeling based on speaker number
  return speakerNumber === '0' ? 'Agent' : 'Customer';
}
