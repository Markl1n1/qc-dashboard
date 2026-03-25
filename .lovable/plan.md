# Две задачи

## 1. Кнопка "Copy ID" между Validate Diarization и Copy Dialog

Добавить кнопку в `src/components/EnhancedSpeakerDialog.tsx` (строка 215-219) между `ValidateDiarizationButton` и кнопкой "Copy Dialog". Кнопка копирует `dialogId` в буфер обмена.

**Файл:** `src/components/EnhancedSpeakerDialog.tsx` — добавить кнопку с иконкой `Hash` между строками 215 и 216.

## 2. Модель GPT для анализа

Сейчас используется `**gpt-5-mini**` (OpenAI) через прямой вызов `api.openai.com`. Это задано в двух местах:


| Файл                                                     | Строка | Значение                |
| -------------------------------------------------------- | ------ | ----------------------- |
| `src/hooks/useDialogAnalysis.ts`                         | 20     | `modelId: 'gpt-5-mini'` |
| `supabase/functions/openai-evaluate-background/index.ts` | 72     | default `'gpt-5-mini'`  |


Доступные модели OpenAI для замены - gpt-5.4-mini