
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

## Следующие шаги (опционально)
- LLM-постобработка для исправления падежей (edge function fix-transcription)
