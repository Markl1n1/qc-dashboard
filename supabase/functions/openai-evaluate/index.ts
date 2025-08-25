
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple token estimation function
function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get user from token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { utterances, modelId } = await req.json();

    // Create conversation text and estimate tokens
    const conversationText = utterances
      .map((u: any) => `${u.speaker}: ${u.text}`)
      .join('\n');

    const systemPrompt = 'You are an expert call center quality analyst. Always respond with valid JSON only.';
    
    // Estimate tokens for input and system prompt
    const inputTokens = estimateTokens(conversationText) + estimateTokens(systemPrompt);
    
    // Check if token count is reasonable (under 100k tokens)
    if (inputTokens > 100000) {
      return new Response(JSON.stringify({ 
        error: 'Text too long for analysis',
        estimatedTokens: inputTokens,
        maxTokens: 100000
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `You are an expert call center quality analyst. Analyze this customer service conversation and provide a detailed evaluation.

CONVERSATION:
${conversationText}

Please analyze the conversation and respond with a JSON object containing:

{
  "overallScore": number (0-100),
  "categoryScores": {
    "communication": number (0-100),
    "professionalism": number (0-100),
    "problem_solving": number (0-100),
    "compliance": number (0-100),
    "customer_satisfaction": number (0-100)
  },
  "mistakes": [
    {
      "id": "unique_id",
      "level": "minor|major|critical",
      "category": "communication|professionalism|problem_solving|compliance|other",
      "mistakeName": "Brief mistake name",
      "description": "Detailed description of the mistake",
      "text": "Exact text from conversation",
      "position": utterance_index,
      "speaker": "Agent|Customer", 
      "suggestion": "How to improve",
      "impact": "low|medium|high",
      "confidence": number (0-100)
    }
  ],
  "recommendations": ["list", "of", "improvement", "suggestions"],
  "summary": "Overall summary of the conversation quality",
  "confidence": number (0-100)
}

Focus on:
- Agent communication skills and tone
- Problem resolution effectiveness  
- Compliance with policies
- Customer satisfaction indicators
- Professional behavior

Provide specific, actionable feedback. Only return valid JSON.`;

    const requestBody: any = {
      model: modelId,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    // Handle different model parameter requirements
    if (modelId.includes('gpt-5') || modelId.includes('gpt-4.1') || modelId.includes('o3') || modelId.includes('o4')) {
      // Newer models use max_completion_tokens and don't support temperature
      requestBody.max_completion_tokens = 2000;
    } else {
      // Legacy models use max_tokens and support temperature
      requestBody.max_tokens = 2000;
      requestBody.temperature = 0.1;
    }

    console.log('Making OpenAI request with model:', modelId);
    console.log('Estimated input tokens:', inputTokens);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    // Calculate actual token usage
    const actualInputTokens = data.usage?.prompt_tokens || inputTokens;
    const outputTokens = data.usage?.completion_tokens || 0;
    const totalTokens = actualInputTokens + outputTokens;

    console.log('Token usage - Input:', actualInputTokens, 'Output:', outputTokens, 'Total:', totalTokens);

    return new Response(JSON.stringify({
      ...data,
      tokenEstimation: {
        estimatedInputTokens: inputTokens,
        actualInputTokens,
        outputTokens,
        totalTokens
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in openai-evaluate function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
