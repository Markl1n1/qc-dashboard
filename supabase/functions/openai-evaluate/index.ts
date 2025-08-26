
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

    const requestBody = await req.json();
    const { model, messages, max_output_tokens, temperature, reasoning_effort } = requestBody;

    // Extract text from messages for token estimation
    const allText = messages.map((m: any) => m.content).join('\n');
    const inputTokens = estimateTokens(allText);
    
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

    const openAIRequestBody: any = {
      model: model || 'gpt-5-mini-2025-08-07',
      messages: messages
    };

    // Handle different model parameter requirements
    if (model && (model.includes('gpt-5') || model.includes('gpt-4.1'))) {
      // Newer models use max_completion_tokens
      openAIRequestBody.max_completion_tokens = max_output_tokens || 1000;
      
      // Add reasoning effort for supported models
      if (reasoning_effort && (model.includes('o3') || model.includes('o4'))) {
        openAIRequestBody.reasoning_effort = reasoning_effort;
      }
      
      // Only add temperature for models that support it (not o3/o4 reasoning models)
      if (temperature !== undefined && !model.includes('o3') && !model.includes('o4')) {
        openAIRequestBody.temperature = temperature;
      }
    } else {
      // Legacy models use max_tokens and support temperature
      openAIRequestBody.max_tokens = max_output_tokens || 1000;
      if (temperature !== undefined) {
        openAIRequestBody.temperature = temperature;
      }
    }

    // Add reasoning effort for o3/o4 models
    if (model && (model.includes('o3') || model.includes('o4')) && reasoning_effort) {
      openAIRequestBody.reasoning_effort = reasoning_effort;
    }

    console.log('Making OpenAI request with model:', model);
    console.log('Parameters:', {
      estimated_input_tokens: inputTokens,
      max_output_tokens,
      temperature: openAIRequestBody.temperature,
      reasoning_effort: openAIRequestBody.reasoning_effort
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify(openAIRequestBody)
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
