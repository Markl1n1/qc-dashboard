import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

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
  console.log('🚀 Background AI evaluation function started');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey) {
      throw new Error('AI API key not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT authentication
    const { user, error: authError } = await verifyAuth(req, supabase);
    if (authError) {
      return authError;
    }

    console.log('Security Event: Background AI evaluation authorized for user:', user.id);

    const { dialogId, utterances, modelId = 'gpt-5-mini' } = await req.json();
    
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

    console.log('🤖 Calling AI API...');
    console.log('📝 System prompt length:', systemPrompt.length, 'characters');
    console.log('🔍 Debug - AI Instructions content length:', systemPrompt.length);
    console.log('🔍 Debug - First 500 chars of prompt:', systemPrompt.substring(0, 500));
    console.log('🔍 Debug - Last 200 chars of prompt:', systemPrompt.substring(Math.max(0, systemPrompt.length - 200)));
    console.log('💬 Conversation text length:', conversationText.length, 'characters');
    console.log('🎯 Using model:', modelId);

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
        max_completion_tokens: 8000, // Increased from 4000 to handle longer responses
        response_format: { type: "json_object" }
      }),
    });

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.text();
      console.error('❌ AI API error:', errorData);
      throw new Error(`AI API error: ${openAIResponse.status} - ${errorData}`);
    }

    const openAIData = await openAIResponse.json();
    console.log('✅ AI API response received');
    console.log('🔍 Full AI response:', JSON.stringify(openAIData, null, 2));

    // Check if response is valid
    if (!openAIData.choices?.[0]?.message) {
      console.error('❌ Invalid AI response structure - no message:', JSON.stringify(openAIData, null, 2));
      throw new Error(`Invalid AI response format: ${JSON.stringify(openAIData)}`);
    }

    const messageContent = openAIData.choices[0].message.content;
    const finishReason = openAIData.choices[0].finish_reason;

    // Handle empty content due to token limits
    if (!messageContent || messageContent.trim() === '') {
      if (finishReason === 'length') {
        console.error('❌ AI response truncated due to token limit. Completion tokens:', openAIData.usage?.completion_tokens);
        throw new Error('AI response was truncated due to token limit. Try reducing conversation length or increasing max_completion_tokens.');
      } else {
        console.error('❌ AI returned empty content:', JSON.stringify(openAIData, null, 2));
        throw new Error(`AI returned empty content with finish_reason: ${finishReason}`);
      }
    }

    // Parse the JSON response
    let analysisResult;
    try {
      analysisResult = JSON.parse(messageContent);
      console.log('📊 Analysis result parsed successfully');
    } catch (parseError) {
      console.error('❌ Failed to parse AI JSON response:', parseError);
      console.error('❌ Raw content:', messageContent);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Extract speaker information with robust handling
    let speakers: any = {};
    if (analysisResult?.speakers) {
      if (Array.isArray(analysisResult.speakers) && analysisResult.speakers.length > 0) {
        speakers = analysisResult.speakers[0] || {};
      } else if (typeof analysisResult.speakers === 'object') {
        speakers = analysisResult.speakers;
      }
    }
    
    const speaker_0 = speakers.speaker_0 || null;
    const role_0 = speakers.role_0 || null;
    const speaker_1 = speakers.speaker_1 || null;
    const role_1 = speakers.role_1 || null;

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

    // -------------------------------
    // NEW: update dialog_speaker_utterances
    // -------------------------------
    // This will update utterances where speaker exactly equals 'Speaker 0' / 'Speaker 1'
    // to the detected speaker names from analysis (speaker_0 / speaker_1).
    // We do this in two steps:
    // 1) fetch transcription ids for the dialog
    // 2) run update queries scoped to those transcription_ids
    try {
      // fetch transcription ids for the dialog
      const { data: trans, error: tErr } = await supabase
        .from('dialog_transcriptions')
        .select('id')
        .eq('dialog_id', dialogId);

      if (tErr) {
        console.warn('⚠️ Could not fetch dialog_transcriptions for updating utterances:', tErr.message || tErr);
      } else {
        const ids = (trans || []).map((r: any) => r.id).filter(Boolean);
        if (ids.length === 0) {
          console.log('ℹ️ No transcriptions found for dialog, skipping utterance updates.');
        } else {
          // Helper to perform an update for a speaker label
          async function updateSpeakerLabel(originalLabel: string, newName: string | null) {
            if (!newName) {
              console.log(`ℹ️ No new name for ${originalLabel}, skipping update.`);
              return;
            }
            // Optional normalization: if your stored utterances use "Speaker 0:" with colon
            // you might want to adjust the condition to match patterns. Here we match exact text.
            const { error: uErr } = await supabase
              .from('dialog_speaker_utterances')
              .update({ speaker: newName })
              .in('transcription_id', ids)
              .eq('speaker', originalLabel);

            if (uErr) {
              console.warn(`⚠️ Failed to update utterances for ${originalLabel}:`, uErr.message || uErr);
            } else {
              console.log(`✅ Updated utterances where speaker='${originalLabel}' -> '${newName}'`);
            }
          }

          await updateSpeakerLabel('Speaker 0', speaker_0);
          await updateSpeakerLabel('Speaker 1', speaker_1);
        }
      }
    } catch (utterErr) {
      // make this non-fatal: log but continue
      console.warn('⚠️ Error while updating dialog_speaker_utterances:', utterErr?.message || utterErr);
    }

    console.log('✅ AI analysis completed successfully');

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
    console.error('❌ AI analysis failed:', error);
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
