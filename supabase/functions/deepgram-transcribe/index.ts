import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const VERSION = "deepgram-transcribe/2025-09-10-03";
const BUCKET = "audio-files"; // при необходимости поменяй

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Тот же интерфейс, что и у тебя
interface DeepgramRequest {
  audio?: string;        // base64 для маленьких файлов
  storageFile?: string;  // путь в Storage для больших
  mimeType: string;
  options: {
    model?: string;
    language?: string;
    detect_language?: boolean;
    diarize?: boolean;
    punctuate?: boolean;
    utterances?: boolean;
    smart_format?: boolean;
    profanity_filter?: boolean;
  };
}

type SystemConfigRow = { key: string; value: string };

serve(async (req) => {
  // CORS / preflight / health
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true, version: VERSION }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method Not Allowed", version: VERSION }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
  const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY");
  if (!DEEPGRAM_API_KEY) {
    return new Response(JSON.stringify({ success: false, error: "Missing DEEPGRAM_API_KEY", version: VERSION }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let raw = "";
  try { raw = await req.text(); } catch {}
  let payload: DeepgramRequest | null = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { /* ignore */ }

  if (!payload) {
    return new Response(JSON.stringify({ success: false, error: "Invalid or empty JSON", version: VERSION }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { audio, storageFile, mimeType, options } = payload;
  const isLargeFile = !!storageFile;

  console.log("🎙️ Deepgram request:", {
    mimeType,
    options,
    audioLength: audio?.length,
    storageFile,
    isLargeFile,
  });

  // --- Модель и язык из БД (как у тебя) ---
  let nova2List: string[] = ["pl", "ru"];
  let nova3List: string[] = ["es", "fr", "de", "en"];
  const keytermPrompts: Record<string, string> = {};

  try {
    const { data: modelConfig, error: mcErr } = await supabase
      .from("system_config")
      .select("key, value")
      .in("key", [
        "deepgram_nova2_languages",
        "deepgram_nova3_languages",
        "keyterm_prompt_en",
        "keyterm_prompt_ru",
        "keyterm_prompt_de",
        "keyterm_prompt_es",
        "keyterm_prompt_fr",
        "keyterm_prompt_pl",
      ]) as unknown as { data: SystemConfigRow[] | null; error: any };

    if (mcErr) console.error("⚠️ system_config fetch error:", mcErr);

    if (modelConfig) {
      const n2 = modelConfig.find((c) => c.key === "deepgram_nova2_languages")?.value;
      const n3 = modelConfig.find((c) => c.key === "deepgram_nova3_languages")?.value;
      try { if (n2) nova2List = JSON.parse(n2); } catch {}
      try { if (n3) nova3List = JSON.parse(n3); } catch {}

      modelConfig.forEach((c) => {
        if (c.key.startsWith("keyterm_prompt_") && typeof c.value === "string") {
          const lang = c.key.replace("keyterm_prompt_", "");
          keytermPrompts[lang] = c.value;
        }
      });
    }
  } catch (e) {
    console.error("⚠️ system_config exception:", e);
  }

  // --- Параметры запроса к Deepgram ---
  const params = new URLSearchParams();

  // Выбор модели (логика, как у тебя)
  let finalModel = "nova-2-general";
  let useKeyterms = false;

  if (options?.language) {
    params.append("language", options.language);

    if (nova3List.includes(options.language)) {
      finalModel = "nova-3-general";
      params.append("model", "nova-3-general");
      useKeyterms = true;
      console.log("✅ Using Nova-3 for language:", options.language);
    } else if (nova2List.includes(options.language)) {
      finalModel = "nova-2-general";
      params.append("model", "nova-2-general");
      console.log("✅ Using Nova-2 for language:", options.language);
    } else {
      finalModel = "nova-2-general";
      params.append("model", "nova-2-general");
      console.log("⚠️ Language not listed, Nova-2 fallback:", options.language);
    }
  } else {
    params.append("model", "nova-2-general");
    console.log("✅ Using Nova-2 (no language specified)");
  }

  // Ключевые термины — только для Nova-3
  if (useKeyterms && options?.language) {
    const kt = keytermPrompts[options.language];
    if (kt && kt.trim()) {
      params.append("keyterm", kt);
      console.log("✅ Added keyterm for", options.language);
    } else {
      console.log("⚠️ No keyterm for", options.language);
    }
  }

  // Core опции
  params.append("punctuate", String(options?.punctuate ?? true));
  params.append("smart_format", String(options?.smart_format ?? true));
  params.append("filler_words", "true");

  // Диаиризация — как у тебя
  if (options?.diarize) {
    params.append("diarize", "true");
    params.append("utterances", "true");
    console.log("✅ Diarization ON: diarize=true, utterances=true");
  } else if (options?.utterances) {
    // Если явно включили utterances без diarize — тоже поддержим
    params.append("utterances", "true");
  }

  if (options?.profanity_filter) {
    params.append("profanity_filter", "true");
  }

  const deepgramUrl = `https://api.deepgram.com/v1/listen?${params.toString()}`;
  console.log("📡 Calling Deepgram:", { finalModel, deepgramUrl, params: Object.fromEntries(params.entries()) });

  let deepgramResponse: Response | null = null;
  let fileToCleanup: string | null = storageFile || null;

  try {
    if (isLargeFile) {
      // --- Большой файл: создаём signed URL, проверяем HEAD и отправляем JSON { url } ---
      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storageFile!, 60 * 60, { download: true });
      if (signErr || !signed?.signedUrl) {
        console.error("❌ Signed URL failed:", signErr);
        return new Response(JSON.stringify({ success: false, error: "Failed to sign storage file", version: VERSION }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const signedUrl = signed.signedUrl;
      console.log("🔗 Using signed URL for Deepgram");

      // HEAD diagnostics
      try {
        const head = await fetch(signedUrl, { method: "HEAD" });
        console.log("[DG] HEAD audio:", {
          status: head.status,
          ct: head.headers.get("content-type"),
          cl: head.headers.get("content-length"),
        });
      } catch (e) {
        console.log("[DG] HEAD failed:", e);
      }

      deepgramResponse = await fetch(deepgramUrl, {
        method: "POST",
        headers: {
          "Authorization": `Token ${DEEPGRAM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: signedUrl }),
        signal: AbortSignal.timeout(600000), // 10 минут
      });
    } else {
      // --- Малый файл: бинарное аудио в теле запроса ---
      if (!audio) {
        return new Response(JSON.stringify({ success: false, error: "No audio provided", version: VERSION }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // base64 → Uint8Array
      const audioBuffer = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
      console.log("✅ Base64 decoded, size:", audioBuffer.length);

      deepgramResponse = await fetch(deepgramUrl, {
        method: "POST",
        headers: {
          "Authorization": `Token ${DEEPGRAM_API_KEY}`,
          // важный момент: не ставим application/json — отправляем «сырое» аудио
          "Content-Type": mimeType || "application/octet-stream",
        },
        body: audioBuffer,
        signal: AbortSignal.timeout(600000),
      });
    }

    const responseText = await deepgramResponse.text();
    if (!deepgramResponse.ok) {
      console.error("❌ Deepgram API error:", {
        status: deepgramResponse.status,
        statusText: deepgramResponse.statusText,
        error: responseText,
        model: finalModel,
        url: deepgramUrl,
      });
      return new Response(JSON.stringify({
        success: false,
        error: "Deepgram error",
        status: deepgramResponse.status,
        statusText: deepgramResponse.statusText,
        details: responseText,
        model: finalModel,
        version: VERSION,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let dgJson: any = null;
    try { dgJson = JSON.parse(responseText); } catch { dgJson = responseText; }

    console.log("✅ Deepgram response received", {
      hasResults: !!dgJson?.results,
      hasUtterances: !!dgJson?.results?.utterances,
      utteranceCount: dgJson?.results?.utterances?.length || 0,
      model: finalModel,
      detectedLanguage: dgJson?.metadata?.model_info?.language,
    });

    // Собираем результат (как у тебя)
    const transcript = dgJson?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    let speakerUtterances: any[] = [];
    if (dgJson?.results?.utterances) {
      console.log("📊 Processing utterances:", dgJson.results.utterances.length);
      speakerUtterances = dgJson.results.utterances.map((u: any, idx: number) => {
        const speakerNumber = u.speaker !== undefined ? u.speaker : 0;
        const speakerLabel = `Speaker ${speakerNumber}`;
        return {
          speaker: speakerLabel,
          text: u.transcript,
          confidence: u.confidence,
          start: u.start,
          end: u.end,
        };
      });
      const speakerDistribution = speakerUtterances.reduce((acc: Record<string, number>, u: any) => {
        acc[u.speaker] = (acc[u.speaker] || 0) + 1;
        return acc;
      }, {});
      console.log("📈 Speaker distribution:", speakerDistribution);
    }

    let detectedLanguage: { language: string; confidence: number } | null = null;
    if (dgJson?.metadata?.model_info?.language) {
      detectedLanguage = {
        language: dgJson.metadata.model_info.language,
        confidence: dgJson.metadata.model_info.language_confidence || 0.95,
      };
    }

    const result = {
      text: transcript,
      speakerUtterances,
      detectedLanguage,
      metadata: {
        duration: dgJson?.metadata?.duration || 0,
        channels: dgJson?.metadata?.channels || 1,
        model: finalModel,
      },
    };

    console.log("✅ Processed transcription result", {
      textLength: result.text.length,
      utteranceCount: result.speakerUtterances.length,
      hasLanguageDetection: !!result.detectedLanguage,
      model: finalModel,
    });

    // Cleanup storageFile (best-effort)
    if (fileToCleanup) {
      try {
        console.log("🗑️ Cleaning up storage file:", fileToCleanup);
        const { error: delErr } = await supabase.storage.from(BUCKET).remove([fileToCleanup]);
        if (delErr) console.error("⚠️ Failed to delete storage file:", delErr);
        else console.log("✅ Storage file cleaned up");
      } catch (e) {
        console.error("⚠️ Storage cleanup error:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, result, version: VERSION }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("❌ Deepgram transcription error:", err);

    // Пытаемся вычистить storageFile, даже если упали
    try {
      if (payload?.storageFile) {
        const { error: delErr } = await supabase.storage.from(BUCKET).remove([payload.storageFile]);
        if (delErr) console.error("⚠️ Cleanup after error failed:", delErr);
        else console.log("✅ Storage file cleaned up after error");
      }
    } catch (cleanupError) {
      console.error("⚠️ Error cleanup failed:", cleanupError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error occurred",
      version: VERSION,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
