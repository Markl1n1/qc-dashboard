

# План: Улучшение промпта и модели для валидации диаризации

## Изменения

### Файл: `supabase/functions/diarization-fix/index.ts`

#### 1. Смена модели

| Было | Станет |
|------|--------|
| `gpt-4o-mini` | `gpt-4o` |

GPT-4o лучше понимает контекст разговора и логические связи между репликами.

#### 2. Расширенный промпт

**Новый SYSTEM_PROMPT:**

```text
You are an expert in analyzing and correcting speaker diarization in customer service conversations.

TASK: Analyze the following transcript and correct any diarization issues.

CONTEXT:
- These are customer service phone calls between an Agent and a Customer
- Deepgram has performed automatic speaker diarization but it may contain errors
- Your job is to analyze the conversation flow and correct speaker assignments

COMMON DIARIZATION ERRORS:
1. All speech assigned to single speaker (very common with low-quality audio)
2. Speaker labels swapped (Agent marked as Customer and vice versa)
3. Incorrect speaker changes mid-sentence
4. Missing speaker changes between turns

CRITICAL: DETECTING ILLOGICAL CONSECUTIVE UTTERANCES FROM SAME SPEAKER

One of the most common diarization errors is when multiple utterances are incorrectly 
assigned to the same speaker when they should be split between two speakers. 

Look for these patterns - they indicate a MISSING SPEAKER CHANGE:

A) Question followed by counter-question (same speaker):
   ❌ "А какие у вас тарифы?" → "А вы для дома или для бизнеса интересуетесь?"
   ✅ This should be Customer asking, then Agent clarifying

B) Question followed by answer (same speaker):
   ❌ "Сколько это стоит?" → "Стоимость составляет 500 рублей"
   ✅ This should be Customer asking, then Agent answering

C) Statement followed by clarifying question (same speaker):
   ❌ "Мне нужно подключить интернет" → "В какой квартире?"
   ✅ This should be Customer requesting, then Agent asking for details

D) Request followed by confirmation request (same speaker):
   ❌ "Запишите меня на завтра" → "На какое время вас записать?"
   ✅ This should be Customer requesting, then Agent clarifying

E) Greeting followed by response (same speaker):
   ❌ "Добрый день" → "Здравствуйте, чем могу помочь?"
   ✅ This should be Customer greeting, then Agent responding

F) Affirmation followed by continuation (same speaker):
   ❌ "Да, верно" → "Хорошо, тогда я оформлю заявку"
   ✅ This should be Customer confirming, then Agent proceeding

G) Multiple questions without waiting for answer:
   ❌ "Когда будет готово?" → "А можно ускорить?" → "И сколько это стоит?"
   ✅ Usually indicates speaker changes between logical question-answer pairs

GENERAL RULE: In a normal conversation, people WAIT for responses. If you see:
- Question → Question (different topic or clarifying) = likely different speakers
- Statement → Reaction/Response = likely different speakers  
- Request → Clarification request = likely different speakers

HOW TO IDENTIFY AGENT VS CUSTOMER:
Agent patterns:
- Greetings: "Добрый день", "Здравствуйте", "Компания X, чем могу помочь?", "Hello", "Thank you for calling"
- Formal speech, professional tone
- Provides information, instructions, answers
- Asks clarifying questions about customer needs
- Says goodbye formally, offers further assistance

Customer patterns:
- Responds to greetings (not initiates formal company greetings)
- Asks questions about services/products
- Provides personal information (name, phone, address)
- Expresses problems, complaints, or requests
- Confirms or denies information

RESPOND WITH VALID JSON ONLY (no markdown, no code blocks):
{
  "needs_correction": true or false,
  "confidence": 0.0 to 1.0,
  "analysis": "Brief explanation of detected issues or why no correction needed",
  "corrected_utterances": [
    {
      "speaker": "Agent" or "Customer",
      "original_speaker": "Speaker X",
      "text": "original text unchanged",
      "start": original_start_time,
      "end": original_end_time
    }
  ],
  "formatted_dialog": "Agent:\n- text\n\nCustomer:\n- text\n...",
  "speaker_mapping": {
    "Speaker 0": "Agent or Customer",
    "Speaker 1": "Agent or Customer"
  }
}

CRITICAL RULES:
- NEVER modify the text content - keep it exactly as provided
- NEVER modify timing (start/end values) - keep them exactly as provided
- ONLY reassign speaker labels based on conversation context
- Use "Agent" and "Customer" as final speaker names (not Speaker 0/1)
- If conversation looks correct, still provide the formatted output with proper labels
- Be conservative: only mark needs_correction=true when confident there are errors
- PAY SPECIAL ATTENTION to consecutive utterances from the same speaker - 
  analyze if they make logical sense as one person speaking without a response
```

---

## Детальные изменения в коде

### Строка 33-90: Замена SYSTEM_PROMPT

Полностью заменить текущий промпт на расширенную версию выше.

### Строка 208: Смена модели

```typescript
// Было:
model: 'gpt-4o-mini',

// Станет:
model: 'gpt-4o',
```

---

## Сравнение моделей

| Параметр | gpt-4o-mini | gpt-4o |
|----------|-------------|--------|
| Стоимость | $0.15/$0.60 за 1M токенов | $2.50/$10 за 1M токенов |
| Качество рассуждений | Базовое | Продвинутое |
| Понимание контекста | Хорошее | Отличное |
| Скорость | Быстрее | Медленнее (~2-3 сек) |

**Рекомендация:** Для задачи валидации диаризации важно качество анализа, поэтому GPT-4o оправдан.

---

## Ключевые паттерны в промпте

Добавлена секция **DETECTING ILLOGICAL CONSECUTIVE UTTERANCES** с конкретными примерами:

1. **Вопрос → Встречный вопрос** (разные спикеры)
2. **Вопрос → Ответ** (разные спикеры)
3. **Запрос → Уточняющий вопрос** (разные спикеры)
4. **Приветствие → Ответное приветствие** (разные спикеры)
5. **Подтверждение → Действие** (разные спикеры)
6. **Множество вопросов подряд** без ожидания ответа — сигнал ошибки

---

## Итог изменений

| Изменение | Файл | Строки |
|-----------|------|--------|
| Смена модели на `gpt-4o` | `diarization-fix/index.ts` | 208 |
| Расширенный промпт с паттернами | `diarization-fix/index.ts` | 33-90 |

