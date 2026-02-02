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

// Helper function to verify JWT and get user
async function verifyAuth(req: Request, supabase: any): Promise<{ user: any; error: Response | null }> {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Security Event: Missing or invalid authorization header');
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    console.error('Security Event: Invalid token or user not found:', error?.message);
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  return { user: data.user, error: null };
}

Deno.serve(async (req) => {
  const requestStartTime = Date.now();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎬 [START] Deepgram transcription request');
  console.log('⏰ [TIME] Request received at:', new Date().toISOString());
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client first for auth verification
    const supabase = createClient(
      'https://sahudeguwojdypmmlbkd.supabase.co',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify JWT authentication
    const { user, error: authError } = await verifyAuth(req, supabase);
    if (authError) {
      return authError;
    }

    console.log('Security Event: Deepgram transcription authorized for user:', user.id);

    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    
    if (!DEEPGRAM_API_KEY) {
      console.error('❌ [CONFIG] Deepgram API key not configured');
      throw new Error('Deepgram API key not configured');
    }

    const { audio, storageFile, mimeType, options }: DeepgramRequest = await req.json();
    
    console.log('📋 [REQUEST] Transcription parameters:', {
      mimeType,
      options,
      audioDataSize: audio ? `${(audio.length / 1024 / 1024).toFixed(2)} MB (base64)` : 'N/A',
      storageFile: storageFile || 'N/A',
      processingMode: storageFile ? 'LARGE FILE (Storage URL)' : 'SMALL FILE (Base64)',
      diarizationEnabled: options.diarize || false,
      language: options.language || 'auto-detect'
    });

    let audioBuffer: Uint8Array | null = null;
    let useSignedUrl = false;
    let estimatedAudioDuration = 0;

    if (storageFile) {
      console.log('📦 [STORAGE] Processing large file from storage');
      console.log('📁 [STORAGE] File path:', storageFile);
      useSignedUrl = true;
      
    } else if (audio) {
      // Convert base64 to binary for small files
      const conversionStart = Date.now();
      audioBuffer = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
      const conversionTime = Date.now() - conversionStart;
      console.log('✅ [CONVERSION] Base64 to binary complete:', {
        bufferSize: `${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`,
        conversionTimeMs: conversionTime
      });
    } else {
      console.error('❌ [ERROR] No audio data or storage file provided');
      throw new Error('No audio data or storage file provided');
    }

    // Get model configuration from database
    console.log('🔧 [CONFIG] Fetching model configuration from database...');
    const configFetchStart = Date.now();
    const { data: modelConfig } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['deepgram_nova2_languages', 'deepgram_nova3_languages', 'keyterm_prompt_en', 'keyterm_prompt_ru', 'keyterm_prompt_de', 'keyterm_prompt_es', 'keyterm_prompt_fr']);
    
    console.log('✅ [CONFIG] Configuration fetched in', Date.now() - configFetchStart, 'ms');
    
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
        console.log('🎯 [MODEL] Selected Nova-3 for language:', options.language);
      } else if (nova2List.includes(options.language)) {
        finalModel = 'nova-2-general';
        params.append('model', 'nova-2-general');
        console.log('🎯 [MODEL] Selected Nova-2 for language:', options.language);
      } else {
        // Language not in either list - try Nova-2 as fallback
        finalModel = 'nova-2-general';
        params.append('model', 'nova-2-general');
        console.log('⚠️  [MODEL] Language not in configured lists, using Nova-2 fallback for:', options.language);
      }
    } else {
      // Default to Nova-2 if no language specified
      params.append('model', 'nova-2-general');
      console.log('🎯 [MODEL] Using Nova-2 (no language specified)');
    }

    // Add keyterm parameter for Nova-3 model only (fully database-driven)
    if (useKeyterms && options.language) {
      const langKeyterm = keytermPrompts[options.language];
      if (langKeyterm && langKeyterm.trim()) {
        params.append('keyterm', langKeyterm);
        console.log('🔑 [KEYTERMS] Added for', options.language, '- length:', langKeyterm.length, 'chars');
      } else {
        console.log('⚠️  [KEYTERMS] No prompts found in database for', options.language);
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
      params.append('min_speakers', '2'); // Force minimum 2 speakers for call center dialogs
      console.log('👥 [DIARIZATION] Enabled: diarize=true, utterances=true, min_speakers=2');
    }

    // Additional options
    if (options.profanity_filter) {
      params.append('profanity_filter', 'true');
    }

    const deepgramUrl = `https://api.deepgram.com/v1/listen?${params.toString()}`;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 [DEEPGRAM] Initiating API call');
    console.log('🎯 [DEEPGRAM] Model:', finalModel);
    console.log('📋 [DEEPGRAM] Parameters:', Object.fromEntries(params.entries()));
    console.log('⏰ [DEEPGRAM] Call started at:', new Date().toISOString());
    console.log('⏱️  [DEEPGRAM] Timeout set to: 14 minutes (840 seconds)');

    let deepgramResponse: Response | undefined;
    const deepgramCallStart = Date.now();

    if (useSignedUrl && storageFile) {
      // Generate signed URL for secure access (bucket is private)
      console.log('🔐 [SECURITY] Generating signed URL for private bucket access...');
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('audio-files')
        .createSignedUrl(storageFile, 3600); // 1 hour expiry

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error('❌ [URL] Failed to generate signed URL:', signedUrlError);
        throw new Error('Failed to generate signed URL for audio file');
      }

      const audioUrl = signedUrlData.signedUrl;
      console.log('🔗 [URL] Signed URL generated (expires in 1 hour)');

      try {
        deepgramResponse = await fetch(deepgramUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DEEPGRAM_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: audioUrl }),
          signal: AbortSignal.timeout(840000) // 14 minutes timeout (slightly less than 15 min function limit)
        });
      } catch (fetchError) {
        const elapsed = ((Date.now() - deepgramCallStart) / 1000).toFixed(2);
        console.error('❌ [DEEPGRAM] Fetch failed after', elapsed, 'seconds');
        if (fetchError instanceof Error && fetchError.name === 'TimeoutError') {
          console.error('⏱️  [TIMEOUT] Deepgram API timeout - audio likely exceeds 2.5-3 hour limit');
        }
        throw fetchError;
      }
    } else if (audioBuffer) {
      try {
        deepgramResponse = await fetch(deepgramUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DEEPGRAM_API_KEY}`,
            // Remove Content-Type header to let Deepgram auto-detect format
          },
          body: audioBuffer,
          signal: AbortSignal.timeout(840000) // 14 minutes timeout (slightly less than 15 min function limit)
        });
      } catch (fetchError) {
        const elapsed = ((Date.now() - deepgramCallStart) / 1000).toFixed(2);
        console.error('❌ [DEEPGRAM] Fetch failed after', elapsed, 'seconds');
        if (fetchError instanceof Error && fetchError.name === 'TimeoutError') {
          console.error('⏱️  [TIMEOUT] Deepgram API timeout - audio likely exceeds 2.5-3 hour limit');
        }
        throw fetchError;
      }
    }

    // Ensure deepgramResponse is assigned
    if (!deepgramResponse) {
      console.error('❌ [ERROR] No deepgramResponse - neither storage URL nor audio buffer processed');
      throw new Error('No audio data was processed');
    }

    const deepgramCallDuration = ((Date.now() - deepgramCallStart) / 1000).toFixed(2);
    console.log('✅ [DEEPGRAM] Response received in', deepgramCallDuration, 'seconds');

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


    const parseStart = Date.now();
    const deepgramResult = await deepgramResponse.json();
    const parseDuration = Date.now() - parseStart;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 [RESULTS] Deepgram response parsed in', parseDuration, 'ms');
    console.log('📊 [RESULTS] Has transcript:', !!deepgramResult.results);
    console.log('📊 [RESULTS] Has utterances:', !!deepgramResult.results?.utterances);
    console.log('📊 [RESULTS] Utterance count:', deepgramResult.results?.utterances?.length || 0);
    console.log('📊 [RESULTS] Model used:', finalModel);
    console.log('📊 [RESULTS] Detected language:', deepgramResult.metadata?.model_info?.language || 'N/A');
    
    if (deepgramResult.metadata?.duration) {
      const audioDuration = deepgramResult.metadata.duration;
      estimatedAudioDuration = audioDuration;
      const processingSpeed = audioDuration / parseFloat(deepgramCallDuration);
      console.log('📊 [PERFORMANCE] Audio duration:', audioDuration.toFixed(2), 'seconds (', (audioDuration / 60).toFixed(2), 'minutes )');
      console.log('📊 [PERFORMANCE] Processing speed:', processingSpeed.toFixed(2), 'x realtime');
      console.log('📊 [PERFORMANCE] Total processing time:', deepgramCallDuration, 'seconds');
    }

    // Process the result
    const transcript = deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    
    // Process speaker utterances if available
    let speakerUtterances: any[] = [];
    if (deepgramResult.results?.utterances) {
      const utteranceProcessStart = Date.now();
      console.log('👥 [SPEAKERS] Processing', deepgramResult.results.utterances.length, 'utterances...');
      
      speakerUtterances = deepgramResult.results.utterances.map((utterance: any, index: number) => {
        // Use actual speaker numbers from Deepgram
        const speakerNumber = utterance.speaker !== undefined ? utterance.speaker : 0;
        const speakerLabel = `Speaker ${speakerNumber}`;
        
        if (index < 3 || index >= deepgramResult.results.utterances.length - 3) {
          // Log first 3 and last 3 utterances for debugging
          console.log(`👤 [SPEAKER] #${index}: Speaker ${speakerNumber}, confidence=${utterance.confidence?.toFixed(3)}, duration=${(utterance.end - utterance.start).toFixed(2)}s`);
        }
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
      const utteranceProcessDuration = Date.now() - utteranceProcessStart;
      console.log('👥 [SPEAKERS] Distribution:', speakerDistribution);
      console.log('👥 [SPEAKERS] Processing completed in', utteranceProcessDuration, 'ms');
      
      // Warning if only one speaker detected
      const uniqueSpeakers = Object.keys(speakerDistribution).length;
      if (uniqueSpeakers === 1) {
        console.warn('⚠️  [DIARIZATION WARNING] Only 1 speaker detected! This may indicate diarization issues.');
        console.warn('⚠️  [DIARIZATION WARNING] Consider: audio quality, speaker separation, or re-processing.');
      }
    } else {
      console.log('⚠️  [SPEAKERS] No utterances in response - diarization may not be enabled');
    }

    // Detect language if available
    let detectedLanguage = null;
    if (deepgramResult.metadata?.model_info?.language) {
      detectedLanguage = {
        language: deepgramResult.metadata.model_info.language,
        confidence: deepgramResult.metadata.model_info.language_confidence || 0.95
      };
    }

    // Calculate audio duration in minutes for database
    const audioDurationSeconds = deepgramResult.metadata?.duration || 0;
    const audioDurationMinutes = audioDurationSeconds / 60;
    const fileSizeBytes = audioBuffer?.length ?? 0;
    const responseTimeMs = parseFloat(deepgramCallDuration) * 1000;
    
    const result = {
      text: transcript,
      speakerUtterances,
      detectedLanguage,
      metadata: {
        duration: audioDurationSeconds,
        durationMinutes: audioDurationMinutes,
        channels: deepgramResult.metadata?.channels || 1,
        model: finalModel
      },
      // Include stats for logging
      stats: {
        audioDurationSeconds,
        audioDurationMinutes,
        fileSizeBytes,
        responseTimeMs,
        uniqueSpeakers: Object.keys(speakerUtterances.reduce((acc: any, u: any) => { acc[u.speaker] = 1; return acc; }, {})).length
      }
    };

    const totalElapsedTime = ((Date.now() - requestStartTime) / 1000).toFixed(2);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ [SUCCESS] Transcription completed');
    console.log('📊 [SUMMARY] Transcript length:', result.text.length, 'characters');
    console.log('📊 [SUMMARY] Utterance count:', result.speakerUtterances.length);
    console.log('📊 [SUMMARY] Language detection:', result.detectedLanguage ? `${result.detectedLanguage.language} (${(result.detectedLanguage.confidence * 100).toFixed(1)}%)` : 'N/A');
    console.log('📊 [SUMMARY] Model used:', finalModel);
    console.log('⏱️  [SUMMARY] Total processing time:', totalElapsedTime, 'seconds');
    if (estimatedAudioDuration > 0) {
      console.log('⏱️  [SUMMARY] Audio duration:', (estimatedAudioDuration / 60).toFixed(2), 'minutes');
      console.log('⏱️  [SUMMARY] Processing efficiency:', (estimatedAudioDuration / parseFloat(totalElapsedTime)).toFixed(2), 'x realtime');
    }

    // Always clean up storage file regardless of success/failure
    if (storageFile) {
      try {
        console.log('🗑️  [CLEANUP] Deleting storage file:', storageFile);
        const cleanupStart = Date.now();
        const { error: deleteError } = await supabase.storage
          .from('audio-files')
          .remove([storageFile]);
        
        const cleanupDuration = Date.now() - cleanupStart;
        if (deleteError) {
          console.error('❌ [CLEANUP] Failed to delete storage file:', deleteError);
        } else {
          console.log('✅ [CLEANUP] Storage file deleted successfully in', cleanupDuration, 'ms');
        }
      } catch (cleanupError) {
        console.error('❌ [CLEANUP] Storage cleanup error:', cleanupError);
      }
    }

    console.log('🏁 [END] Request completed in', totalElapsedTime, 'seconds');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const totalElapsedTime = ((Date.now() - requestStartTime) / 1000).toFixed(2);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ [ERROR] Deepgram transcription failed');
    console.error('❌ [ERROR] Error type:', error instanceof Error ? error.name : typeof error);
    console.error('❌ [ERROR] Error message:', error instanceof Error ? error.message : String(error));
    console.error('❌ [ERROR] Time elapsed before error:', totalElapsedTime, 'seconds');
    
    // Handle timeout errors specifically
    if (error instanceof Error && (error.name === 'TimeoutError' || error.message.includes('timeout'))) {
      console.error('⏱️  [TIMEOUT] Transcription timeout detected');
      console.error('⏱️  [TIMEOUT] This usually means:');
      console.error('⏱️  [TIMEOUT]   - Audio file is too long (>2.5-3 hours)');
      console.error('⏱️  [TIMEOUT]   - Network issues with Deepgram API');
      console.error('⏱️  [TIMEOUT]   - Edge Function timeout limit reached (15 min)');
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Transcription timeout: audio file is too long. Maximum supported duration is approximately 2.5-3 hours.',
          errorType: 'TIMEOUT',
          elapsedTime: totalElapsedTime
        }),
        { 
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Clean up storage file even on error
    if (req.method === 'POST') {
      try {
        const requestData = await req.json();
        if (requestData.storageFile) {
          console.log('🗑️  [CLEANUP] Attempting cleanup after error...');
          const supabase = createClient(
            'https://sahudeguwojdypmmlbkd.supabase.co',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          await supabase.storage.from('audio-files').remove([requestData.storageFile]);
          console.log('✅ [CLEANUP] Storage file cleaned up after error');
        }
      } catch (cleanupError) {
        console.error('❌ [CLEANUP] Error cleanup failed:', cleanupError);
      }
    }
    
    const errorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorType: error instanceof Error ? error.name : 'UNKNOWN',
      elapsedTime: ((Date.now() - requestStartTime) / 1000).toFixed(2)
    };
    
    console.error('📤 [RESPONSE] Sending error response:', errorResponse);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});