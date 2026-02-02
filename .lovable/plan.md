
# План: Кнопка "Validate Diarization" с ролевым доступом

## Обзор задачи

1. **Исправить build-ошибки** в `deepgram-transcribe/index.ts`
2. **Создать Edge Function** `diarization-fix` для GPT-валидации
3. **Добавить кнопку** "Validate Diarization" в компонент `EnhancedSpeakerDialog`
4. **Ролевой доступ**: только admin может нажать, supervisor видит затемнённую кнопку с tooltip

## Часть 1: Исправление build-ошибок

### Файл: `supabase/functions/deepgram-transcribe/index.ts`

**Проблема 1:** `audioBuffer` типа `Uint8Array` не совместим с `body` в fetch (Deno требует `Blob` или `ArrayBuffer`).

**Проблема 2:** `deepgramResponse` используется до присвоения — нужна проверка после блока else-if.

**Решение:**

```typescript
// Строка 222: явная типизация
let deepgramResponse: Response | undefined;

// Строка 266: конвертация Uint8Array → Blob
body: audioBuffer ? new Blob([audioBuffer]) : undefined,

// После строки 277: добавить проверку
if (!deepgramResponse) {
  console.error('❌ [ERROR] No deepgramResponse - neither storage URL nor audio buffer processed');
  throw new Error('No audio data was processed');
}
```

---

## Часть 2: Создание Edge Function `diarization-fix`

### Файл: `supabase/functions/diarization-fix/index.ts`

**Функционал:**
- Принимает `utterances` от клиента
- Отправляет в OpenAI для анализа и исправления диаризации
- Возвращает исправленные реплики и форматированный текст

**Промпт для GPT:**

```text
You are an expert in analyzing and correcting speaker diarization in customer service conversations.

TASK: Analyze the following transcript and correct any diarization issues.

CONTEXT:
- These are customer service phone calls between an Agent and a Customer
- Deepgram has performed automatic speaker diarization but it may contain errors
- Your job is to analyze the conversation flow and correct speaker assignments

COMMON DIARIZATION ERRORS:
1. All speech assigned to single speaker
2. Speaker labels swapped (Agent marked as Customer and vice versa)
3. Incorrect speaker changes mid-sentence

HOW TO IDENTIFY AGENT VS CUSTOMER:
Agent patterns:
- Greetings: "Добрый день", "Здравствуйте", "Компания X, чем могу помочь?"
- Formal speech, professional tone
- Provides information, instructions
- Asks clarifying questions about customer needs

Customer patterns:
- Responds to greetings
- Asks questions about services/products
- Provides personal information
- Expresses problems or requests

RESPOND WITH JSON:
{
  "needs_correction": true/false,
  "confidence": 0.0-1.0,
  "analysis": "Brief explanation of detected issues",
  "corrected_utterances": [
    {
      "speaker": "Agent" or "Customer",
      "original_speaker": "Speaker X",
      "text": "original text",
      "start": original_start,
      "end": original_end
    }
  ],
  "formatted_dialog": "Agent:\n- текст\n\nCustomer:\n- текст\n..."
}

RULES:
- NEVER modify the text content
- NEVER modify timing (start/end values)
- ONLY reassign speaker labels
- Format output as "Agent" and "Customer" (not Speaker 0/1)
```

---

## Часть 3: Компонент кнопки с ролевым доступом

### Новый файл: `src/components/ValidateDiarizationButton.tsx`

```typescript
interface Props {
  utterances: SpeakerUtterance[];
  disabled?: boolean;
}
```

**Логика:**
1. Использует `useOptimizedUserRole()` для проверки роли
2. Если `isAdmin` → кнопка активна
3. Если не admin → кнопка затемнена (`opacity-50 cursor-not-allowed`)
4. При наведении на неактивную кнопку → Tooltip "Функционал ещё тестируется"

**При клике:**
1. Показывает loading state "Validating..."
2. Вызывает `supabase.functions.invoke('diarization-fix', { body: { utterances } })`
3. Получает результат
4. Скачивает `.txt` файл с `formatted_dialog`

---

## Часть 4: Интеграция в EnhancedSpeakerDialog

### Файл: `src/components/EnhancedSpeakerDialog.tsx`

**Изменения в строке 207:**

```tsx
// Было:
<Button variant="outline" size="sm" onClick={handleCopyDialog}>
  <Copy className="h-4 w-4 mr-2" />
  Copy Dialog
</Button>

// Станет:
<div className="flex gap-2">
  <ValidateDiarizationButton utterances={mergedUtterances} />
  <Button variant="outline" size="sm" onClick={handleCopyDialog}>
    <Copy className="h-4 w-4 mr-2" />
    Copy Dialog
  </Button>
</div>
```

---

## Часть 5: Обновление config.toml

### Файл: `supabase/config.toml`

```toml
[functions.diarization-fix]
verify_jwt = false
```

---

## Архитектура решения

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EnhancedSpeakerDialog Component                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────────┐  ┌──────────────────┐                            │
│   │ ValidateDiarization  │  │   Copy Dialog    │                            │
│   │      Button          │  │     Button       │                            │
│   └──────────┬───────────┘  └──────────────────┘                            │
│              │                                                               │
│              ▼                                                               │
│   ┌──────────────────────────────────────────────────────┐                  │
│   │              useOptimizedUserRole()                  │                  │
│   │   isAdmin? → активная кнопка                         │                  │
│   │   !isAdmin → затемнённая + Tooltip                   │                  │
│   └──────────────────────────────────────────────────────┘                  │
│              │ (только для admin)                                            │
│              ▼                                                               │
│   ┌──────────────────────────────────────────────────────┐                  │
│   │        supabase.functions.invoke('diarization-fix')  │                  │
│   └──────────────────────────────────────────────────────┘                  │
│              │                                                               │
│              ▼                                                               │
│   ┌──────────────────────────────────────────────────────┐                  │
│   │           Edge Function: diarization-fix             │                  │
│   │   - Проверка JWT                                     │                  │
│   │   - Вызов OpenAI API                                 │                  │
│   │   - Возврат исправленного диалога                    │                  │
│   └──────────────────────────────────────────────────────┘                  │
│              │                                                               │
│              ▼                                                               │
│   ┌──────────────────────────────────────────────────────┐                  │
│   │           Скачивание .txt файла                      │                  │
│   │   validated_dialog_[timestamp].txt                   │                  │
│   └──────────────────────────────────────────────────────┘                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Итоговый список изменений

| # | Файл | Действие | Описание |
|---|------|----------|----------|
| 1 | `supabase/functions/deepgram-transcribe/index.ts` | Исправление | Fix Uint8Array → Blob, проверка deepgramResponse |
| 2 | `supabase/functions/diarization-fix/index.ts` | Создание | Новая edge function для GPT валидации |
| 3 | `supabase/config.toml` | Обновление | Добавить `[functions.diarization-fix]` |
| 4 | `src/components/ValidateDiarizationButton.tsx` | Создание | Кнопка с ролевым доступом |
| 5 | `src/components/EnhancedSpeakerDialog.tsx` | Обновление | Интеграция кнопки |

---

## Ожидаемый результат

1. **Build успешен** — ошибки TypeScript исправлены
2. **Admin видит активную кнопку** → при клике получает исправленный диалог в `.txt`
3. **Supervisor видит неактивную кнопку** → при наведении видит "Функционал ещё тестируется"
4. **Результаты не сохраняются в БД** — только скачивание файла (тестовый режим)
