

# Улучшение качества транскрипции: падежи и диаризация

## Найденные проблемы в текущем пайплайне

### 1. Sample rate 8 kHz — главный виновник
Файл `src/lib/merge-audio-to-wav.ts` даунсемплит аудио до **8000 Hz** при мерже нескольких файлов. Deepgram рекомендует минимум **16 kHz** для quality speech recognition. При 8 kHz:
- Теряются высокочастотные согласные (с, ш, з, ц) → ошибки в падежных окончаниях
- Хуже работает speaker embedding → деградация диаризации

### 2. Nova-2 для русского/польского вместо Nova-3
В edge function (`deepgram-transcribe/index.ts`, строка 137-141): русский и польский направляются на **Nova-2**, а Nova-3 (более точная модель) используется только для en/es/fr/de. Nova-3 поддерживает русский и польский и даёт лучшее качество.

### 3. Нет автоматической коррекции при плохой диаризации
Когда Deepgram возвращает только 1 спикера, система логирует warning, но не предпринимает действий.

---

## План изменений

### Шаг 1: Поднять sample rate с 8 kHz до 16 kHz
**Файл:** `src/lib/merge-audio-to-wav.ts`
- Изменить `TARGET_SR = 8000` → `TARGET_SR = 16000`
- Это удваивает размер WAV, но значительно улучшает распознавание морфологии и диаризацию

**Файл:** `src/services/serverAudioMergingService.ts`
- Обновить `outputSampleRate: 8000` → `outputSampleRate: 16000`

### Шаг 2: Перевести русский и польский на Nova-3
**Файл:** `supabase/functions/deepgram-transcribe/index.ts`
- Перенести `pl` и `ru` из списка Nova-2 в Nova-3 (они поддерживаются)
- Это даст keyterm support + улучшенную точность для этих языков
- Обновить дефолтные значения: `nova2Languages` default → `'[]'`, `nova3Languages` default → `'["pl","ru","es","fr","de","en"]'`

### Шаг 3: Авто-ретрай при одном спикере
**Файл:** `src/services/deepgramService.ts` (метод `processTranscriptionResult`)
- Если `uniqueSpeakers === 1` и utterances > 10 — автоматически повторить транскрипцию с `detect_language=true` (на случай, если язык был выбран неверно)
- Максимум 1 ретрай, чтобы не зациклиться
- Показать пользователю toast: "Обнаружен только 1 спикер, повторная попытка с auto-detect..."

### Шаг 4: LLM-постобработка для исправления падежей (опционально)
**Новый edge function:** `supabase/functions/fix-transcription/index.ts`
- Принимает текст транскрипции + язык
- Отправляет в GPT-4o-mini с промптом: "Fix grammatical cases, declensions, and word endings. Do NOT change meaning or add words."
- Сохраняет исправленный текст как отдельную transcription_type = 'corrected'
- Доступно как кнопка "Fix grammar" на странице диалога

---

## Ожидаемый эффект

| Изменение | Влияние на падежи | Влияние на диаризацию |
|-----------|-------------------|----------------------|
| 16 kHz вместо 8 kHz | Значительное улучшение | Значительное улучшение |
| Nova-3 для ru/pl | Заметное улучшение | Умеренное улучшение |
| Авто-ретрай | — | Спасает случаи с неверным языком |
| LLM-постобработка | Максимальное исправление | — |

---

## Что реализуем сейчас

Шаги 1-3 — минимальные изменения с максимальным эффектом. Шаг 4 (LLM-постобработка) можно добавить отдельно позже.

| Файл | Изменение |
|------|-----------|
| `src/lib/merge-audio-to-wav.ts` | TARGET_SR: 8000 → 16000 |
| `src/services/serverAudioMergingService.ts` | outputSampleRate: 8000 → 16000 |
| `supabase/functions/deepgram-transcribe/index.ts` | Перевести ru/pl на Nova-3, обновить дефолты |
| `src/services/deepgramService.ts` | Авто-ретрай при 1 спикере с detect_language |

