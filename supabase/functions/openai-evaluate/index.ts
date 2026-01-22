import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client for auth verification
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify JWT authentication
    const { user, error: authError } = await verifyAuth(req, supabase);
    if (authError) {
      return authError;
    }

    console.log('Security Event: OpenAI evaluate authorized for user:', user.id);

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      console.error('AI API key not found in Supabase secrets');
      return new Response(
        JSON.stringify({ error: 'AI API key not configured' }),
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

    // Determine model type for parameter selection
    const isGPT5OrNewer = model.includes('gpt-5') || model.includes('gpt-4.1') || model.includes('o3') || model.includes('o4');
    const isReasoningModel = model.includes('o3') || model.includes('o4');

    // For GPT-5 and newer models, use max_completion_tokens
    if (isGPT5OrNewer) {
      requestBody.max_completion_tokens = max_output_tokens;
      if (reasoning_effort && isReasoningModel) {
        requestBody.reasoning_effort = reasoning_effort;
      }
      // Note: temperature is not supported for GPT-5 and newer models
    } else {
      // For legacy models (gpt-4o family), use max_tokens and temperature
      requestBody.max_tokens = max_output_tokens;
      if (temperature !== undefined) {
        requestBody.temperature = temperature;
      }
    }

    // Log token limits and model configuration
    console.log('🎛️ Model configuration:', {
      model,
      isGPT5OrNewer,
      isReasoningModel,
      tokenLimit: max_output_tokens,
      hasReasoningEffort: !!reasoning_effort,
      temperature: temperature
    });

    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📥 AI response status:', openAIResponse.status);
    console.log('📥 AI response headers:', Object.fromEntries(openAIResponse.headers.entries()));

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('❌ AI API error:', {
        status: openAIResponse.status,
        statusText: openAIResponse.statusText,
        errorText,
        model,
        tokenLimit: max_output_tokens
      });
      return new Response(
        JSON.stringify({ 
          error: `AI API error: ${openAIResponse.status} - ${errorText}` 
        }),
        { 
          status: openAIResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await openAIResponse.json();
    console.log('✅ AI response successful');
    
    // Enhanced response analysis
    const choice = data.choices?.[0];
    const finishReason = choice?.finish_reason;
    const content = choice?.message?.content;
    
    console.log('📊 Token usage:', {
      actualInputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
      reasoningTokens: data.usage?.completion_tokens_details?.reasoning_tokens
    });
    
    console.log('🏁 Response details:', {
      finishReason,
      contentLength: content?.length || 0,
      hasContent: !!content,
      model: data.model
    });
    
    // Enhanced logging for debugging parsing issues
    console.log('📝 RAW CONTENT START 📝');
    console.log(content);
    console.log('📝 RAW CONTENT END 📝');
    
    console.log('📝 Response content preview:', content?.substring(0, 200) + '...');

    // Try to parse the JSON to see if it's valid
    try {
      const parsedContent = JSON.parse(content);
      console.log('✅ Content is valid JSON');
      console.log('🔍 Parsed structure:', parsedContent);
      console.log('📊 Mistakes count:', parsedContent.mistakes?.length || 0);
      console.log('👥 Speakers data:', parsedContent.speakers);
    } catch (parseError) {
      console.error('❌ Content is NOT valid JSON:', parseError);
      console.log('🔧 Content that failed to parse:', content);
    }
    
    // Warn about truncated responses
    if (finishReason === 'length') {
      console.warn('⚠️ RESPONSE TRUNCATED - Consider increasing token limit');
      console.warn('🔧 Suggested fixes:', {
        increaseTokens: 'Use higher max_completion_tokens',
        upgradeModel: 'Consider using a more capable model',
        optimizePrompt: 'Reduce prompt length'
      });
    }
    
    console.log('🔍 Full response structure:', JSON.stringify(data, null, 2));
    
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

    console.log('✅ AI response successful, tokens used:', tokenEstimation);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in evaluate function:', error);
    console.error('❌ Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
