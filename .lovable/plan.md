

# Шумоподавление через RNNoise для улучшения диаризации

## Оценка идеи

RNNoise через FFmpeg `arnndn` -- отличная идея для моно-записей колл-центра. Вот почему:

- RNNoise убирает стационарный шум (гул кондиционера, фон офиса) без искажения голоса
- Чистый аудиосигнал улучшает speaker embeddings Deepgram → лучшая диаризация
- Чище согласные → меньше ошибок в падежных окончаниях
- Практически нет деградации качества речи (neural network обучена на реальной речи)

**Ограничение**: Supabase Edge Functions (Deno) не имеют FFmpeg. Поэтому два варианта:

1. **Client-side** через Web Audio API + RNNoise WASM -- работает, но медленно для длинных записей (2-3 часа)
2. **Server-side edge function** с FFmpeg WASM для Deno -- реально, но тяжело по памяти

Оптимальный подход: **серверная edge function** `audio-denoise`, которая вызывается между загрузкой и транскрипцией. Она берёт файл из storage, прогоняет через RNNoise, сохраняет очищенную версию, удаляет оригинал.

## План реализации

### 1. Новая Edge Function: `supabase/functions/audio-denoise/index.ts`

- Принимает `{ storagePath: string, bucket: string }`
- Скачивает аудио из storage
- Применяет RNNoise через FFmpeg WASM (`@ffmpeg/ffmpeg` для Deno, или `ffmpeg-wasm-deno`)
- Сохраняет очищенный файл как `denoised_<original_name>`
- Удаляет оригинальный файл
- Возвращает `{ denoisedPath: string }`
- Memory: 1024 MB, timeout: 300s

### 2. Config: `supabase/config.toml`

```toml
[functions.audio-denoise]
memory_mb = 1024
timeout_sec = 300
verify_jwt = false
```

### 3. Интеграция в пайплайн: `src/services/deepgramService.ts`

В методах `transcribeLargeFile` и `transcribeSmallFile`:
- После загрузки файла в storage → вызвать `audio-denoise` edge function
- Получить путь к очищенному файлу
- Передать очищенный файл в `deepgram-transcribe`
- Cleanup очищенного файла уже обрабатывается deepgram-transcribe (удаляет storageFile после транскрипции)

Для мелких файлов (<8MB): загрузить в storage → denoise → transcribe (вместо base64)

### 4. UI toggle: `src/pages/Upload.tsx`

- Добавить чекбокс "Noise reduction (RNNoise)" перед транскрипцией
- По умолчанию включён
- Сохранить настройку в settingsStore

### 5. Cleanup стратегия

Файлы подчищаются автоматически:
- Оригинал: удаляется в `audio-denoise` после создания очищенной версии
- Очищенный файл: удаляется в `deepgram-transcribe` (строка 422-438, уже реализовано)
- Merged файлы (при мультизагрузке): удаляются аналогично

### Технические риски

| Риск | Митигация |
|------|-----------|
| FFmpeg WASM в Deno может не работать | Fallback: пропустить denoise, транскрибировать как есть |
| Нехватка памяти для длинных записей | Лимит 1024MB, потоковая обработка |
| Увеличение времени обработки на ~30-60сек | Приемлемо для улучшения качества |

### Порядок изменений

| # | Файл | Что делаем |
|---|------|-----------|
| 1 | `supabase/config.toml` | Добавить конфиг для `audio-denoise` |
| 2 | `supabase/functions/audio-denoise/index.ts` | Создать edge function с RNNoise через FFmpeg WASM |
| 3 | `src/services/deepgramService.ts` | Интегрировать denoise шаг перед транскрипцией |
| 4 | `src/pages/Upload.tsx` | Добавить toggle для noise reduction |
| 5 | `src/store/settingsStore.ts` | Сохранить настройку denoise |

