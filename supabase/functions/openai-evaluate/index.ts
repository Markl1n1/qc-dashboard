
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get OpenAI API key from Supabase secrets (not hardcoded)
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      console.error('OpenAI API key not found in Supabase secrets');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { model, messages, max_output_tokens, temperature, reasoning_effort } = await req.json();

    // Build request body based on model type
    const requestBody: any = {
      model,
      messages,
    };

    // For GPT-5 models, use max_completion_tokens and reasoning_effort
    if (model.includes('gpt-5')) {
      requestBody.max_completion_tokens = max_output_tokens;
      if (reasoning_effort) {
        requestBody.reasoning_effort = reasoning_effort;
      }
      // Note: temperature is not supported for GPT-5 models
    } else {
      // For legacy models (gpt-4o family), use max_tokens and temperature
      requestBody.max_tokens = max_output_tokens;
      if (temperature !== undefined) {
        requestBody.temperature = temperature;
      }
    }

    console.log('Making OpenAI request with model:', model);
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `OpenAI API error: ${response.status} - ${errorText}` 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    
    // Calculate token estimation for cost tracking
    const usage = data.usage || {};
    const tokenEstimation = {
      actualInputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0
    };

    // Add token estimation to response
    const responseData = {
      ...data,
      tokenEstimation
    };

    console.log('OpenAI response successful, tokens used:', tokenEstimation);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in openai-evaluate function:', error);
    return new Response(
      JSON.stringify({ error: `Server error: ${error.message}` }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
