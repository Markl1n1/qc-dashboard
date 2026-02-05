
# План: Исправление обрезания длинных диалогов (лимит 1000 строк PostgREST)

## Диагноз

**Причина проблемы:**
- Supabase PostgREST по умолчанию возвращает максимум **1000 строк** в одном запросе
- В диалоге `4c4df69f-6f7f-4848-af19-156b38867391` есть **1205 реплик** (до 59:58)
- Без явного `.limit()` или пагинации, API возвращает только первые 1000 (до 48:58)
- Реплики с индексами 1000-1204 (от 49:00 до 59:58) не загружаются

**Доказательства:**
| Метрика | Значение |
|---------|----------|
| Реплик в БД | 1205 |
| Последняя реплика (#1204) | 59:58 |
| Реплика #999 | 48:58 — **это то, что видит пользователь** |

---

## Решение

Добавить **пагинацию** в метод `getUtterances` для загрузки всех реплик, даже если их больше 1000.

### Файл: `src/services/databaseService.ts`

**Текущий код (строки 303-312):**
```typescript
async getUtterances(transcriptionId: string): Promise<DatabaseUtterance[]> {
  const { data, error } = await supabase
    .from('dialog_speaker_utterances')
    .select('*')
    .eq('transcription_id', transcriptionId)
    .order('utterance_order', { ascending: true });

  if (error) throw error;
  return (data || []) as DatabaseUtterance[];
}
```

**Новый код с пагинацией:**
```typescript
async getUtterances(transcriptionId: string): Promise<DatabaseUtterance[]> {
  const PAGE_SIZE = 1000;
  const allUtterances: DatabaseUtterance[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('dialog_speaker_utterances')
      .select('*')
      .eq('transcription_id', transcriptionId)
      .order('utterance_order', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const batch = (data || []) as DatabaseUtterance[];
    allUtterances.push(...batch);

    // Если получили меньше PAGE_SIZE записей, значит достигли конца
    hasMore = batch.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  return allUtterances;
}
```

---

## Как это работает

```text
┌──────────────────────────────────────────┐
│         getUtterances(transcriptionId)   │
├──────────────────────────────────────────┤
│ 1) Запрос .range(0, 999) → 1000 записей  │
│    ↓                                     │
│ 2) batch.length === 1000 → hasMore=true  │
│    ↓                                     │
│ 3) Запрос .range(1000, 1999) → 205 записей│
│    ↓                                     │
│ 4) batch.length < 1000 → hasMore=false   │
│    ↓                                     │
│ 5) return allUtterances (1205 записей)   │
└──────────────────────────────────────────┘
```

---

## Итог изменений

| Файл | Изменение |
|------|-----------|
| `src/services/databaseService.ts` | Добавить пагинацию в `getUtterances` (строки 303-312) |

**Результат:** Все 1205 реплик загрузятся, и пользователь увидит диалог до конца (59:58).
