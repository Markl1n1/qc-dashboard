

# Две задачи

## 1. Применение распознанных имён спикеров вместо Agent/Customer

**Проблема:** Edge function `diarization-fix` жёстко нормализует всех спикеров в `'Agent' | 'Customer'` (функция `normalizeFinalSpeaker`, строка 52-57). Когда позже AI анализ определяет реальные имена (например "Алиса Лоснева", "Денис"), они показываются только через `useSpeakerMapping` — визуальный маппинг на клиенте, но в БД остаются "Agent"/"Customer".

**На скриншоте видно 4 спикера** — это значит, что диаризация частично сработала (Deepgram нашёл >2 спикеров), а diarization-fix поправил только часть, оставив часть как Agent/Customer и часть как имена из анализа.

**Решение:** После завершения AI анализа (который определяет speaker_0/speaker_1 и role_0/role_1), применять эти имена к utterances в БД — заменять "Agent" → реальное имя, "Customer" → реальное имя. Это делается на клиенте после получения результатов анализа.

### Изменения

| # | Файл | Что |
|---|------|-----|
| 1 | `supabase/functions/openai-evaluate-background/index.ts` | После сохранения результатов анализа — обновить speaker labels в utterances, заменяя "Agent"→speaker_0 name, "Customer"→speaker_1 name (если имена определены) |
| 2 | `src/hooks/useEvaluateDialog.ts` | После успешного анализа — вызвать `updateUtteranceSpeakers` с маппингом из speakers результата |

Логика:
1. AI анализ возвращает `speakers: [{ speaker_0: "Денис", role_0: "Agent" }, { speaker_1: "Алиса Лоснева", role_1: "Customer" }]`
2. Строим маппинг: `"Agent" → "Денис"`, `"Customer" → "Алиса Лоснева"`
3. Обновляем все utterances где speaker = "Agent" на "Денис", и "Customer" на "Алиса Лоснева"
4. Invalidate query cache для обновления UI

**Безопасность:** Применяем только если speaker_0 и speaker_1 имеют реальные имена (не пустые, не "Agent"/"Customer"). Если имён нет — оставляем как есть.

---

## 2. Анализ качества аудио при загрузке (аудио-дорожка, не текст)

**Проблема:** Текущий `call-quality-analyze` анализирует **текст utterances** (confidence, gaps, overlaps) — это анализ транскрипции, а не аудио. Уже есть `audioSignalAnalysis.ts` (Web Audio API) который считает SNR, clipping, silence, RMS — но результаты только показываются в UI при загрузке и сохраняются в `audio_quality_metrics`. Нужно интегрировать это в CallQualityTab.

**Решение:** Использовать уже имеющийся `audioSignalAnalysis.ts` — его метрики уже сохраняются в `dialogs.audio_quality_metrics`. Нужно показывать эти метрики в CallQualityTab вместо (или вместе с) текущим текстовым анализом.

### Изменения

| # | Файл | Что |
|---|------|-----|
| 1 | `src/components/CallQualityTab.tsx` | Добавить секцию "Audio Signal Quality" — читать `audio_quality_metrics` из диалога и показывать SNR, clipping, silence%, RMS, overall score |
| 2 | `src/pages/DialogDetail.tsx` | Передавать `audio_quality_metrics` в CallQualityTab |

Метрики которые уже считаются и сохраняются:
- **SNR** (Signal-to-Noise Ratio) — шум
- **Clipping %** — искажения/перегрузка
- **Silence %** — тишина/прерывания
- **RMS/Peak dB** — уровень громкости
- **Dynamic Range** — динамический диапазон
- **Overall Score** (0-100) — композитный балл

Всё это уже есть в `audioSignalAnalysis.ts` и сохраняется при загрузке. Нужно только отобразить в CallQualityTab.

### Файлы для изменения (итого)

| # | Файл | Задача |
|---|------|--------|
| 1 | `src/hooks/useEvaluateDialog.ts` | Применять имена спикеров к utterances в БД после анализа |
| 2 | `src/components/CallQualityTab.tsx` | Добавить секцию аудио-метрик из audio_quality_metrics |
| 3 | `src/pages/DialogDetail.tsx` | Передать audio_quality_metrics в CallQualityTab |

