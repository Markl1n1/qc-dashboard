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
  corrected_utterances: CorrectedUtterance[];
  formatted_dialog: string;
  speaker_mapping: Record<string, string>;
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
  "corrected_utterances": [
    {
      "speaker": "Agent" or "Customer",
      "original_speaker": "Speaker X",
      "text": "original text unchanged",
      "start": original_start_time,
      "end": original_end_time
    }
  ],
  "formatted_dialog": "Agent:\\n- text\\n\\nCustomer:\\n- text\\n...",
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
- If conversation looks correct, still provide the formatted output with proper labels
- Be conservative: only mark needs_correction=true when confident there are errors`;

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
    const utterancesForAnalysis = utterances.map(u => ({
      speaker: u.speaker,
      text: u.text,
      start: u.start,
      end: u.end
    }));

    console.log('🤖 [GPT] Sending to OpenAI for analysis...');
    const gptStart = Date.now();

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyze and fix diarization for this transcript:\n\n${JSON.stringify(utterancesForAnalysis, null, 2)}` }
        ],
        temperature: 0.3,
        max_tokens: 16000,
        response_format: { type: 'json_object' }
      })
    });

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
    console.log('📊 [RESULT] Corrected utterances:', result.corrected_utterances?.length || 0);
    console.log('📊 [RESULT] Speaker mapping:', result.speaker_mapping);

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
        ...result
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
