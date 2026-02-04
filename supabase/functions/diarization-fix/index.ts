import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SpeakerUtterance {
  speaker: string;
  text: string;
  confidence: number;
  start: number;
  end: number;
}

interface CorrectedUtterance {
  speaker: 'Agent' | 'Customer';
  original_speaker: string;
  text: string;
  start: number;
  end: number;
}

interface DiarizationFixResult {
  needs_correction: boolean;
  confidence: number;
  analysis: string;
  // GPT may return either full corrected utterances OR just speaker labels per utterance index.
  corrected_utterances?: CorrectedUtterance[];
  labels?: Array<'Agent' | 'Customer' | string>;
  formatted_dialog?: string;
  speaker_mapping?: Record<string, string>;
}

// Keep the system prompt SHORT and the completion STRICT to avoid truncated JSON (which causes non-2xx errors).
const SYSTEM_PROMPT = `You correct speaker diarization for customer service calls between exactly two roles: Agent and Customer.

INPUT: a list of utterances with fields {index, speaker, text} in order.
OUTPUT: JSON only (no markdown) with EXACT keys:
{
  "needs_correction": boolean,
  "confidence": number,
  "analysis": string,
  "labels": ["Agent"|"Customer", ...],
  "speaker_mapping": { "<original speaker>": "Agent"|"Customer", ... }
}

STRICT RULES:
- The "labels" array MUST have exactly N items (N is provided).
- "analysis" MUST be <= 180 characters and contain NO newlines.
- Do not include any other keys.
- If unsure, be conservative: set needs_correction=false and keep labels consistent with the original speaker labels (map each original speaker consistently).`;

function normalizeFinalSpeaker(input: unknown): 'Agent' | 'Customer' {
  const raw = String(input ?? '').trim().toLowerCase();
  if (raw === 'agent') return 'Agent';
  if (raw === 'customer') return 'Customer';
  // Fallback: be conservative and default to Agent (common call-center baseline)
  return 'Agent';
}

function buildFormattedDialog(correctedUtterances: CorrectedUtterance[]): string {
  if (!correctedUtterances?.length) return '';

  let currentSpeaker = '';
  const lines: string[] = [];

  for (const u of correctedUtterances) {
    if (u.speaker !== currentSpeaker) {
      if (lines.length > 0) lines.push('');
      lines.push(`${u.speaker}:`);
      currentSpeaker = u.speaker;
    }
    lines.push(`- ${u.text}`);
  }

  return lines.join('\n');
}

function buildSpeakerMapping(
  originalUtterances: SpeakerUtterance[],
  correctedUtterances: CorrectedUtterance[]
): Record<string, string> {
  const counts: Record<string, { Agent: number; Customer: number }> = {};

  for (let i = 0; i < Math.min(originalUtterances.length, correctedUtterances.length); i++) {
    const originalSpeaker = originalUtterances[i]?.speaker ?? 'Unknown';
    const finalSpeaker = correctedUtterances[i]?.speaker;
    if (!counts[originalSpeaker]) counts[originalSpeaker] = { Agent: 0, Customer: 0 };
    counts[originalSpeaker][finalSpeaker] += 1;
  }

  const mapping: Record<string, string> = {};
  for (const [orig, c] of Object.entries(counts)) {
    mapping[orig] = c.Agent >= c.Customer ? 'Agent' : 'Customer';
  }
  return mapping;
}

Deno.serve(async (req) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 [START] Diarization fix request');
  console.log('⏰ [TIME] Request received at:', new Date().toISOString());

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client for auth verification
    const supabase = createClient(
      'https://sahudeguwojdypmmlbkd.supabase.co',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify JWT authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ [AUTH] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      console.error('❌ [AUTH] Invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [AUTH] User authenticated:', userData.user.id);

    // Check if user has admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      // Fallback: check profiles table
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .single();

      if (profileData?.role !== 'admin') {
        console.warn('⚠️ [AUTH] Non-admin user attempted to use diarization-fix:', userData.user.id);
        return new Response(
          JSON.stringify({ error: 'Forbidden - Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('✅ [AUTH] Admin role verified');

    // Parse request body
    const { utterances } = await req.json() as { utterances: SpeakerUtterance[] };

    if (!utterances || !Array.isArray(utterances) || utterances.length === 0) {
      console.error('❌ [INPUT] No utterances provided');
      return new Response(
        JSON.stringify({ error: 'No utterances provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📊 [INPUT] Received', utterances.length, 'utterances');

    // Analyze speaker distribution
    const speakerCounts = utterances.reduce((acc, u) => {
      acc[u.speaker] = (acc[u.speaker] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('👥 [SPEAKERS] Distribution:', speakerCounts);

    // Get OpenAI API key
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('❌ [CONFIG] OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare utterances for GPT analysis
    const utterancesForAnalysis = utterances.map((u, index) => ({
      index,
      speaker: u.speaker,
      text: u.text,
    }));

    console.log('🤖 [GPT] Sending to OpenAI for analysis...');
    const gptStart = Date.now();

    // Create abort controller with timeout slightly below the function timeout.
    // (Configured in supabase/config.toml; keep safety margin for auth + parsing.)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 105000);

    const model = utterances.length > 80 ? 'gpt-4o-mini' : 'gpt-4o';
    console.log('🧠 [GPT] Model selected:', model);

    const makeOpenAIRequest = async (mode: 'normal' | 'minimal') => {
      const N = utterancesForAnalysis.length;

      const userPrompt = mode === 'minimal'
        ? `Return VALID JSON only. Keys: labels, speaker_mapping.\n\nRules:\n- labels length MUST be exactly ${N}\n- labels values ONLY: Agent or Customer\n- do NOT include any other keys\n\nUtterances:\n${JSON.stringify(utterancesForAnalysis)}`
        : `Return VALID JSON only. Keys: needs_correction, confidence, analysis, labels, speaker_mapping.\n\nRules:\n- labels length MUST be exactly ${N}\n- analysis <= 180 characters, no newlines\n- labels values ONLY: Agent or Customer\n- do NOT include any other keys\n\nUtterances:\n${JSON.stringify(utterancesForAnalysis)}`;

      const maxTokens = mode === 'minimal' ? 1200 : 1600;

      return await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          // Keep temperature low to reduce variance and verbosity.
          temperature: mode === 'minimal' ? 0.0 : 0.2,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });
    };

    let openaiResponse: Response;
    try {
      openaiResponse = await makeOpenAIRequest('normal');
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('❌ [TIMEOUT] OpenAI request timed out (~105s)');
        return new Response(
          JSON.stringify({ success: false, error: 'Request timed out. Try again or use a shorter dialog.' }),
          // Return 200 to avoid generic client-side FunctionsHttpError.
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }
    clearTimeout(timeoutId);

    const gptDuration = ((Date.now() - gptStart) / 1000).toFixed(2);
    console.log('✅ [GPT] Response received in', gptDuration, 'seconds');

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ [GPT] OpenAI API error:', openaiResponse.status, errorText);
      // Return 200 to avoid generic FunctionsHttpError on the client; UI already expects {success:false}.
      return new Response(
        JSON.stringify({ success: false, error: 'OpenAI API error', details: errorText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiResult = await openaiResponse.json();
    const content = openaiResult.choices?.[0]?.message?.content;

    if (!content) {
      console.error('❌ [GPT] No content in response');
      return new Response(
        JSON.stringify({ error: 'No response from GPT' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📄 [GPT] Raw response length:', content.length, 'chars');

    const tryParseJson = (raw: string): DiarizationFixResult | null => {
      try {
        return JSON.parse(raw);
      } catch {
        // Attempt to salvage if the model accidentally wrapped JSON with extra text
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
          try {
            return JSON.parse(raw.slice(start, end + 1));
          } catch {
            return null;
          }
        }
        return null;
      }
    };

    // Parse GPT response (with one fallback attempt that requests a minimal JSON)
    let result: DiarizationFixResult | null = tryParseJson(content);

    if (!result) {
      console.warn('⚠️ [PARSE] First parse failed. Retrying with minimal JSON schema...');
      try {
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 25000);
        const retryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `Return VALID JSON only with keys: labels, speaker_mapping. labels length MUST be exactly ${utterancesForAnalysis.length}. Values only Agent/Customer. Utterances:\n${JSON.stringify(utterancesForAnalysis)}` }
            ],
            temperature: 0.0,
            max_tokens: 1200,
            response_format: { type: 'json_object' }
          }),
          signal: retryController.signal
        });
        clearTimeout(retryTimeoutId);

        if (retryResponse.ok) {
          const retryJson = await retryResponse.json();
          const retryContent = retryJson.choices?.[0]?.message?.content;
          if (retryContent) {
            result = tryParseJson(retryContent);
          }
        }
      } catch (retryError: unknown) {
        console.warn('⚠️ [PARSE] Retry failed:', retryError instanceof Error ? retryError.message : String(retryError));
      }
    }

    if (!result) {
      console.error('❌ [PARSE] Failed to parse GPT response after retry');
      // Return 200 so the UI can show a useful error instead of generic non-2xx.
      return new Response(
        JSON.stringify({ success: false, error: 'GPT returned invalid JSON. Please retry Validate Diarization.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ [RESULT] Diarization analysis complete');
    console.log('📊 [RESULT] Needs correction:', result.needs_correction);
    console.log('📊 [RESULT] Confidence:', result.confidence);
    console.log('📊 [RESULT] Analysis:', result.analysis);
    // Build corrected utterances deterministically server-side to keep GPT completion small
    let correctedUtterances: CorrectedUtterance[];

    if (Array.isArray(result.corrected_utterances) && result.corrected_utterances.length > 0) {
      correctedUtterances = result.corrected_utterances.map((u) => ({
        speaker: normalizeFinalSpeaker((u as any).speaker),
        original_speaker: (u as any).original_speaker ?? 'Unknown',
        text: (u as any).text ?? '',
        start: (u as any).start ?? 0,
        end: (u as any).end ?? 0,
      }));
    } else if (Array.isArray(result.labels)) {
      // Handle truncated or mismatched labels gracefully
      if (result.labels.length < utterances.length) {
        console.warn(`⚠️ [LABELS] Padding labels: got ${result.labels.length}, expected ${utterances.length}`);
        // Pad with last known label or alternate Agent/Customer
        const lastLabel = result.labels[result.labels.length - 1] || 'Agent';
        while (result.labels.length < utterances.length) {
          result.labels.push(lastLabel === 'Agent' ? 'Customer' : 'Agent');
        }
      } else if (result.labels.length > utterances.length) {
        console.warn(`⚠️ [LABELS] Truncating labels: got ${result.labels.length}, expected ${utterances.length}`);
        result.labels = result.labels.slice(0, utterances.length);
      }

      correctedUtterances = utterances.map((u, i) => ({
        speaker: normalizeFinalSpeaker(result.labels?.[i]),
        original_speaker: u.speaker,
        text: u.text,
        start: u.start,
        end: u.end,
      }));
    } else {
      throw new Error('GPT response missing labels or corrected_utterances');
    }

    const speakerMapping =
      result.speaker_mapping && Object.keys(result.speaker_mapping).length > 0
        ? result.speaker_mapping
        : buildSpeakerMapping(utterances, correctedUtterances);

    const formattedDialog = buildFormattedDialog(correctedUtterances);

    console.log('📊 [RESULT] Corrected utterances:', correctedUtterances.length);
    console.log('📊 [RESULT] Speaker mapping:', speakerMapping);

    // Token usage logging
    if (openaiResult.usage) {
      console.log('💰 [TOKENS] Usage:', {
        prompt: openaiResult.usage.prompt_tokens,
        completion: openaiResult.usage.completion_tokens,
        total: openaiResult.usage.total_tokens
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        needs_correction: Boolean(result.needs_correction),
        confidence: typeof result.confidence === 'number' ? result.confidence : 0,
        analysis: typeof result.analysis === 'string' ? result.analysis : 'N/A',
        corrected_utterances: correctedUtterances,
        formatted_dialog: formattedDialog,
        speaker_mapping: speakerMapping,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ [ERROR] Diarization fix failed:', errorMessage);
    return new Response(
      // Return 200 to avoid generic client-side FunctionsHttpError.
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
