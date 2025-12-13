import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeepgramRequest {
  audio?: string;
  storageFile?: string;
  mimeType: string;
  dialogId?: string; // Optional dialog ID for logging
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

interface TranscriptionLogData {
  dialog_id?: string;
  deepgram_request_id?: string;
  deepgram_sha256?: string;
  file_name?: string;
  file_size_bytes?: number;
  mime_type?: string;
  audio_duration_reported?: number;
  last_utterance_end?: number;
  first_utterance_start?: number;
  coverage_percentage?: number;
  total_utterances?: number;
  total_talk_time_seconds?: number;
  total_pause_time_seconds?: number;
  unique_speakers?: number;
  max_gap_seconds?: number;
  avg_gap_seconds?: number;
  gaps_over_5s?: number;
  processing_time_ms?: number;
  deepgram_response_time_ms?: number;
  upload_time_ms?: number;
  raw_metadata?: Record<string, unknown>;
  gap_analysis?: Record<string, unknown>;
  utterance_summary?: Record<string, unknown>;
  validation_warnings?: string[];
  is_potentially_truncated?: boolean;
}

// Analyze gaps between utterances
function analyzeGaps(utterances: Array<{ start: number; end: number }>) {
  if (!utterances || utterances.length < 2) {
    return { gaps: [], maxGap: 0, avgGap: 0, gapsOver5s: 0, totalGapTime: 0 };
  }

  const sortedUtterances = [...utterances].sort((a, b) => a.start - b.start);
  const gaps: Array<{ start: number; end: number; duration: number }> = [];

  for (let i = 1; i < sortedUtterances.length; i++) {
    const prevEnd = sortedUtterances[i - 1].end;
    const currStart = sortedUtterances[i].start;
    const gapDuration = currStart - prevEnd;
    
    if (gapDuration > 0.1) { // Only count gaps > 100ms
      gaps.push({
        start: prevEnd,
        end: currStart,
        duration: gapDuration
      });
    }
  }

  const maxGap = gaps.length > 0 ? Math.max(...gaps.map(g => g.duration)) : 0;
  const avgGap = gaps.length > 0 ? gaps.reduce((sum, g) => sum + g.duration, 0) / gaps.length : 0;
  const gapsOver5s = gaps.filter(g => g.duration > 5).length;
  const totalGapTime = gaps.reduce((sum, g) => sum + g.duration, 0);

  return { gaps, maxGap, avgGap, gapsOver5s, totalGapTime };
}

// Calculate total talk time from utterances
function calculateTalkTime(utterances: Array<{ start: number; end: number }>) {
  return utterances.reduce((total, u) => total + (u.end - u.start), 0);
}

Deno.serve(async (req) => {
  const requestStartTime = Date.now();
  const requestId = crypto.randomUUID();
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           🎬 DEEPGRAM TRANSCRIPTION REQUEST                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`📋 [REQUEST_ID] ${requestId}`);
  console.log(`⏰ [TIMESTAMP] ${new Date().toISOString()}`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logData: TranscriptionLogData = {
    validation_warnings: []
  };
  let supabase: ReturnType<typeof createClient>;

  try {
    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    
    if (!DEEPGRAM_API_KEY) {
      console.error('❌ [CONFIG] Deepgram API key not configured');
      throw new Error('Deepgram API key not configured');
    }

    const { audio, storageFile, mimeType, dialogId, options }: DeepgramRequest = await req.json();
    
    logData.dialog_id = dialogId;
    logData.mime_type = mimeType;
    logData.file_name = storageFile || 'base64_upload';
    
    const base64SizeBytes = audio ? Math.floor(audio.length * 0.75) : 0; // Estimate actual size from base64
    logData.file_size_bytes = base64SizeBytes;

    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│                    📥 INPUT DETAILS                          │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ Dialog ID: ${dialogId || 'NOT PROVIDED'}`);
    console.log(`│ MIME Type: ${mimeType}`);
    console.log(`│ Processing Mode: ${storageFile ? 'LARGE FILE (Storage URL)' : 'SMALL FILE (Base64)'}`);
    console.log(`│ Storage File: ${storageFile || 'N/A'}`);
    console.log(`│ Base64 Size: ${audio ? `${(audio.length / 1024 / 1024).toFixed(2)} MB` : 'N/A'}`);
    console.log(`│ Estimated Audio Size: ${base64SizeBytes ? `${(base64SizeBytes / 1024 / 1024).toFixed(2)} MB` : 'N/A'}`);
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│                    🎛️ OPTIONS                                │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ Model: ${options.model || 'auto'}`);
    console.log(`│ Language: ${options.language || 'auto-detect'}`);
    console.log(`│ Diarization: ${options.diarize ? 'ENABLED' : 'disabled'}`);
    console.log(`│ Punctuation: ${options.punctuate !== false ? 'ENABLED' : 'disabled'}`);
    console.log(`│ Smart Format: ${options.smart_format !== false ? 'ENABLED' : 'disabled'}`);
    console.log(`│ Profanity Filter: ${options.profanity_filter ? 'ENABLED' : 'disabled'}`);
    console.log('└─────────────────────────────────────────────────────────────┘');

    supabase = createClient(
      'https://sahudeguwojdypmmlbkd.supabase.co',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let audioBuffer: Uint8Array;
    let useSignedUrl = false;
    let uploadTimeMs = 0;

    if (storageFile) {
      console.log('📦 [STORAGE] Processing large file from storage:', storageFile);
      useSignedUrl = true;
      
      // Get file info from storage
      const { data: fileInfo } = await supabase.storage
        .from('audio-files')
        .list('', { search: storageFile });
      
      if (fileInfo && fileInfo.length > 0) {
        const file = fileInfo.find(f => f.name === storageFile);
        if (file) {
          logData.file_size_bytes = file.metadata?.size || 0;
          console.log(`📁 [STORAGE] File size from storage: ${(logData.file_size_bytes / 1024 / 1024).toFixed(2)} MB`);
        }
      }
    } else if (audio) {
      const conversionStart = Date.now();
      audioBuffer = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
      const conversionTime = Date.now() - conversionStart;
      uploadTimeMs = conversionTime;
      logData.upload_time_ms = uploadTimeMs;
      logData.file_size_bytes = audioBuffer.length;
      
      console.log(`✅ [CONVERSION] Base64 → Binary: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB in ${conversionTime}ms`);
    } else {
      throw new Error('No audio data or storage file provided');
    }

    // Fetch model configuration
    console.log('🔧 [CONFIG] Fetching model configuration...');
    const configFetchStart = Date.now();
    const { data: modelConfig } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['deepgram_nova2_languages', 'deepgram_nova3_languages', 'keyterm_prompt_en', 'keyterm_prompt_ru', 'keyterm_prompt_de', 'keyterm_prompt_es', 'keyterm_prompt_fr']);
    
    console.log(`✅ [CONFIG] Fetched in ${Date.now() - configFetchStart}ms`);
    
    const nova2Languages = modelConfig?.find(c => c.key === 'deepgram_nova2_languages')?.value || '["pl","ru"]';
    const nova3Languages = modelConfig?.find(c => c.key === 'deepgram_nova3_languages')?.value || '["es","fr","de","en"]';
    
    const nova2List = JSON.parse(nova2Languages);
    const nova3List = JSON.parse(nova3Languages);
    
    const keytermPrompts: Record<string, string> = {};
    modelConfig?.forEach(config => {
      if (config.key.startsWith('keyterm_prompt_')) {
        const lang = config.key.replace('keyterm_prompt_', '');
        keytermPrompts[lang] = config.value;
      }
    });

    // Build Deepgram request
    const params = new URLSearchParams();
    let finalModel = 'nova-2-general';
    let useKeyterms = false;
    
    if (options.language) {
      params.append('language', options.language);
      
      if (nova3List.includes(options.language)) {
        finalModel = 'nova-3-general';
        params.append('model', 'nova-3-general');
        useKeyterms = true;
        console.log(`🎯 [MODEL] Nova-3 selected for: ${options.language}`);
      } else if (nova2List.includes(options.language)) {
        finalModel = 'nova-2-general';
        params.append('model', 'nova-2-general');
        console.log(`🎯 [MODEL] Nova-2 selected for: ${options.language}`);
      } else {
        finalModel = 'nova-2-general';
        params.append('model', 'nova-2-general');
        console.log(`⚠️ [MODEL] Language not configured, fallback to Nova-2: ${options.language}`);
      }
    } else {
      params.append('model', 'nova-2-general');
      console.log('🎯 [MODEL] Nova-2 (no language specified)');
    }

    if (useKeyterms && options.language) {
      const langKeyterm = keytermPrompts[options.language];
      if (langKeyterm && langKeyterm.trim()) {
        params.append('keyterm', langKeyterm);
        console.log(`🔑 [KEYTERMS] Added ${langKeyterm.length} chars for ${options.language}`);
      }
    }

    params.append('punctuate', 'true');
    params.append('smart_format', 'true');
    params.append('filler_words', 'true');

    if (options.diarize) {
      params.append('diarize', 'true');
      params.append('utterances', 'true');
      params.append('min_speakers', '2');
      console.log('👥 [DIARIZATION] Enabled: diarize=true, utterances=true, min_speakers=2');
    }

    if (options.profanity_filter) {
      params.append('profanity_filter', 'true');
    }

    const deepgramUrl = `https://api.deepgram.com/v1/listen?${params.toString()}`;
    
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│                    🚀 DEEPGRAM API CALL                      │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ Model: ${finalModel}`);
    console.log(`│ Timeout: 14 minutes (840 seconds)`);
    console.log(`│ Parameters: ${params.toString().substring(0, 80)}...`);
    console.log('└─────────────────────────────────────────────────────────────┘');

    let deepgramResponse: Response;
    const deepgramCallStart = Date.now();

    if (useSignedUrl) {
      const publicUrl = `https://sahudeguwojdypmmlbkd.supabase.co/storage/v1/object/public/audio-files/${storageFile}`;
      console.log(`🔗 [URL] Public URL: ${publicUrl}`);

      deepgramResponse = await fetch(deepgramUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: publicUrl }),
        signal: AbortSignal.timeout(840000)
      });
    } else {
      deepgramResponse = await fetch(deepgramUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        },
        body: audioBuffer!,
        signal: AbortSignal.timeout(840000)
      });
    }

    const deepgramResponseTimeMs = Date.now() - deepgramCallStart;
    logData.deepgram_response_time_ms = deepgramResponseTimeMs;
    console.log(`✅ [DEEPGRAM] Response received in ${(deepgramResponseTimeMs / 1000).toFixed(2)}s`);

    if (!deepgramResponse.ok) {
      let detail: any;
      try { detail = await deepgramResponse.json(); } catch {}
      console.error('❌ [DEEPGRAM] API Error:', {
        status: deepgramResponse.status,
        statusText: deepgramResponse.statusText,
        error: detail,
      });
      throw new Error(`Deepgram API error: ${detail?.err_msg ?? deepgramResponse.statusText}`);
    }

    const deepgramResult = await deepgramResponse.json();
    
    // Extract Deepgram metadata
    logData.deepgram_request_id = deepgramResult.metadata?.request_id;
    logData.deepgram_sha256 = deepgramResult.metadata?.sha256;
    logData.raw_metadata = deepgramResult.metadata;

    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│                    📊 DEEPGRAM RESPONSE                      │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ Request ID: ${deepgramResult.metadata?.request_id || 'N/A'}`);
    console.log(`│ SHA256: ${deepgramResult.metadata?.sha256?.substring(0, 16) || 'N/A'}...`);
    console.log(`│ Duration (reported): ${deepgramResult.metadata?.duration?.toFixed(2) || 'N/A'} seconds`);
    console.log(`│ Duration (minutes): ${deepgramResult.metadata?.duration ? (deepgramResult.metadata.duration / 60).toFixed(2) : 'N/A'} minutes`);
    console.log(`│ Channels: ${deepgramResult.metadata?.channels || 'N/A'}`);
    console.log(`│ Model Used: ${deepgramResult.metadata?.model_info?.name || finalModel}`);
    console.log(`│ Has Utterances: ${!!deepgramResult.results?.utterances}`);
    console.log(`│ Utterance Count: ${deepgramResult.results?.utterances?.length || 0}`);
    console.log('└─────────────────────────────────────────────────────────────┘');

    const transcript = deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const audioDurationSeconds = deepgramResult.metadata?.duration || 0;
    logData.audio_duration_reported = audioDurationSeconds;

    // Process utterances with detailed analysis
    let speakerUtterances: any[] = [];
    
    if (deepgramResult.results?.utterances) {
      const rawUtterances = deepgramResult.results.utterances;
      console.log(`👥 [UTTERANCES] Processing ${rawUtterances.length} utterances...`);
      
      speakerUtterances = rawUtterances.map((utterance: any) => {
        const speakerNumber = utterance.speaker !== undefined ? utterance.speaker : 0;
        return {
          speaker: `Speaker ${speakerNumber}`,
          text: utterance.transcript,
          confidence: utterance.confidence,
          start: utterance.start,
          end: utterance.end
        };
      });

      // Detailed utterance analysis
      const firstUtterance = speakerUtterances[0];
      const lastUtterance = speakerUtterances[speakerUtterances.length - 1];
      
      logData.first_utterance_start = firstUtterance?.start || 0;
      logData.last_utterance_end = lastUtterance?.end || 0;
      logData.total_utterances = speakerUtterances.length;

      // Calculate talk time
      const totalTalkTime = calculateTalkTime(speakerUtterances);
      logData.total_talk_time_seconds = totalTalkTime;
      logData.total_pause_time_seconds = audioDurationSeconds - totalTalkTime;

      // Analyze gaps
      const gapAnalysis = analyzeGaps(speakerUtterances);
      logData.max_gap_seconds = gapAnalysis.maxGap;
      logData.avg_gap_seconds = gapAnalysis.avgGap;
      logData.gaps_over_5s = gapAnalysis.gapsOver5s;
      logData.gap_analysis = {
        totalGapTime: gapAnalysis.totalGapTime,
        gapCount: gapAnalysis.gaps.length,
        largestGaps: gapAnalysis.gaps
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 5)
          .map(g => ({ start: g.start.toFixed(2), end: g.end.toFixed(2), duration: g.duration.toFixed(2) }))
      };

      // Coverage calculation
      const coverage = audioDurationSeconds > 0 
        ? ((lastUtterance?.end || 0) / audioDurationSeconds) * 100 
        : 0;
      logData.coverage_percentage = coverage;

      // Speaker distribution
      const speakerDistribution = speakerUtterances.reduce((acc: Record<string, { count: number; talkTime: number }>, u) => {
        if (!acc[u.speaker]) {
          acc[u.speaker] = { count: 0, talkTime: 0 };
        }
        acc[u.speaker].count++;
        acc[u.speaker].talkTime += (u.end - u.start);
        return acc;
      }, {});
      
      logData.unique_speakers = Object.keys(speakerDistribution).length;
      logData.utterance_summary = {
        firstUtterance: { speaker: firstUtterance?.speaker, start: firstUtterance?.start, end: firstUtterance?.end },
        lastUtterance: { speaker: lastUtterance?.speaker, start: lastUtterance?.start, end: lastUtterance?.end },
        speakerDistribution
      };

      console.log('┌─────────────────────────────────────────────────────────────┐');
      console.log('│                    📈 UTTERANCE ANALYSIS                     │');
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log(`│ Total Utterances: ${speakerUtterances.length}`);
      console.log(`│ First Utterance Start: ${firstUtterance?.start?.toFixed(2) || 0}s`);
      console.log(`│ Last Utterance End: ${lastUtterance?.end?.toFixed(2) || 0}s`);
      console.log(`│ Audio Duration: ${audioDurationSeconds.toFixed(2)}s (${(audioDurationSeconds / 60).toFixed(2)} min)`);
      console.log(`│ Coverage: ${coverage.toFixed(2)}%`);
      console.log(`│ Total Talk Time: ${totalTalkTime.toFixed(2)}s (${(totalTalkTime / 60).toFixed(2)} min)`);
      console.log(`│ Total Pause Time: ${(audioDurationSeconds - totalTalkTime).toFixed(2)}s`);
      console.log(`│ Unique Speakers: ${logData.unique_speakers}`);
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log('│                    🔍 GAP ANALYSIS                           │');
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log(`│ Max Gap: ${gapAnalysis.maxGap.toFixed(2)}s`);
      console.log(`│ Avg Gap: ${gapAnalysis.avgGap.toFixed(2)}s`);
      console.log(`│ Gaps > 5s: ${gapAnalysis.gapsOver5s}`);
      console.log(`│ Total Gap Time: ${gapAnalysis.totalGapTime.toFixed(2)}s`);
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log('│                    👥 SPEAKER DISTRIBUTION                   │');
      console.log('├─────────────────────────────────────────────────────────────┤');
      Object.entries(speakerDistribution).forEach(([speaker, data]) => {
        console.log(`│ ${speaker}: ${data.count} utterances, ${data.talkTime.toFixed(2)}s talk time`);
      });
      console.log('└─────────────────────────────────────────────────────────────┘');

      // Validation warnings
      const validationWarnings: string[] = [];
      
      // Check for truncation
      const lastEndVsAudioDiff = audioDurationSeconds - (lastUtterance?.end || 0);
      if (lastEndVsAudioDiff > 60) { // More than 60 seconds difference
        const warning = `POTENTIAL TRUNCATION: Last utterance ends at ${lastUtterance?.end?.toFixed(2)}s but audio is ${audioDurationSeconds.toFixed(2)}s (${lastEndVsAudioDiff.toFixed(2)}s difference)`;
        validationWarnings.push(warning);
        logData.is_potentially_truncated = true;
        console.warn(`⚠️ [VALIDATION] ${warning}`);
      }

      // Check coverage
      if (coverage < 50) {
        const warning = `LOW COVERAGE: Only ${coverage.toFixed(2)}% of audio covered by utterances`;
        validationWarnings.push(warning);
        console.warn(`⚠️ [VALIDATION] ${warning}`);
      }

      // Check single speaker
      if (logData.unique_speakers === 1 && speakerUtterances.length > 5) {
        const warning = `SINGLE SPEAKER: Only 1 speaker detected with ${speakerUtterances.length} utterances - diarization may have failed`;
        validationWarnings.push(warning);
        console.warn(`⚠️ [VALIDATION] ${warning}`);
      }

      // Check for long gaps
      if (gapAnalysis.gapsOver5s > 10) {
        const warning = `MANY LONG GAPS: ${gapAnalysis.gapsOver5s} gaps > 5 seconds detected`;
        validationWarnings.push(warning);
        console.warn(`⚠️ [VALIDATION] ${warning}`);
      }

      logData.validation_warnings = validationWarnings;
    }

    // Detect language
    let detectedLanguage = null;
    if (deepgramResult.metadata?.model_info?.language) {
      detectedLanguage = {
        language: deepgramResult.metadata.model_info.language,
        confidence: deepgramResult.metadata.model_info.language_confidence || 0.95
      };
    }

    const totalProcessingTime = Date.now() - requestStartTime;
    logData.processing_time_ms = totalProcessingTime;

    const result = {
      text: transcript,
      speakerUtterances,
      detectedLanguage,
      metadata: {
        duration: audioDurationSeconds,
        durationMinutes: audioDurationSeconds / 60,
        channels: deepgramResult.metadata?.channels || 1,
        model: finalModel
      },
      stats: {
        audioDurationSeconds,
        audioDurationMinutes: audioDurationSeconds / 60,
        fileSizeBytes: logData.file_size_bytes || 0,
        responseTimeMs: deepgramResponseTimeMs,
        uniqueSpeakers: logData.unique_speakers || 0
      },
      // Include debug info in response
      debug: {
        requestId,
        deepgramRequestId: logData.deepgram_request_id,
        firstUtteranceStart: logData.first_utterance_start,
        lastUtteranceEnd: logData.last_utterance_end,
        coveragePercentage: logData.coverage_percentage,
        totalTalkTimeSeconds: logData.total_talk_time_seconds,
        totalPauseTimeSeconds: logData.total_pause_time_seconds,
        validationWarnings: logData.validation_warnings,
        isPotentiallyTruncated: logData.is_potentially_truncated
      }
    };

    // Save transcription log to database
    console.log('💾 [LOG] Saving transcription log to database...');
    try {
      const { error: logError } = await supabase
        .from('transcription_logs')
        .insert(logData);
      
      if (logError) {
        console.error('❌ [LOG] Failed to save transcription log:', logError);
      } else {
        console.log('✅ [LOG] Transcription log saved successfully');
      }
    } catch (logSaveError) {
      console.error('❌ [LOG] Error saving transcription log:', logSaveError);
    }

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ TRANSCRIPTION COMPLETE                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`│ Transcript Length: ${result.text.length} characters`);
    console.log(`│ Utterance Count: ${result.speakerUtterances.length}`);
    console.log(`│ Audio Duration: ${(audioDurationSeconds / 60).toFixed(2)} minutes`);
    console.log(`│ Processing Time: ${(totalProcessingTime / 1000).toFixed(2)}s`);
    console.log(`│ Processing Speed: ${audioDurationSeconds > 0 ? (audioDurationSeconds / (totalProcessingTime / 1000)).toFixed(2) : 'N/A'}x realtime`);
    if (logData.validation_warnings && logData.validation_warnings.length > 0) {
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log('│                    ⚠️ VALIDATION WARNINGS                    │');
      logData.validation_warnings.forEach(w => console.log(`│ • ${w}`));
    }
    console.log('└─────────────────────────────────────────────────────────────┘');

    // Cleanup storage file
    if (storageFile) {
      try {
        console.log('🗑️ [CLEANUP] Deleting storage file:', storageFile);
        const { error: deleteError } = await supabase.storage
          .from('audio-files')
          .remove([storageFile]);
        
        if (deleteError) {
          console.error('❌ [CLEANUP] Failed to delete storage file:', deleteError);
        } else {
          console.log('✅ [CLEANUP] Storage file deleted successfully');
        }
      } catch (cleanupError) {
        console.error('❌ [CLEANUP] Storage cleanup error:', cleanupError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const totalElapsedTime = Date.now() - requestStartTime;
    logData.processing_time_ms = totalElapsedTime;
    logData.validation_warnings = [...(logData.validation_warnings || []), `ERROR: ${error instanceof Error ? error.message : String(error)}`];
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ❌ TRANSCRIPTION FAILED                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.error(`│ Error Type: ${error instanceof Error ? error.name : typeof error}`);
    console.error(`│ Error Message: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`│ Time Elapsed: ${(totalElapsedTime / 1000).toFixed(2)}s`);
    console.log('└─────────────────────────────────────────────────────────────┘');
    
    // Try to save error log
    if (supabase) {
      try {
        await supabase.from('transcription_logs').insert(logData);
        console.log('✅ [LOG] Error log saved to database');
      } catch (logError) {
        console.error('❌ [LOG] Failed to save error log:', logError);
      }
    }
    
    // Handle timeout
    if (error instanceof Error && (error.name === 'TimeoutError' || error.message.includes('timeout'))) {
      console.error('⏱️ [TIMEOUT] Transcription timeout detected');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Transcription timeout: audio file may be too long',
          errorType: 'TIMEOUT',
          elapsedTime: (totalElapsedTime / 1000).toFixed(2)
        }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorType: error instanceof Error ? error.name : 'UNKNOWN',
        elapsedTime: (totalElapsedTime / 1000).toFixed(2)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
