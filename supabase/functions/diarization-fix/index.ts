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
  corrected_utterances?: CorrectedUtterance[];
  labels?: Array<'Agent' | 'Customer' | string>;
  formatted_dialog?: string;
  speaker_mapping?: Record<string, string>;
}

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

const CHUNK_SIZE = 120;
const CHUNK_OVERLAP = 5;

interface ChunkInput {
  utterances: Array<{ index: number; speaker: string; text: string }>;
  globalOffset: number;
}

function splitIntoChunks(
  utterancesForAnalysis: Array<{ index: number; speaker: string; text: string }>
): ChunkInput[] {
  if (utterancesForAnalysis.length <= 150) {
    return [{ utterances: utterancesForAnalysis, globalOffset: 0 }];
  }

  const chunks: ChunkInput[] = [];
  let start = 0;
  while (start < utterancesForAnalysis.length) {
    const end = Math.min(start + CHUNK_SIZE, utterancesForAnalysis.length);
    // Include overlap context from previous chunk
    const contextStart = start > 0 ? Math.max(0, start - CHUNK_OVERLAP) : start;
    chunks.push({
      utterances: utterancesForAnalysis.slice(contextStart, end),
      globalOffset: start,
    });
    start = end;
  }
  return chunks;
}

async function processChunk(
  chunk: ChunkInput,
  OPENAI_API_KEY: string,
  model: string,
  signal: AbortSignal
): Promise<string[] | null> {
  const N = chunk.utterances.length;
  const userPrompt = `Return VALID JSON only. Keys: labels, speaker_mapping.\n\nRules:\n- labels length MUST be exactly ${N}\n- labels values ONLY: Agent or Customer\n- do NOT include any other keys\n\nUtterances:\n${JSON.stringify(chunk.utterances)}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
      temperature: 0.0,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    }),
    signal
  });

  if (!response.ok) return null;

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;

  const parsed = tryParseJson(content);
  if (!parsed?.labels || !Array.isArray(parsed.labels)) return null;

  return parsed.labels.map((l: unknown) => String(l));
}

function tryParseJson(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
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
}

Deno.serve(async (req) => {
  console.log('🔧 [START] Diarization fix request at:', new Date().toISOString());

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      'https://sahudeguwojdypmmlbkd.supabase.co',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Auth verification
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin check
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .single();
      if (profileData?.role !== 'admin') {
        return new Response(
          JSON.stringify({ error: 'Forbidden - Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { utterances } = await req.json() as { utterances: SpeakerUtterance[] };
    if (!utterances?.length) {
      return new Response(
        JSON.stringify({ error: 'No utterances provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📊 [INPUT]', utterances.length, 'utterances');

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const model = utterances.length > 80 ? 'gpt-4o-mini' : 'gpt-4o';
    const utterancesForAnalysis = utterances.map((u, index) => ({
      index, speaker: u.speaker, text: u.text
    }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 105000);

    let allLabels: string[];
    let result: DiarizationFixResult | null = null;

    const chunks = splitIntoChunks(utterancesForAnalysis);

    if (chunks.length === 1) {
      // Single chunk — use full analysis prompt
      console.log('🧠 [GPT] Single chunk, model:', model);
      const gptStart = Date.now();

      const N = utterancesForAnalysis.length;
      const userPrompt = `Return VALID JSON only. Keys: needs_correction, confidence, analysis, labels, speaker_mapping.\n\nRules:\n- labels length MUST be exactly ${N}\n- analysis <= 180 characters, no newlines\n- labels values ONLY: Agent or Customer\n- do NOT include any other keys\n\nUtterances:\n${JSON.stringify(utterancesForAnalysis)}`;

      let response: Response;
      try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            temperature: 0.2,
            max_tokens: 1600,
            response_format: { type: 'json_object' }
          }),
          signal: controller.signal
        });
      } catch (e: unknown) {
        clearTimeout(timeoutId);
        if (e instanceof Error && e.name === 'AbortError') {
          return new Response(
            JSON.stringify({ success: false, error: 'Request timed out.' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw e;
      }
      clearTimeout(timeoutId);

      console.log('✅ [GPT] Response in', ((Date.now() - gptStart) / 1000).toFixed(2), 's');

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({ success: false, error: 'OpenAI API error', details: errorText }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const openaiResult = await response.json();
      const content = openaiResult.choices?.[0]?.message?.content;
      if (!content) {
        return new Response(
          JSON.stringify({ success: false, error: 'No response from GPT' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      result = tryParseJson(content);
      if (!result) {
        return new Response(
          JSON.stringify({ success: false, error: 'GPT returned invalid JSON. Please retry.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract labels
      if (Array.isArray(result.labels)) {
        allLabels = result.labels.map(l => String(l));
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'GPT response missing labels.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Multi-chunk batching
      console.log(`🧠 [GPT] Batching: ${chunks.length} chunks, model: ${model}`);
      const gptStart = Date.now();

      const chunkResults = await Promise.all(
        chunks.map(chunk => processChunk(chunk, OPENAI_API_KEY, model, controller.signal))
      );
      clearTimeout(timeoutId);

      console.log('✅ [GPT] All chunks done in', ((Date.now() - gptStart) / 1000).toFixed(2), 's');

      // Merge labels from chunks, removing overlap context
      allLabels = [];
      for (let i = 0; i < chunks.length; i++) {
        const labels = chunkResults[i];
        if (!labels) {
          return new Response(
            JSON.stringify({ success: false, error: `Chunk ${i + 1}/${chunks.length} failed. Please retry.` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // For chunks with overlap context, skip the overlap labels
        const overlapCount = chunks[i].globalOffset > 0 ? CHUNK_OVERLAP : 0;
        allLabels.push(...labels.slice(overlapCount));
      }

      result = {
        needs_correction: true,
        confidence: 0.8,
        analysis: `Batched analysis: ${chunks.length} chunks processed for ${utterances.length} utterances.`,
        labels: allLabels as any,
        speaker_mapping: {}
      };
    }

    // Normalize labels length
    if (allLabels.length < utterances.length) {
      const lastLabel = allLabels[allLabels.length - 1] || 'Agent';
      while (allLabels.length < utterances.length) {
        allLabels.push(lastLabel === 'Agent' ? 'Customer' : 'Agent');
      }
    } else if (allLabels.length > utterances.length) {
      allLabels = allLabels.slice(0, utterances.length);
    }

    // Build corrected utterances
    const correctedUtterances: CorrectedUtterance[] = utterances.map((u, i) => ({
      speaker: normalizeFinalSpeaker(allLabels[i]),
      original_speaker: u.speaker,
      text: u.text,
      start: u.start,
      end: u.end,
    }));

    const speakerMapping =
      result!.speaker_mapping && Object.keys(result!.speaker_mapping).length > 0
        ? result!.speaker_mapping
        : buildSpeakerMapping(utterances, correctedUtterances);

    const formattedDialog = buildFormattedDialog(correctedUtterances);

    // Check if corrections are actually needed
    const needsCorrection = correctedUtterances.some(
      (u, i) => u.speaker !== utterances[i].speaker
    );

    console.log('📊 [RESULT]', correctedUtterances.length, 'utterances,', needsCorrection ? 'corrections needed' : 'no corrections');

    return new Response(
      JSON.stringify({
        success: true,
        needs_correction: result!.needs_correction ?? needsCorrection,
        confidence: typeof result!.confidence === 'number' ? result!.confidence : 0,
        analysis: typeof result!.analysis === 'string' ? result!.analysis : 'N/A',
        corrected_utterances: correctedUtterances,
        formatted_dialog: formattedDialog,
        speaker_mapping: speakerMapping,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ [ERROR]', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
