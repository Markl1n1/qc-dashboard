

# Validate Diarization: текущее состояние и возможные улучшения

## Что сейчас делает кнопка

1. Отправляет все utterances диалога в edge function `diarization-fix`
2. GPT (4o или 4o-mini для >80 utterances) анализирует и переназначает спикеров (Agent/Customer)
3. Результат скачивается как `.txt` файл
4. **Коррекция НЕ сохраняется в базу** — только файл на скачивание

## Проблемы

| Проблема | Описание |
|----------|----------|
| Результат не применяется | Коррекция только в .txt, не обновляет utterances в БД |
| Нет визуального превью | Пользователь не видит что изменилось до скачивания |
| Лимит utterances | Для диалогов >200 utterances GPT может обрезать labels (уже есть padding, но ненадёжно) |
| Только для админов | Супервайзеры не могут использовать |

## Предлагаемые улучшения

### 1. Применение коррекции в БД (главное улучшение)

После получения `corrected_utterances` от GPT — обновить `dialog_speaker_utterances` в базе, заменив speaker labels. Добавить кнопку "Apply corrections" в UI вместо автоматического скачивания.

### 2. Превью результатов в модальном окне

Вместо скачивания .txt — показать модальное окно с:
- Статистикой (needs_correction, confidence, analysis)
- Таблицей маппинга спикеров
- Превью исправленного диалога (с подсветкой изменений)
- Кнопками: "Apply to dialog" / "Download .txt" / "Cancel"

### 3. Батчинг для длинных диалогов

Для диалогов >150 utterances — разбивать на чанки по 100-120 utterances с перекрытием контекста (последние 5 utterances предыдущего чанка), отправлять параллельно, затем объединять labels.

---

## План реализации

### Файл: `src/components/ValidateDiarizationButton.tsx`
- Заменить автоскачивание на открытие модального окна с результатами
- Добавить state для хранения результатов валидации
- Добавить кнопку "Apply corrections" которая обновляет utterances в БД через `databaseService`

### Новый файл: `src/components/DiarizationResultsModal.tsx`
- Модальное окно с превью результатов:
  - Speaker mapping таблица
  - Confidence / analysis
  - Список utterances с подсветкой изменённых спикеров (было → стало)
  - Кнопки действий: Apply / Download / Cancel

### Файл: `src/services/databaseService.ts`
- Добавить метод `updateUtteranceSpeakers(transcriptionId, corrections)` — batch update speaker labels в `dialog_speaker_utterances`

### Файл: `supabase/functions/diarization-fix/index.ts`
- Добавить батчинг: если utterances > 150, разбить на чанки и обработать параллельно
- Объединить labels из всех чанков в один массив

| Файл | Изменение |
|------|-----------|
| `src/components/ValidateDiarizationButton.tsx` | Модальное окно вместо скачивания, кнопка Apply |
| `src/components/DiarizationResultsModal.tsx` | Новый компонент превью результатов |
| `src/services/databaseService.ts` | Метод `updateUtteranceSpeakers` |
| `supabase/functions/diarization-fix/index.ts` | Батчинг для длинных диалогов |

