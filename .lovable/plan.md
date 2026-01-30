
# План исправления build-ошибок и изоляции агентов

## Часть 1: Исправление TypeScript ошибок в Edge Functions

### Анализ ошибок
Все 19 ошибок относятся к двум типам:

1. **TS18046: 'error' is of type 'unknown'** (17 ошибок)
   - В catch-блоках TypeScript требует явную типизацию error
   - Файлы: `admin-operations`, `dialog-cleanup`, `openai-evaluate-background`, `openai-evaluate`

2. **TS2345/TS2769/TS2454: Проблемы с типами в deepgram-transcribe** (3 ошибки)
   - `storageFile` может быть undefined — нужна проверка
   - `audioBuffer` используется до присвоения
   - `Uint8Array` не соответствует ожидаемому типу body

### Решение

**Паттерн для типизации error:**
```typescript
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return new Response(
    JSON.stringify({ error: errorMessage }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

### Файл 1: `supabase/functions/admin-operations/index.ts`

**Изменения (строки с ошибками: 146, 185, 222, 253, 355, 387, 427, 452, 480):**

| Строка | Было | Стало |
|--------|------|-------|
| 143 | `} catch (error) {` | `} catch (error: unknown) {` |
| 146 | `error: error.message` | `error: error instanceof Error ? error.message : String(error)` |
| 182 | `} catch (error) {` | `} catch (error: unknown) {` |
| 185 | `error: error.message` | `error: error instanceof Error ? error.message : String(error)` |
| 219 | `} catch (error) {` | `} catch (error: unknown) {` |
| 222 | `error: error.message` | `error: error instanceof Error ? error.message : String(error)` |
| 250 | `} catch (error) {` | `} catch (error: unknown) {` |
| 253 | `error: error.message` | `error: error instanceof Error ? error.message : String(error)` |
| 352 | `} catch (error) {` | `} catch (error: unknown) {` |
| 355 | `error: error.message` | `error: error instanceof Error ? error.message : String(error)` |
| 384 | `} catch (error) {` | `} catch (error: unknown) {` |
| 387 | `error: error.message` | `error: error instanceof Error ? error.message : String(error)` |
| 424 | `} catch (error) {` | `} catch (error: unknown) {` |
| 427 | `error: error.message` | `error: error instanceof Error ? error.message : String(error)` |
| 449 | `} catch (error) {` | `} catch (error: unknown) {` |
| 452 | `error: error.message` | `error: error instanceof Error ? error.message : String(error)` |
| 477 | `} catch (error) {` | `} catch (error: unknown) {` |
| 480 | `error: error.message` | `error: error instanceof Error ? error.message : String(error)` |

---

### Файл 2: `supabase/functions/deepgram-transcribe/index.ts`

**Проблема 1 (строка 230):** `storageFile` может быть `undefined`
```typescript
// Было:
.createSignedUrl(storageFile, 3600);

// Стало (storageFile уже проверен в if выше):
.createSignedUrl(storageFile!, 3600);
```

**Проблема 2 (строки 103, 266, 379):** `audioBuffer` не инициализирован корректно
```typescript
// Строка 103 - изменить:
let audioBuffer: Uint8Array | null = null;

// Строка 266 - изменить:
body: new Blob([audioBuffer!]).stream(),
// Или альтернативно:
body: audioBuffer!.buffer,

// Строка 379 - изменить:
const fileSizeBytes = audioBuffer?.length ?? 0;
```

---

### Файл 3: `supabase/functions/dialog-cleanup/index.ts`

**Изменение (строка 219-222):**
```typescript
} catch (error: unknown) {
  console.error('Dialog cleanup error:', error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  return new Response(
    JSON.stringify({ error: errorMessage }),
```

---

### Файл 4: `supabase/functions/openai-evaluate-background/index.ts`

**Изменение 1 (строка 97-98):**
```typescript
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.warn('⚠️ Could not load AI instructions from storage, using default prompt:', errorMessage);
}
```

**Изменение 2 (строка 282-284):**
```typescript
} catch (utterErr: unknown) {
  const errMsg = utterErr instanceof Error ? utterErr.message : String(utterErr);
  console.warn('⚠️ Error while updating dialog_speaker_utterances:', errMsg);
}
```

**Изменение 3 (строка 300-304):**
```typescript
} catch (error: unknown) {
  console.error('❌ AI analysis failed:', error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  return new Response(
    JSON.stringify({ 
      error: errorMessage,
```

---

### Файл 5: `supabase/functions/openai-evaluate/index.ts`

**Изменение (строки 224-231):**
```typescript
} catch (error: unknown) {
  console.error('❌ Error in evaluate function:', error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  console.error('❌ Error stack:', errorStack);
  return new Response(
    JSON.stringify({ 
      error: errorMessage,
      details: errorStack,
```

---

## Часть 2: Изоляция агентов между аккаунтами Supervisor

### Текущее состояние

Таблица `agents` имеет RLS-политики:
- `SELECT`: Все аутентифицированные пользователи видят всех агентов
- `INSERT/UPDATE/DELETE`: Только создатель (`auth.uid() = user_id`)

### Проблема
Supervisor видит агентов, созданных другими пользователями. Нужна изоляция.

### Архитектура решения

```
┌────────────────────────────────────────────────────────────────┐
│                      agents table                               │
├────────────────────────────────────────────────────────────────┤
│  RLS Policies (обновлённые):                                   │
│                                                                │
│  SELECT:                                                       │
│    - Admin: видит ВСЕ агенты (has_role(auth.uid(), 'admin'))  │
│    - Supervisor: только свои (auth.uid() = user_id)           │
│                                                                │
│  INSERT: auth.uid() = user_id (без изменений)                 │
│  UPDATE: auth.uid() = user_id (без изменений)                 │
│  DELETE: auth.uid() = user_id (без изменений)                 │
└────────────────────────────────────────────────────────────────┘
```

### SQL миграция

```sql
-- Удалить старую политику SELECT для authenticated
DROP POLICY IF EXISTS "Authenticated users can view agents" ON public.agents;

-- Создать новые политики SELECT
-- 1. Supervisors видят только свои агенты
CREATE POLICY "Users can view their own agents"
  ON public.agents FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Admins видят всех агентов
CREATE POLICY "Admins can view all agents"
  ON public.agents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));
```

### Влияние на код

**Файл: `src/services/agentService.ts`**
- Никаких изменений не требуется! 
- Запрос `getAgents()` автоматически будет фильтроваться через RLS
- Admin увидит всех агентов, Supervisor — только своих

**Файл: `src/pages/AgentManagement.tsx`**
- Никаких изменений
- UI остаётся прежним, RLS делает фильтрацию на уровне БД

---

## Итоговый план изменений

| # | Файл | Тип изменения | Описание |
|---|------|---------------|----------|
| 1 | `admin-operations/index.ts` | Исправление TS | Типизация error в 9 catch-блоках |
| 2 | `deepgram-transcribe/index.ts` | Исправление TS | Исправить audioBuffer и storageFile |
| 3 | `dialog-cleanup/index.ts` | Исправление TS | Типизация error в 1 catch-блоке |
| 4 | `openai-evaluate-background/index.ts` | Исправление TS | Типизация error в 3 местах |
| 5 | `openai-evaluate/index.ts` | Исправление TS | Типизация error в 1 catch-блоке |
| 6 | SQL миграция | RLS политика | Изоляция агентов по user_id |

---

## Ожидаемый результат

После применения изменений:
1. **Build успешен** — все TypeScript ошибки исправлены
2. **Supervisor видит только своих агентов** — RLS фильтрует на уровне БД
3. **Admin видит всех агентов** — через отдельную RLS политику
4. **Никаких изменений в UI** — изоляция прозрачна для фронтенда
