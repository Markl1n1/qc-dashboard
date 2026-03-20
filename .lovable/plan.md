

# Анализ качества звонка (Call Quality Score)

## Подход

Два источника данных для анализа — оба уже доступны после транскрипции:

1. **Метрики из Deepgram** (числовые, автоматические):
   - Confidence scores по utterances → низкий confidence = плохой звук/неразборчивость
   - Очень короткие utterances подряд → прерывания/обрывы
   - Паузы >3 секунд между репликами → возможно кто-то не слышит
   - Перекрытия (utterance одного спикера начинается до конца другого) → перебивания

2. **Анализ текста через LLM** (семантический):
   - "Алло? Вы меня слышите?" → проблемы со связью
   - Повторения фраз → переспросы из-за плохой слышимости
   - Незавершённые предложения → обрывы связи

## Реализация

### 1. Новая edge function: `supabase/functions/call-quality-analyze/index.ts`

Принимает utterances диалога, вычисляет метрики + отправляет в LLM для семантического анализа. Возвращает:

```json
{
  "overallScore": 78,
  "categories": {
    "audioClarity": { "score": 65, "issues": ["Low confidence in 12% of utterances"] },
    "connectionStability": { "score": 80, "issues": ["2 gaps >5s detected"] },
    "interruptions": { "score": 90, "issues": ["3 speaker overlaps"] },
    "communication": { "score": 75, "issues": ["Agent asked 'Can