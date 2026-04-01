

# Две задачи

## 1. Автоматическая валидация диаризации после транскрипции

**Суть:** После сохранения speaker utterances в БД — автоматически вызвать `diarization-fix` edge function и применить коррекции без участия пользователя (без модального окна).

**Изменения:**

| # | Файл | Что |
|---|------|-----|
| 1 | `src/pages/Upload.tsx` | После `saveSpeakerTranscription` (строка 201) добавить вызов `diarization-fix` → получить corrected_utterances → вызвать `databaseService.updateUtteranceSpeakers()` для применения коррекций. Добавить toast уведомление о результате. |
| 2 | `src/components/EnhancedSpeakerDialog.tsx` | Убрать импорт и использование `ValidateDiarizationButton` (строка 12, 215) |

**Логика в Upload.tsx** (после строки 201):
```text
1. Получить transcription_id из saveSpeakerTranscription
2. supabase.functions.invoke('diarization-fix', { body: { utterances } })
3. Если needs_correction === true:
   - Построить corrections из corrected_utterances
   - databaseService.updateUtteranceSpeakers(transcriptionId, corrections)
   - toast.success("Diarization corrected")
4. Если ошибка — toast.warn, не блокировать основной процесс
```

Ошибки валидации НЕ должны блокировать завершение диалога — wrap в try/catch с warning.

## 2. Автопереход на вкладку Results после AI Analysis

**Проблема:** `useDialogNavigation` читает `?tab=` из URL только при первом рендере (useState initializer). Когда `useEvaluateDialog` делает `navigate(/dialog/id?tab=results)`, URL обновляется, но state `currentTab` не обновляется.

**Исправление:**

| # | Файл | Что |
|---|------|-----|
| 1 | `src/hooks/useDialogNavigation.ts` | Добавить `useEffect` который слушает изменения `searchParams.get('tab')` и обновляет `currentTab` |

```text
useEffect(() => {
  const tab = searchParams.get('tab');
  if (tab) setCurrentTab(tab);
}, [searchParams]);
```

## Файлы для удаления (опционально)
- `src/components/ValidateDiarizationButton.tsx` — больше не используется
- `src/components/DiarizationResultsModal.tsx` — больше не используется (модальное окно для ручного просмотра)

