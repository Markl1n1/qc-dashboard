import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Background OpenAI evaluation function started');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dialogId, utterances, modelId = 'gpt-5-mini-2025-08-07' } = await req.json();
    
    if (!dialogId || !utterances) {
      throw new Error('Missing required parameters: dialogId and utterances');
    }

    console.log(`📝 Starting analysis for dialog ${dialogId} with ${utterances.length} utterances using model ${modelId}`);

    // Get AI instructions from storage
    let systemPrompt = 'You are an AI assistant that evaluates conversation quality.';
    
    try {
      const { data: files } = await supabase.storage.from('ai-instructions').list();
      if (files && files.length > 0) {
        // Get the latest .txt file
        const txtFiles = files.filter(f => f.name.endsWith('.txt'));
        if (txtFiles.length > 0) {
          const latestFile = txtFiles.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())[0];
          const { data: fileData } = await supabase.storage.from('ai-instructions').download(latestFile.name);
          if (fileData) {
            systemPrompt = await fileData.text();
            console.log('📋 Loaded custom AI instructions from storage');
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not load AI instructions from storage, using default prompt:', error.message);
    }

    // Prepare conversation text
    const conversationText = utterances.map((utterance: any) => 
      `${utterance.speaker}: ${utterance.text}`
    ).join('\n\n');

    console.log('🤖 Calling OpenAI API...');

    // Call OpenAI API
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please analyze this conversation and provide a JSON response with the exact format specified in the instructions:\n\n${conversationText}` }
        ],
        max_completion_tokens: 4000,
        response_format: { type: "json_object" }
      }),
    });

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.text();
      console.error('❌ OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${openAIResponse.status} - ${errorData}`);
    }

    const openAIData = await openAIResponse.json();
    console.log('✅ OpenAI API response received');

    if (!openAIData.choices?.[0]?.message?.content) {
      throw new Error('Invalid OpenAI response format');
    }

    // Parse the JSON response
    let analysisResult;
    try {
      analysisResult = JSON.parse(openAIData.choices[0].message.content);
      console.log('📊 Analysis result parsed successfully');
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI JSON response:', parseError);
      throw new Error('Failed to parse OpenAI response as JSON');
    }

    // Extract speaker information if present
    const speakers = analysisResult.speakers || [];
    const speaker_0 = speakers.length > 0 ? speakers[0]?.speaker_0 || null : null;
    const role_0 = speakers.length > 0 ? speakers[0]?.role_0 || null : null;
    const speaker_1 = speakers.length > 1 ? speakers[1]?.speaker_1 || speakers[0]?.speaker_1 || null : null;
    const role_1 = speakers.length > 1 ? speakers[1]?.role_1 || speakers[0]?.role_1 || null : null;

    console.log('👥 Speaker data extracted:', { speaker_0, role_0, speaker_1, role_1 });

    // Store analysis in database
    const { data: analysisData, error: insertError } = await supabase
      .from('dialog_analysis')
      .insert({
        dialog_id: dialogId,
        analysis_type: 'openai_background',
        overall_score: analysisResult.score,
        mistakes: analysisResult.mistakes || [],
        summary: analysisResult.summary || 'Analysis completed',
        confidence: 0.95,
        token_usage: {
          prompt_tokens: openAIData.usage?.prompt_tokens || 0,
          completion_tokens: openAIData.usage?.completion_tokens || 0,
          total_tokens: openAIData.usage?.total_tokens || 0,
          cost: (openAIData.usage?.total_tokens || 0) * 0.000001
        },
        processing_time: Date.now(),
        speaker_0,
        role_0,
        speaker_1,
        role_1,
        comment_original: analysisResult.summary || null,
        comment_russian: null
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      throw insertError;
    }

    // Update dialog with results
    const { error: updateError } = await supabase
      .from('dialogs')
      .update({
        quality_score: analysisResult.score,
        status: 'completed'
      })
      .eq('id', dialogId);

    if (updateError) {
      console.error('❌ Dialog update error:', updateError);
      throw updateError;
    }

    console.log('✅ Background analysis completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        analysis: analysisData,
        speakers: { speaker_0, role_0, speaker_1, role_1 }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Background analysis failed:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});