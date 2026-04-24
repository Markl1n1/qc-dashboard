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

const SYSTEM_PROMPT = `Ты — эксперт по диаризации речи для звонков колл-центра / отдела продаж.
В разговоре участвуют РОВНО ДВА человека: Agent (сотрудник компании) и Customer (клиент).
Твоя задача: для КАЖДОЙ реплики определить, кто её произнёс — Agent или Customer.
Опирайся на СМЫСЛ реплики, а не только на исходную метку speaker (она часто ошибочна).

═══════════════════════════════════════════════
КАК ОТЛИЧИТЬ AGENT ОТ CUSTOMER (применяй ВСЕ признаки):

🟦 AGENT (продавец / оператор / консультант):
- Здоровается ПЕРВЫМ, обращается к клиенту по имени ("Алло, Виктор, здравствуйте")
- Задаёт ПРОДАЮЩИЕ / КВАЛИФИЦИРУЮЩИЕ вопросы:
  • "Когда начнёте инвестировать с нами?", "Почему?", "А почему вы так уверены?"
  • "Какой у вас альтернативный источник заработка?", "Чем вы занимаетесь помимо работы?"
  • "Для чего вы изначально приходили к нам?", "В чём цель была?"
- Работает с возражениями, убеждает, давит:
  • "В любом случае будете, это неизбежно"
  • "Я сомневаюсь, что вас устраивает уровень дохода"
  • "Любой нормальный мужчина, если чего-то добился, без проблем поделится"
  • "Вы будете думать, то есть уже не так категоричны"
- Использует "мы", "у нас", "наша компания", "наш сайт", "наша заявка"
- Говорит профессионально, длинными структурированными фразами
- Резюмирует, подводит итог, возвращает разговор к теме продукта

🟥 CUSTOMER (клиент / абонент):
- Отвечает на вопросы, часто коротко: "Работаю", "Никогда", "Нормально, хватает"
- СОПРОТИВЛЯЕТСЯ продаже: "я не буду", "я уже сказал", "я не хочу зарабатывать"
- Перебивает, говорит эмоционально / грубо:
  • "А почему вы меня заставляете?"
  • "Я не спрашиваю, какого цвета у вас трусы"
  • "Я не буду рассказывать, чем я занимаюсь"
- Жалуется на жизнь, ссылается на личные обстоятельства, знакомых, "коллегу"
- Использует "я", "мне", "у меня", "моя квартира", "моя работа"
- Часто говорит обрывисто, с паузами, переспрашивает: "Алло?", "Что?"

═══════════════════════════════════════════════
КЛЮЧЕВЫЕ ПРИНЦИПЫ:

1. ПЕРВАЯ реплика (приветствие по имени) — почти ВСЕГДА Agent.
2. Реплика-ВОПРОС о продукте/услуге/мотивации клиента → Agent.
3. Реплика-ОТКАЗ или короткий ответ → Customer.
4. ДЛИННАЯ убеждающая речь с "мы", "наша компания" → Agent.
5. НЕ "залипай" на одной метке: в живом диалоге роли ЧЕРЕДУЮТСЯ.
   Если подряд идёт >5 реплик одной роли — пересмотри их СМЫСЛ.
6. Низкий confidence у Deepgram (<0.5) и короткая реплика ("Алло", "Я", "Бога") —
   часто это вкрапление ДРУГОГО спикера в речь основного. Решай по контексту соседей.
7. Если реплика логически продолжает мысль предыдущей реплики того же спикера —
   сохраняй ту же метку. Если меняется тема/тон/направление — скорее всего смена.
8. Игнорируй исходный speaker от Deepgram, если он противоречит смыслу.

═══════════════════════════════════════════════
INPUT: список реплик {index, speaker, text} по порядку.
OUTPUT: ТОЛЬКО валидный JSON (без markdown, без комментариев) со СТРОГО такими ключами:
{
  "needs_correction": boolean,
  "confidence": number,         // 0..1, твоя уверенность в разметке
  "analysis": string,           // ≤ 180 символов, без переносов строк
  "labels": ["Agent"|"Customer", ...],   // ровно N элементов
  "speaker_mapping": { "<original>": "Agent"|"Customer" }  // как чаще всего маппится исходная метка
}

СТРОГО:
- labels.length === N (N передан в user prompt).
- Каждое значение labels — РОВНО строка "Agent" или "Customer", без других вариантов.
- Никаких лишних ключей, никакого текста вне JSON.
- Решай ПО КАЖДОЙ реплике отдельно, не копируй слепо исходного speaker.`;

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

/**
 * Deterministic fallback: when GPT is unavailable, derive Agent/Customer labels
 * from raw speaker IDs. Heuristic: the speaker who utters the FIRST line in a
 * customer-service call is typically the Agent (greeting). All utterances by
 * that raw speaker map to Agent; everything else maps to Customer.
 */
function deterministicFallbackLabels(utterances: SpeakerUtterance[]): string[] {
  if (!utterances.length) return [];
  const firstSpeaker = utterances[0].speaker;
  return utterances.map(u => (u.speaker === firstSpeaker ? 'Agent' : 'Customer'));
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
  const userPrompt = `N = ${N}. Верни ТОЛЬКО JSON с ключами labels и speaker_mapping.

ПРАВИЛА:
- labels.length РОВНО ${N}
- значения labels — только "Agent" или "Customer"
- НЕ копируй слепо исходного speaker — определяй роль ПО СМЫСЛУ реплики
- помни: реплики-вопросы о продукте/мотивации = Agent; короткие отказы = Customer
- роли в живом диалоге чередуются, не "залипай" на одной метке надолго

Реплики:
${JSON.stringify(chunk.utterances)}`;

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
      max_tokens: 2000,
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

    // Helper: build a successful fallback response using deterministic labels
    const respondWithFallback = (reason: string) => {
      console.warn('⚠️ [FALLBACK]', reason);
      const fallbackLabels = deterministicFallbackLabels(utterances);
      const correctedUtterances: CorrectedUtterance[] = utterances.map((u, i) => ({
        speaker: normalizeFinalSpeaker(fallbackLabels[i]),
        original_speaker: u.speaker,
        text: u.text,
        start: u.start,
        end: u.end,
      }));
      const speakerMapping = buildSpeakerMapping(utterances, correctedUtterances);
      const formattedDialog = buildFormattedDialog(correctedUtterances);
      const needsCorrection = correctedUtterances.some(
        (u, i) => u.speaker !== utterances[i].speaker
      );
      return new Response(
        JSON.stringify({
          success: true,
          fallback: true,
          fallback_reason: reason,
          needs_correction: needsCorrection,
          confidence: 0.5,
          analysis: `Deterministic fallback applied (${reason}).`,
          corrected_utterances: correctedUtterances,
          formatted_dialog: formattedDialog,
          speaker_mapping: speakerMapping,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    };

    if (!OPENAI_API_KEY) {
      return respondWithFallback('OpenAI API key not configured');
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
        const reason = e instanceof Error && e.name === 'AbortError' ? 'GPT request timed out' : 'GPT request failed';
        return respondWithFallback(reason);
      }
      clearTimeout(timeoutId);

      console.log('✅ [GPT] Response in', ((Date.now() - gptStart) / 1000).toFixed(2), 's');

      if (!response.ok) {
        await response.text().catch(() => '');
        return respondWithFallback(`OpenAI API error ${response.status}`);
      }

      const openaiResult = await response.json();
      const content = openaiResult.choices?.[0]?.message?.content;
      if (!content) {
        return respondWithFallback('No response from GPT');
      }

      result = tryParseJson(content);
      if (!result) {
        return respondWithFallback('GPT returned invalid JSON');
      }

      // Extract labels
      if (Array.isArray(result.labels)) {
        allLabels = result.labels.map(l => String(l));
      } else {
        return respondWithFallback('GPT response missing labels');
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

      // If any chunk failed, fall back deterministically for the whole dialog
      if (chunkResults.some(r => !r)) {
        return respondWithFallback('One or more chunks failed during batched analysis');
      }

      // Merge labels from chunks, removing overlap context
      allLabels = [];
      for (let i = 0; i < chunks.length; i++) {
        const labels = chunkResults[i]!;
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
