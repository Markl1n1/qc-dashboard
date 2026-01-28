# План улучшения качества распознавания речи (VoiceQC)

## ✅ СТАТУС: РЕАЛИЗОВАНО

Все критичные и важные блоки выполнены. Ожидаемое улучшение качества распознавания: **+15-25%**.

---

## ✅ Блок 1: Повышение Sample Rate — ГОТОВО
- `TARGET_SR = 16000` (было 8000)
- Качественный ресемплинг через `OfflineAudioContext` с anti-aliasing
- Нормализация включена по умолчанию
- **Файл:** `src/lib/merge-audio-to-wav.ts`

## ✅ Блок 2: Предобработка аудио — ГОТОВО
- Pipeline: High-pass (80 Hz) → Low-pass (7500 Hz) → Compressor
- Опция `preprocess: true` для включения
- **Файл:** `src/lib/merge-audio-to-wav.ts`

## ✅ Блок 3: Keywords API (Nova-2) — ГОТОВО
- Edge function поддерживает `keywords=word:intensity`
- Данные в `system_config` как `keywords_boost_[lang]`
- **UI:** `src/components/KeywordsBoostSettings.tsx`
- Доступно в Settings → Deepgram

## ✅ Блок 4: Find & Replace — ГОТОВО
- Edge function поддерживает `replace=pattern:replacement`
- Данные в `system_config` как `transcription_replace_[lang]`
- **UI:** `src/components/TranscriptionReplacements.tsx`
- Доступно в Settings → Deepgram

## ✅ Блок 5: Качественный ресемплинг — ГОТОВО
- `OfflineAudioContext` вместо nearest-neighbor
- Встроенный anti-aliasing браузера
- **Файл:** `src/lib/merge-audio-to-wav.ts`

---

## ⏳ Оставшиеся задачи (Низкий приоритет)

### Блок 6: Серверное шумоподавление (FFmpeg)
- **Статус:** Опционально
- Требует Edge Function с FFmpeg WASM
- Для очень плохих записей колл-центров

### Блок 7: Индикатор качества с рекомендациями
- **Статус:** Желательно
- Расширить `AudioQualityIndicator.tsx`
- Анализ шума ДО загрузки

---

## Изменённые файлы

| Файл | Изменения |
|------|-----------|
| `src/lib/merge-audio-to-wav.ts` | 16 kHz, OfflineAudioContext, preprocessing |
| `src/lib/upload-and-transcribe.ts` | Комментарии |
| `supabase/functions/deepgram-transcribe/index.ts` | Keywords + Replace API |
| `src/components/KeywordsBoostSettings.tsx` | **Новый** |
| `src/components/TranscriptionReplacements.tsx` | **Новый** |
| `src/pages/Settings.tsx` | Интеграция компонентов |

---

## Ожидаемый эффект

| Улучшение | Источник |
|-----------|----------|
| +10-15% | 16 kHz вместо 8 kHz |
| +3-5% | Качественный ресемплинг |
| +5-10% | Preprocessing на шумных записях |
| Терминология | Keywords Boost для Nova-2 |
| Автокоррекция | Find & Replace API |

---

## Инструкции по использованию

### Keywords Boost (Nova-2: pl, ru, uk, etc.)
1. Settings → Deepgram → Keywords Boost
2. Формат: `слово:интенсивность` (-10 до 10)
3. Пример: `LLB Alpha:10, Revolut:5, консультант:8`

### Auto-Replace (все языки)
1. Settings → Deepgram → Auto-Replace
2. Формат: `ошибка:правильно`
3. Пример: `LLB Alfa:LLB Alpha, Ревелут:Revolut`

### Preprocessing (при мердже)
```typescript
const result = await mergeAudioFilesTo8kWav(files, {
  preprocess: true,   // Фильтры + компрессия
  normalizePeak: true // По умолчанию включено
});
```
