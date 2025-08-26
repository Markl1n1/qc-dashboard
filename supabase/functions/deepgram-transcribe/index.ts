
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

interface DeepgramKey {
  id: string;
  api_key: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { audio, mimeType, options }: DeepgramRequest = await req.json();
    
    console.log('🎙️ Processing Deepgram transcription request', {
      mimeType,
      options,
      audioLength: audio.length,
      model: options.model || 'nova-2'
    });

    // Convert base64 to binary
    const audioBuffer = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    const startTime = Date.now();

    // Try up to 3 different API keys before giving up
    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      console.log(`🔄 Attempt ${attempt + 1}/${maxRetries} - Getting next available API key`);
      
      // Get the next available API key from the pool
      const { data: keyData, error: keyError } = await supabase.rpc('get_next_deepgram_key');
      
      if (keyError || !keyData || keyData.length === 0) {
        console.error('❌ No active Deepgram API keys available:', keyError);
        throw new Error('No active Deepgram API keys available. Please add API keys in settings.');
      }

      const deepgramKey: DeepgramKey = keyData[0];
      console.log(`🔑 Using API key: ${deepgramKey.id} (${deepgramKey.api_key.substring(0, 8)}...)`);

      try {
        // Prepare Deepgram request parameters
        const params = new URLSearchParams();
        
        const model = options.model || 'nova-2';
        params.append('model', model);
        params.append('punctuate', 'true');
        params.append('smart_format', options.smart_format !== false ? 'true' : 'false');
        
        if (options.detect_language) {
          params.append('detect_language', 'true');
        } else if (options.language) {
          params.append('language', options.language);
        }

        if (options.diarize) {
          params.append('diarize', 'true');
          params.append('utterances', 'true');
          console.log('✅ Diarization enabled: diarize=true, utterances=true');
        }

        if (options.profanity_filter) {
          params.append('profanity_filter', 'true');
        }

        const deepgramUrl = `https://api.deepgram.com/v1/listen?${params.toString()}`;
        console.log('📡 Calling Deepgram API with model:', model);

        const deepgramResponse = await fetch(deepgramUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${deepgramKey.api_key}`,
            'Content-Type': mimeType || 'audio/wav'
          },
          body: audioBuffer
        });

        const responseTime = Date.now() - startTime;

        if (!deepgramResponse.ok) {
          const errorText = await deepgramResponse.text();
          console.error('❌ Deepgram API error:', {
            status: deepgramResponse.status,
            statusText: deepgramResponse.statusText,
            error: errorText,
            keyId: deepgramKey.id
          });
          
          // Log the failure
          await supabase.rpc('update_deepgram_key_status', {
            key_id: deepgramKey.id,
            is_success: false,
            error_msg: `HTTP ${deepgramResponse.status}: ${errorText}`,
            response_time: responseTime,
            file_size: audioBuffer.length
          });

          // Check for specific errors that might indicate key issues
          if (deepgramResponse.status === 401 || deepgramResponse.status === 403) {
            lastError = new Error(`API key authentication failed: ${deepgramResponse.status} ${deepgramResponse.statusText}`);
            continue; // Try next key
          } else if (deepgramResponse.status === 400 && errorText.includes('model')) {
            throw new Error(`Model ${model} is not available. Please check your Deepgram plan supports this model.`);
          }
          
          lastError = new Error(`Deepgram API error: ${deepgramResponse.status} ${deepgramResponse.statusText}`);
          continue; // Try next key
        }

        // Success! Parse the response
        const deepgramResult = await deepgramResponse.json();
        
        console.log('✅ Deepgram response received', {
          hasResults: !!deepgramResult.results,
          hasUtterances: !!deepgramResult.results?.utterances,
          utteranceCount: deepgramResult.results?.utterances?.length || 0,
          keyId: deepgramKey.id,
          responseTime
        });

        // Log the success
        await supabase.rpc('update_deepgram_key_status', {
          key_id: deepgramKey.id,
          is_success: true,
          error_msg: null,
          response_time: responseTime,
          file_size: audioBuffer.length,
          duration: deepgramResult.metadata?.duration
        });

        // Process the result
        const transcript = deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        
        let speakerUtterances: any[] = [];
        if (deepgramResult.results?.utterances) {
          console.log('📊 Processing utterances, count:', deepgramResult.results.utterances.length);
          
          speakerUtterances = deepgramResult.results.utterances.map((utterance: any, index: number) => {
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

          const speakerDistribution = speakerUtterances.reduce((acc: any, utterance: any) => {
            acc[utterance.speaker] = (acc[utterance.speaker] || 0) + 1;
            return acc;
          }, {});
          console.log('📈 Speaker distribution:', speakerDistribution);
        }

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
            model: model,
            apiKeyId: deepgramKey.id,
            responseTime
          }
        };

        console.log('✅ Processed transcription result', {
          textLength: result.text.length,
          utteranceCount: result.speakerUtterances.length,
          hasLanguageDetection: !!result.detectedLanguage,
          keyId: deepgramKey.id
        });

        return new Response(
          JSON.stringify({ success: true, result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        console.error(`❌ Error with API key ${deepgramKey.id}:`, error);
        
        // Log the failure
        await supabase.rpc('update_deepgram_key_status', {
          key_id: deepgramKey.id,
          is_success: false,
          error_msg: error instanceof Error ? error.message : 'Unknown error',
          response_time: Date.now() - startTime,
          file_size: audioBuffer.length
        });

        lastError = error instanceof Error ? error : new Error('Unknown error occurred');
        
        // Continue to next key if available
        if (attempt < maxRetries - 1) {
          console.log(`🔄 Retrying with next available API key...`);
          continue;
        }
      }
    }

    // If we get here, all retries failed
    console.error('❌ All Deepgram API keys failed after maximum retries');
    throw lastError || new Error('All Deepgram API keys failed');

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
