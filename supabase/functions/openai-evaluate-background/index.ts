import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dialogId, utterances, model = 'gpt-5-mini-2025-08-07' } = await req.json();

    if (!dialogId || !utterances) {
      return new Response(
        JSON.stringify({ error: 'Missing dialogId or utterances' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Start the background analysis task
    EdgeRuntime.waitUntil(runBackgroundAnalysis(dialogId, utterances, model, supabase, openAIApiKey));

    // Return immediate response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Analysis started in background',
        dialogId 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error starting background analysis:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function runBackgroundAnalysis(
  dialogId: string, 
  utterances: any[], 
  model: string, 
  supabase: any, 
  openAIApiKey: string
) {
  try {
    console.log(`Starting background analysis for dialog: ${dialogId}`);

    // Update dialog status to processing
    await supabase
      .from('dialogs')
      .update({ status: 'processing' })
      .eq('id', dialogId);

    // Build conversation context for OpenAI
    const conversationText = utterances
      .map(u => `${u.speaker}: ${u.text}`)
      .join('\n');

    const systemPrompt = `You are an expert conversation analyst. Analyze this customer service conversation and provide:
1. Overall quality score (0-100)
2. Category-specific scores for: professionalism, communication_clarity, problem_resolution, courtesy, compliance
3. Specific mistakes with categories: Banned, Mistake, Not Recommended, Good
4. Brief summary
5. Actionable recommendations
6. Confidence level (0-1)

Format your response as valid JSON matching this structure:
{
  "overallScore": number,
  "categoryScores": {
    "professionalism": number,
    "communication_clarity": number,
    "problem_resolution": number,
    "courtesy": number,
    "compliance": number
  },
  "mistakes": [
    {
      "category": "string",
      "comment": "string",
      "utterance": "string"
    }
  ],
  "summary": "string",
  "recommendations": ["string"],
  "confidence": number
}`;

    // Determine correct parameters based on model
    const isNewModel = model.startsWith('gpt-5') || model.startsWith('o3') || model.startsWith('o4');
    const requestBody: any = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: conversationText }
      ],
      response_format: { type: 'json_object' }
    };

    // Add appropriate token limit parameter
    if (isNewModel) {
      requestBody.max_completion_tokens = 4000;
    } else {
      requestBody.max_tokens = 4000;
      requestBody.temperature = 0.3;
    }

    console.log(`Calling OpenAI with model: ${model}`);
    const startTime = Date.now();

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
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const processingTime = Date.now() - startTime;

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('No content in OpenAI response');
    }

    const result = JSON.parse(data.choices[0].message.content);
    
    // Enhance result with metadata
    const enhancedResult = {
      ...result,
      modelUsed: model,
      processingTime,
      tokenUsage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
        cost: calculateCost(model, data.usage?.prompt_tokens || 0, data.usage?.completion_tokens || 0)
      }
    };

    console.log(`Analysis completed in ${processingTime}ms`);

    // Store analysis result
    const { error: analysisError } = await supabase
      .from('dialog_analysis')
      .insert({
        dialog_id: dialogId,
        analysis_type: 'openai',
        overall_score: enhancedResult.overallScore,
        category_scores: enhancedResult.categoryScores,
        mistakes: enhancedResult.mistakes,
        recommendations: enhancedResult.recommendations,
        summary: enhancedResult.summary,
        confidence: enhancedResult.confidence,
        token_usage: enhancedResult.tokenUsage,
        processing_time: enhancedResult.processingTime
      });

    if (analysisError) {
      console.error('Failed to store analysis:', analysisError);
    }

    // Update dialog with results
    await supabase
      .from('dialogs')
      .update({ 
        status: 'completed',
        openaiEvaluation: enhancedResult,
        qualityScore: enhancedResult.overallScore
      })
      .eq('id', dialogId);

    console.log(`Background analysis completed for dialog: ${dialogId}`);

  } catch (error) {
    console.error(`Background analysis failed for dialog ${dialogId}:`, error);
    
    // Update dialog status to failed
    await supabase
      .from('dialogs')
      .update({ 
        status: 'failed',
        error_message: error.message 
      })
      .eq('id', dialogId);
  }
}

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const costs: Record<string, { input: number; output: number }> = {
    'gpt-5-2025-08-07': { input: 0.002, output: 0.010 },
    'gpt-5-mini-2025-08-07': { input: 0.0002, output: 0.0010 },
    'gpt-5-nano-2025-08-07': { input: 0.0001, output: 0.0005 },
    'gpt-4.1-2025-04-14': { input: 0.0015, output: 0.006 },
    'o3-2025-04-16': { input: 0.002, output: 0.010 },
    'o4-mini-2025-04-16': { input: 0.0002, output: 0.0008 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4o': { input: 0.005, output: 0.015 }
  };

  const modelCost = costs[model] || costs['gpt-4o-mini'];
  return (promptTokens * modelCost.input + completionTokens * modelCost.output) / 1000;
}

// Handle shutdown gracefully
addEventListener('beforeunload', (ev) => {
  console.log('Background analysis function shutdown due to:', ev.detail?.reason);
});