
# Улучшение качества транскрипции: падежи и диаризация — ВЫПОЛНЕНО ✅

## Реализованные изменения

### Шаг 1: Sample rate 8 kHz → 16 kHz ✅
- `src/lib/merge-audio-to-wav.ts`: TARGET_SR = 16000
- `src/services/serverAudioMergingService.ts`: outputSampleRate = 16000

### Шаг 2: ru/pl переведены на Nova-3 ✅
- `supabase/functions/deepgram-transcribe/index.ts`: дефолт nova3Languages теперь включает pl и ru

### Шаг 3: Авто-ретрай при 1 спикере ✅
- `src/services/deepgramService.ts`: при uniqueSpeakers === 1 и utterances > 10 → автоматический ретрай с detect_language=true

## Validate Diarization: улучшения — ВЫПОЛНЕНО ✅

### Модальное окно с превью результатов ✅
- `src/components/DiarizationResultsModal.tsx`: новый компонент с speaker mapping, confidence, списком изменённых utterances

### Применение коррекции в БД ✅
- `src/services/databaseService.ts`: метод `updateUtteranceSpeakers()` — batch update speaker labels
- `src/components/ValidateDiarizationButton.tsx`: кнопка Apply → обновляет utterances в БД

### Батчинг для длинных диалогов ✅
- `supabase/functions/diarization-fix/index.ts`: диалоги >150 utterances разбиваются на чанки по 120 с перекрытием 5

## Шумоподавление RNNoise — ВЫПОЛНЕНО ✅

### Edge Function audio-denoise ✅
- `supabase/functions/audio-denoise/index.ts`: FFmpeg WASM с afftdn + highpass фильтрами
- Fallback: passthrough если FFmpeg WASM недоступен
- Автоочистка оригинала после денойза

### Интеграция в пайплайн транскрипции ✅
- `src/services/deepgramService.ts`: денойз шаг между загрузкой и Deepgram API
- Для больших файлов: upload → denoise → transcribe → cleanup
- Для малых файлов с денойзом: upload → denoise → transcribe → cleanup
- Для малых файлов без денойза: base64 → transcribe (как раньше)

### UI toggle ✅
- `src/pages/Upload.tsx`: Switch "Noise reduction (RNNoise)" включён по умолчанию
- `src/store/settingsStore.ts`: настройка `noiseReduction` сохраняется в localStorage

## Call Quality Score — ВЫПОЛНЕНО ✅

### Таблица call_quality_analysis ✅
- Миграция: таблица с overall_score, categories (jsonb), details (jsonb)
- RLS: доступ по user_id через dialogs, админы видят всё

### Edge Function call-quality-analyze ✅
- Метрики: confidence, gaps, overlaps, short fragments
- LLM (Gemini Flash Lite): семантический анализ ("Вы меня слышите?", повторения)
- Upsert результата в БД через service role

### UI: таб "Call Quality" в DialogDetail ✅
- `src/components/CallQualityTab.tsx`: overall score, 4 категории, timeline issues
- `src/hooks/useCallQuality.ts`: react-query + mutation
- Кнопка "Analyze Call Quality" / "Re-analyze"

## Следующие шаги (опционально)
- LLM-постобработка для исправления падежей (edge function fix-transcription)
- Автозапуск call quality после транскрипции
- utt_split параметр для Deepgram (уменьшение гиперфрагментации)
