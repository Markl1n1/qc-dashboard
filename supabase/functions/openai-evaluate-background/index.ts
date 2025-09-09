import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("🚀 Background AI evaluation function started");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!openAIApiKey) {
      throw new Error("AI API key not configured");
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { dialogId, utterances, modelId = "gpt-5-mini" } = await req.json();

    if (!dialogId || !utterances) {
      throw new Error("Missing required parameters: dialogId and utterances");
    }

    const requestId =
      (crypto as any)?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

    console.log(
      `📝 [${requestId}] Starting analysis for dialog ${dialogId} with ${utterances.length} utterances using model ${modelId}`,
    );

    // Get AI instructions from storage
    let systemPrompt = "You are an AI assistant that evaluates conversation quality.";
    try {
      const { data: files } = await supabase.storage.from("ai-instructions").list();
      if (files && files.length > 0) {
        // Get the latest .txt file
        const txtFiles = files.filter((f) => f.name.endsWith(".txt"));
        if (txtFiles.length > 0) {
          const latestFile = txtFiles.sort(
            (a, b) =>
              new Date(b.updated_at || (b as any).created_at).getTime() -
              new Date(a.updated_at || (a as any).created_at).getTime(),
          )[0];
          const { data: fileData } = await supabase.storage
            .from("ai-instructions")
            .download(latestFile.name);
          if (fileData) {
            systemPrompt = await fileData.text();
            console.log("📋 Loaded custom AI instructions from storage");
          }
        }
      }
    } catch (error: any) {
      console.warn(
        "⚠️ Could not load AI instructions from storage, using default prompt:",
        error?.message || error,
      );
    }

    // Prepare conversation text
    const conversationText = utterances
      .map((utterance: { speaker: string; text: string }) =>
        `${utterance.speaker}: ${utterance.text}`
      )
      .join("\n\n");

    // Build prompts & payload
    const userPrompt =
      `Please analyze this conversation and provide a JSON response with the exact format specified in the instructions:\n\n${conversationText}`;

    const requestPayload = {
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 8000,
      response_format: { type: "json_object" },
    };

    // Safe snapshot for logging (truncate too-long content)
    const MAX_LOG_CHARS = 5000;
    const truncate = (s: string) =>
      s.length > MAX_LOG_CHARS ? s.slice(0, MAX_LOG_CHARS) + "…[truncated]" : s;

    const payloadSnapshot = {
      requestId,
      model: requestPayload.model,
      messages: [
        { role: "system", content: truncate(systemPrompt) },
        { role: "user", content: truncate(userPrompt) },
      ],
      max_completion_tokens: requestPayload.max_completion_tokens,
      response_format: requestPayload.response_format,
    };

    // 🔎 LOG FULL PROMPT SNAPSHOT (без ключей/заголовков)
    console.log(
      "➡️ OpenAI request (payload snapshot):",
      JSON.stringify(payloadSnapshot, null, 2),
    );

    // (опционально) сохраняем снапшот промпта в БД (если колонка есть)
    try {
      await supabase.from("dialog_analysis").insert({
        dialog_id: dialogId,
        analysis_type: "openai_request_snapshot",
        summary: "Prompt snapshot before OpenAI call",
        prompt_snapshot: payloadSnapshot, // JSONB колонка (создайте при необходимости)
        processing_time: Date.now(),
      });
    } catch (e: any) {
      console.warn("⚠️ Failed to save prompt snapshot:", e?.message || e);
    }

    console.log("🤖 Calling AI API...");
    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.text();
      console.error("❌ AI API error:", errorData);
      throw new Error(`AI API error: ${openAIResponse.status} - ${errorData}`);
    }

    const openAIData = await openAIResponse.json();
    console.log("✅ AI API response received");
    console.log("🔍 Full AI response:", JSON.stringify(openAIData, null, 2));

    // Check if response is valid
    if (!openAIData.choices?.[0]?.message) {
      console.error(
        "❌ Invalid AI response structure - no message:",
        JSON.stringify(openAIData, null, 2),
      );
      throw new Error(`Invalid AI response format: ${JSON.stringify(openAIData)}`);
    }

    const messageContent = openAIData.choices[0].message.content;
    const finishReason = openAIData.choices[0].finish_reason;

    // Handle empty content due to token limits
    if (!messageContent || messageContent.trim() === "") {
      if (finishReason === "length") {
        console.error(
          "❌ AI response truncated due to token limit. Completion tokens:",
          openAIData.usage?.completion_tokens,
        );
        throw new Error(
          "AI response was truncated due to token limit. Try reducing conversation length or increasing max_completion_tokens.",
        );
      } else {
        console.error("❌ AI returned empty content:", JSON.stringify(openAIData, null, 2));
        throw new Error(`AI returned empty content with finish_reason: ${finishReason}`);
      }
    }

    // Parse the JSON response
    let analysisResult: any;
    try {
      analysisResult = JSON.parse(messageContent);
      console.log("📊 Analysis result parsed successfully");
    } catch (parseError) {
      console.error("❌ Failed to parse AI JSON response:", parseError);
      console.error("❌ Raw content:", messageContent);
      throw new Error("Failed to parse AI response as JSON");
    }

    // Extract speaker information if present
    const speakers = analysisResult.speakers || [];
    const speaker_0 = speakers.length > 0 ? speakers[0]?.speaker_0 ?? null : null;
    const role_0 = speakers.length > 0 ? speakers[0]?.role_0 ?? null : null;
    const speaker_1 =
      speakers.length > 1 ? speakers[1]?.speaker_1 ?? speakers[0]?.speaker_1 ?? null : null;
    const role_1 =
      speakers.length > 1 ? speakers[1]?.role_1 ?? speakers[0]?.role_1 ?? null : null;

    console.log("👥 Speaker data extracted:", { speaker_0, role_0, speaker_1, role_1 });

    // Store analysis in database
    const { data: analysisData, error: insertError } = await supabase
      .from("dialog_analysis")
      .insert({
        dialog_id: dialogId,
        analysis_type: "openai_background",
        overall_score: analysisResult.score,
        mistakes: analysisResult.mistakes || [],
        summary: analysisResult.summary || "Analysis completed",
        confidence: 0.95,
        token_usage: {
          prompt_tokens: openAIData.usage?.prompt_tokens || 0,
          completion_tokens: openAIData.usage?.completion_tokens || 0,
          total_tokens: openAIData.usage?.total_tokens || 0,
          cost: (openAIData.usage?.total_tokens || 0) * 0.000001,
        },
        processing_time: Date.now(),
        speaker_0,
        role_0,
        speaker_1,
        role_1,
        comment_original: analysisResult.summary || null,
        comment_russian: null,
        request_id: requestId, // добавьте колонку при необходимости
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ Database insert error:", insertError);
      throw insertError;
    }

    // Update dialog with results
    const { error: updateError } = await supabase
      .from("dialogs")
      .update({
        quality_score: analysisResult.score,
        status: "completed",
        request_id: requestId, // добавьте колонку при необходимости
      })
      .eq("id", dialogId);

    if (updateError) {
      console.error("❌ Dialog update error:", updateError);
      throw updateError;
    }

    console.log("✅ AI analysis completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        analysis: analysisData,
        speakers: { speaker_0, role_0, speaker_1, role_1 },
        requestId,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: any) {
    console.error("❌ AI analysis failed:", error);
    return new Response(
      JSON.stringify({
        error: error?.message || String(error),
        success: false,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
