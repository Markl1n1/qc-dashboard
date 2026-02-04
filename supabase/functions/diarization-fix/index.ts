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

const SYSTEM_PROMPT = `You are an expert in analyzing and correcting speaker diarization in customer service conversations.

TASK: Analyze the following transcript and correct any diarization issues.

CONTEXT:
- These are customer service phone calls between an Agent and a Customer
- Deepgram has performed automatic speaker diarization but it may contain errors
- Your job is to analyze the conversation flow and correct speaker assignments

COMMON DIARIZATION ERRORS:
1. All speech assigned to single speaker (very common with low-quality audio)
2. Speaker labels swapped (Agent marked as Customer and vice versa)
3. Incorrect speaker changes mid-sentence
4. Missing speaker changes between turns

CRITICAL: DETECTING ILLOGICAL CONSECUTIVE UTTERANCES FROM SAME SPEAKER

One of the most common diarization errors is when multiple utterances are incorrectly 
assigned to the same speaker when they should be split between two speakers. 

Look for these patterns - they indicate a MISSING SPEAKER CHANGE:

A) Question followed by counter-question (same speaker):
   ❌ "А какие у вас тарифы?" → "А вы для дома или для бизнеса интересуетесь?"
   ✅ This should be Customer asking, then Agent clarifying

B) Question followed by answer (same speaker):
   ❌ "Сколько это стоит?" → "Стоимость составляет 500 рублей"
   ✅ This should be Customer asking, then Agent answering

C) Statement followed by clarifying question (same speaker):
   ❌ "Мне нужно подключить интернет" → "В какой квартире?"
   ✅ This should be Customer requesting, then Agent asking for details

D) Request followed by confirmation request (same speaker):
   ❌ "Запишите меня на завтра" → "На какое время вас записать?"
   ✅ This should be Customer requesting, then Agent clarifying

E) Greeting followed by response (same speaker):
   ❌ "Добрый день" → "Здравствуйте, чем могу помочь?"
   ✅ This should be Customer greeting, then Agent responding

F) Affirmation followed by continuation (same speaker):
   ❌ "Да, верно" → "Хорошо, тогда я оформлю заявку"
   ✅ This should be Customer confirming, then Agent proceeding

G) Multiple questions without waiting for answer:
   ❌ "Когда будет готово?" → "А можно ускорить?" → "И сколько это стоит?"
   ✅ Usually indicates speaker changes between logical question-answer pairs

GENERAL RULE: In a normal conversation, people WAIT for responses. If you see:
- Question → Question (different topic or clarifying) = likely different speakers
- Statement → Reaction/Response = likely different speakers  
- Request → Clarification request = likely different speakers

HOW TO IDENTIFY AGENT VS CUSTOMER:
Agent patterns:
- Greetings: "Добрый день", "Здравствуйте", "Компания X, чем могу помочь?", "Hello", "Thank you for calling"
- Formal speech, professional tone
- Provides information, instructions, answers
- Asks clarifying questions about customer needs
- Says goodbye formally, offers further assistance

Customer patterns:
- Responds to greetings (not initiates formal company greetings)
- Asks questions about services/products
- Provides personal information (name, phone, address)
- Expresses problems, complaints, or requests
- Confirms or denies information

RESPOND WITH VALID JSON ONLY (no markdown, no code blocks):
{
  "needs_correction": true or false,
  "confidence": 0.0 to 1.0,
  "analysis": "Brief explanation of detected issues or why no correction needed",
  "labels": ["Agent" or "Customer", ...],
  "speaker_mapping": {
    "Speaker 0": "Agent or Customer",
    "Speaker 1": "Agent or Customer"
  }
}

CRITICAL RULES:
- NEVER modify the text content - keep it exactly as provided
- NEVER modify timing (start/end values) - keep them exactly as provided
- ONLY reassign speaker labels based on conversation context
- Use "Agent" and "Customer" as final speaker names (not Speaker 0/1)
- The server will build corrected_utterances and formatted dialog from your labels; do NOT output formatted_dialog.
- Be conservative: only mark needs_correction=true when confident there are errors
- PAY SPECIAL ATTENTION to consecutive utterances from the same speaker - 
  analyze if they make logical sense as one person speaking without a response`;

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

    let openaiResponse: Response;
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Analyze and fix diarization for this transcript (keep original text unchanged; output only labels array):\n\n${JSON.stringify(utterancesForAnalysis)}` }
          ],
          temperature: 0.3,
          // Labels array for 160 utterances ~ 800 tokens + analysis ~ 200 = ~1000, add buffer
          max_tokens: 4000,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('❌ [TIMEOUT] OpenAI request timed out after 50 seconds');
        return new Response(
          JSON.stringify({ error: 'Request timed out. Try with a shorter dialog.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      return new Response(
        JSON.stringify({ error: 'OpenAI API error', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Parse GPT response
    let result: DiarizationFixResult;
    try {
      result = JSON.parse(content);
    } catch (parseError: unknown) {
      console.error('❌ [PARSE] Failed to parse GPT response:', parseError instanceof Error ? parseError.message : String(parseError));
      console.error('❌ [PARSE] Raw content:', content.substring(0, 500));
      return new Response(
        JSON.stringify({ error: 'Failed to parse GPT response', raw: content.substring(0, 500) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
