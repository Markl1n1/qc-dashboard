import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keyterm prompts are now fully database-driven

interface DeepgramRequest {
  audio?: string; // base64 encoded for small files
  storageFile?: string; // storage path for large files
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
    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    
    if (!DEEPGRAM_API_KEY) {
      throw new Error('Deepgram API key not configured');
    }

    const { audio, storageFile, mimeType, options }: DeepgramRequest = await req.json();
    
    console.log('🎙️ Processing Deepgram transcription request', {
      mimeType,
      options,
      audioLength: audio?.length,
      storageFile,
      isLargeFile: !!storageFile
    });

    // Create Supabase client
    const supabase = createClient(
      'https://sahudeguwojdypmmlbkd.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHVkZWd1d29qZHlwbW1sYmtkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjExNjAwNSwiZXhwIjoyMDcxNjkyMDA1fQ.eAhxBJnG-1Fmd9lDvWe-_5tXDrS7SFKlUdqP5e1I0zM'
    );

    let audioBuffer: Uint8Array;
    let useSignedUrl = false;

    if (storageFile) {
      console.log('🔗 Using direct public URL for large file:', storageFile);
      useSignedUrl = true; // Still use URL approach but with public URL
      
    } else if (audio) {
      // Convert base64 to binary for small files
      audioBuffer = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
      console.log('✅ Base64 audio converted, size:', audioBuffer.length);
    } else {
      throw new Error('No audio data or storage file provided');
    }

    // Get model configuration from database
    const { data: modelConfig } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['deepgram_nova2_languages', 'deepgram_nova3_languages', 'keyterm_prompt_en', 'keyterm_prompt_ru', 'keyterm_prompt_de', 'keyterm_prompt_es', 'keyterm_prompt_fr']);
    
    // Parse language configurations
    const nova2Languages = modelConfig?.find(c => c.key === 'deepgram_nova2_languages')?.value || '["pl","ru"]';
    const nova3Languages = modelConfig?.find(c => c.key === 'deepgram_nova3_languages')?.value || '["es","fr","de","en"]';
    
    const nova2List = JSON.parse(nova2Languages);
    const nova3List = JSON.parse(nova3Languages);
    
    // Get keyterm prompts from database
    const keytermPrompts: Record<string, string> = {};
    modelConfig?.forEach(config => {
      if (config.key.startsWith('keyterm_prompt_')) {
        const lang = config.key.replace('keyterm_prompt_', '');
        keytermPrompts[lang] = config.value;
      }
    });

    // Prepare Deepgram request parameters
    const params = new URLSearchParams();
    
    // Determine model based on language configuration with better logic
    let finalModel = 'nova-2-general'; // Default model
    let useKeyterms = false;
    
    if (options.language) {
      params.append('language', options.language);
      
      // Check if language is supported by Nova-3 first (for keyterm support)
      if (nova3List.includes(options.language)) {
        finalModel = 'nova-3-general';
        params.append('model', 'nova-3-general');
        useKeyterms = true; // Nova-3 supports keyterms
        console.log('✅ Using Nova-3 model for language:', options.language);
      } else if (nova2List.includes(options.language)) {
        finalModel = 'nova-2-general';
        params.append('model', 'nova-2-general');
        console.log('✅ Using Nova-2 model for language:', options.language);
      } else {
        // Language not in either list - try Nova-2 as fallback
        finalModel = 'nova-2-general';
        params.append('model', 'nova-2-general');
        console.log('⚠️  Language not in configured lists, using Nova-2 fallback for:', options.language);
      }
    } else {
      // Default to Nova-2 if no language specified
      params.append('model', 'nova-2-general');
      console.log('✅ Using Nova-2 model (no language specified)');
    }

    // Add keyterm parameter for Nova-3 model only (fully database-driven)
    if (useKeyterms && options.language) {
      const langKeyterm = keytermPrompts[options.language];
      if (langKeyterm && langKeyterm.trim()) {
        params.append('keyterm', langKeyterm);
        console.log('✅ Added database keyterm prompts for', options.language, ':', langKeyterm);
      } else {
        console.log('⚠️  No keyterm prompts found in database for', options.language);
      }
    }

    // Core parameters
    params.append('punctuate', 'true');
    params.append('smart_format', 'true'); // Always false as requested
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

    let deepgramResponse: Response;

    if (useSignedUrl) {
      // Use direct public URL since bucket is public
      const publicUrl = `https://sahudeguwojdypmmlbkd.supabase.co/storage/v1/object/public/audio-files/${storageFile}`;
      console.log('🔗 Using public URL:', publicUrl);

      deepgramResponse = await fetch(deepgramUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: publicUrl }),
        signal: AbortSignal.timeout(600000) // 10 minutes timeout
      });
    } else {
      deepgramResponse = await fetch(deepgramUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          // Remove Content-Type header to let Deepgram auto-detect format
        },
        body: audioBuffer!,
        signal: AbortSignal.timeout(600000) // 10 minutes timeout
      });
    }

    if (!deepgramResponse.ok) {
      let detail: any;
      try { detail = await deepgramResponse.json(); } catch {}
      console.error("❌ Deepgram API error:", {
        status: deepgramResponse.status,
        statusText: deepgramResponse.statusText,
        error: detail,
      });
      return new Response(JSON.stringify({
        success: false,
        status: deepgramResponse.status,
        statusText: deepgramResponse.statusText,
        error: detail?.err_msg ?? "Deepgram error",
        request_id: detail?.request_id ?? null,
      }), { status: deepgramResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" }});
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

    // Always clean up storage file regardless of success/failure
    if (storageFile) {
      try {
        console.log('🗑️ Cleaning up storage file:', storageFile);
        const { error: deleteError } = await supabase.storage
          .from('audio-files')
          .remove([storageFile]);
        
        if (deleteError) {
          console.error('⚠️ Failed to delete storage file:', deleteError);
        } else {
          console.log('✅ Storage file cleaned up successfully');
        }
      } catch (cleanupError) {
        console.error('⚠️ Storage cleanup error:', cleanupError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Deepgram transcription error:', error);
    
    // Clean up storage file even on error
    if (req.method === 'POST') {
      try {
        const requestData = await req.json();
        if (requestData.storageFile) {
          const supabase = createClient(
            'https://sahudeguwojdypmmlbkd.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHVkZWd1d29qZHlwbW1sYmtkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjExNjAwNSwiZXhwIjoyMDcxNjkyMDA1fQ.eAhxBJnG-1Fmd9lDvWe-_5tXDrS7SFKlUdqP5e1I0zM'
          );
          await supabase.storage.from('audio-files').remove([requestData.storageFile]);
          console.log('✅ Storage file cleaned up after error');
        }
      } catch (cleanupError) {
        console.error('⚠️ Error cleanup failed:', cleanupError);
      }
    }
    
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