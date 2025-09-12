// supabase/functions/openai-evaluate/index.ts
// Edge-функция с двумя режимами:
//   A) response_format: json_schema (STRICT) — основной путь
//   B) tool calling + принудительный tool_choice — fallback
//
// Возвращает "slim" ответ, совместимый с твоим парсером:
// {
//   choices: [{ message: { content: string }, finish_reason: string }],
//   usage?: { prompt_tokens?: number; completion_tokens?: number },
//   tokenEstimation?: { actualInputTokens?: number; outputTokens?: number }
// }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function jsonHeaders(extra?: Record<string, string>) {
  return {
    "content-type": "application/json; charset=utf-8",
    ...(extra || {}),
  };
}

function isSchemaUnsupported(errMsg: string | undefined): boolean {
  if (!errMsg) return false;
  const msg = errMsg.toLowerCase();
  return (
    msg.includes("response_format") &&
    (msg.includes("unsupported") || msg.includes("invalid") || msg.includes("not supported"))
  );
}

function usageToEstimation(usage: any | undefined) {
  if (!usage) return undefined;
  return {
    actualInputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
  };
}

// Единая JSON-схема для обоих режимов
const evaluationJSONSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "mistakes", "speakers"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    mistakes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rule_category", "comment", "utterance"],
        properties: {
          rule_category: { type: "string", enum: ["Correct", "Acceptable", "Not Recommended", "Mistake", "Banned"] },
          comment: {
            type: "object",
            additionalProperties: false,
            required: ["original", "russian"],
            properties: {
              original: { type: "string", minLength: 1 },
              russian: { type: "string", minLength: 1 },
            },
          },
          utterance: { type: "string", minLength: 1 },
        },
      },
    },
    speakers: {
      type: "object",
      additionalProperties: false,
      required: ["speaker_0", "role_0", "speaker_1", "role_1"],
      properties: {
        // ПУСТАЯ СТРОКА ДОПУСТИМА, если имя не определено.
        speaker_0: { type: "string" },
        role_0:    { type: "string", enum: ["Agent", "Customer"] },
        speaker_1: { type: "string" },
        role_1:    { type: "string", enum: ["Agent", "Customer"] },
     },
    },
  },
};

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "POST, OPTIONS",
        },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: jsonHeaders({ "access-control-allow-origin": "*" }),
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not set" }), {
        status: 500,
        headers: jsonHeaders({ "access-control-allow-origin": "*" }),
      });
    }

    // Тело запроса от приложения: { model, messages, ...доп.поля }
    const body = await req.json();
    const { model, messages, ...rest } = body as {
      model: string;
      messages: ChatMessage[];
      [k: string]: unknown;
    };

    if (!model || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "model and messages are required" }), {
        status: 400,
        headers: jsonHeaders({ "access-control-allow-origin": "*" }),
      });
    }

    // Базовые параметры, присланные клиентом, оставляем как есть (temperature и т.п.),
    // но структуру ответа контролируем здесь.
    const basePayload: Record<string, unknown> = {
      model,
      messages,
      ...rest,
    };

    // ====== Попытка A: Structured Outputs (json_schema, strict) ======
    try {
      const payloadA = {
        ...basePayload,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "EvaluationPayload",
            strict: true,
            schema: evaluationJSONSchema,
          },
        },
      };

      const resA = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          ...jsonHeaders(),
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payloadA),
      });

      const dataA = await resA.json();

      if (!resA.ok) {
        const errMsg = dataA?.error?.message || resA.statusText;
        // Если явно неподдерживаемо — переключаемся на B
        if (isSchemaUnsupported(errMsg)) throw new Error(`SCHEMA_UNSUPPORTED: ${errMsg}`);
        // Иначе пробрасываем ошибку наверх (пусть клиент увидит причину)
        return new Response(JSON.stringify({ error: errMsg }), {
          status: resA.status,
          headers: jsonHeaders({ "access-control-allow-origin": "*" }),
        });
      }

      // Урезаем ответ до "slim"
      const slimA = {
        choices: [
          {
            message: { content: dataA?.choices?.[0]?.message?.content ?? "" },
            finish_reason: dataA?.choices?.[0]?.finish_reason ?? "",
          },
        ],
        usage: dataA?.usage
          ? {
            prompt_tokens: dataA.usage.prompt_tokens ?? 0,
            completion_tokens: dataA.usage.completion_tokens ?? 0,
          }
          : undefined,
        tokenEstimation: usageToEstimation(dataA?.usage),
      };

      return new Response(JSON.stringify(slimA), {
        status: 200,
        headers: jsonHeaders({ "access-control-allow-origin": "*" }),
      });
    } catch (err) {
      // Только если ошибка — явная неподдержка json_schema, идём в B
      if (!(err instanceof Error) || !String(err.message).startsWith("SCHEMA_UNSUPPORTED:")) {
        // Любая другая ошибка — отдадим клиенту
        return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
          status: 500,
          headers: jsonHeaders({ "access-control-allow-origin": "*" }),
        });
      }
      // иначе — продолжаем к B
    }

    // ====== Fallback B: Tool Calling + принудительный tool_choice ======
    const tools = [
      {
        type: "function",
        function: {
          name: "emit_evaluation",
          description: "Return strict conversation evaluation",
          parameters: evaluationJSONSchema,
        },
      },
    ];

    const payloadB = {
      ...basePayload,
      tools,
      tool_choice: { type: "function", function: { name: "emit_evaluation" } },
    };

    const resB = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        ...jsonHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payloadB),
    });

    const dataB = await resB.json();

    if (!resB.ok) {
      const errMsg = dataB?.error?.message || resB.statusText;
      return new Response(JSON.stringify({ error: errMsg }), {
        status: resB.status,
        headers: jsonHeaders({ "access-control-allow-origin": "*" }),
      });
    }

    // Достаём arguments первой tool-функции и кладём их в message.content,
    // чтобы клиентский парсер ничего не менял.
    const args =
      dataB?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "";

    const slimB = {
      choices: [
        {
          message: { content: args },
          finish_reason: dataB?.choices?.[0]?.finish_reason ?? "",
        },
      ],
      usage: dataB?.usage
        ? {
          prompt_tokens: dataB.usage.prompt_tokens ?? 0,
          completion_tokens: dataB.usage.completion_tokens ?? 0,
        }
        : undefined,
      tokenEstimation: usageToEstimation(dataB?.usage),
    };

    return new Response(JSON.stringify(slimB), {
      status: 200,
      headers: jsonHeaders({ "access-control-allow-origin": "*" }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: jsonHeaders({ "access-control-allow-origin": "*" }),
    });
  }
});
