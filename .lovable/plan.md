

# План исправления проблем VoiceQC

## Проблема 1: Регистрация пользователей не работает

### Диагноз
Edge function `verify-passcode` падает с ошибкой `SyntaxError: Unexpected end of JSON input` из-за **двойной JSON сериализации** в клиентском коде.

### Причина
В файле `src/store/authStore.ts` строка 152-154:
```typescript
const { data, error } = await supabase.functions.invoke('verify-passcode', {
  body: JSON.stringify({ passcode }),  // ❌ ОШИБКА: двойная сериализация
  headers: { 'Content-Type': 'application/json' }
});
```

Метод `supabase.functions.invoke` автоматически конвертирует объект body в JSON. Ручной вызов `JSON.stringify()` создаёт строку `"{\"passcode\":\"...\"}"`, которую edge function не может распарсить.

### Решение
Изменить на:
```typescript
const { data, error } = await supabase.functions.invoke('verify-passcode', {
  body: { passcode }  // ✅ передаём объект напрямую
});
```

### Файл для изменения
- `src/store/authStore.ts` — строки 152-155

---

## Проблема 2: Пустая транскрипция (0 utterances)

### Диагноз
Логи показывают:
- Deepgram обработал аудио (20.51 сек, 0.31 MB)
- Вернул `Has transcript: true`, `Has utterances: true`
- Но `Utterance count: 0`, `Transcript length: 0 characters`

### Возможные причины
1. Аудио содержит только тишину или нераспознаваемый шум
2. Проблема с мерджингом аудио (8 kHz sample rate слишком низкий)
3. Исходный файл повреждён

### Рекомендации (не в этом плане)
- Проверить исходный аудио файл вручную
- Рассмотреть увеличение sample rate до 16 kHz (см. предыдущий план улучшений)
- Добавить валидацию: если транскрипция пустая, показывать предупреждение пользователю

---

## Проблема 3: Создание тестового пользователя

### Текущая архитектура
Система уже правильно настроена для разделения доступа:

1. **Таблица `profiles`** — создаётся автоматически через trigger `handle_new_user`
   - Новые пользователи получают `role: 'supervisor'` по умолчанию
   
2. **Таблица `user_roles`** — хранит роли отдельно (admin/supervisor)
   - Используется функция `has_role()` для проверки

3. **RLS политики на `dialogs`:**
   - Supervisor: `auth.uid() = user_id` — видит только свои диалоги
   - Admin: `get_current_user_role() = 'admin'` — видит все диалоги

### Что нужно сделать
После исправления проблемы #1:

1. **Зарегистрировать тестового пользователя через UI:**
   - Перейти на `/auth`
   - Вкладка "Sign Up"
   - Ввести email, пароль, имя
   - Passcode: `QC2025!`

2. **Подтвердить email** (если включено в Supabase)

3. **Пользователь автоматически получит:**
   - Запись в `profiles` с `role: 'supervisor'`
   - Запись в `user_roles` с `role: 'supervisor'`
   - Доступ только к своим диалогам

### Альтернатива: Создать через Admin Dashboard
Если вы залогинены как admin, можно создать пользователя через:
- `/admin-dashboard` → раздел управления пользователями
- Это использует edge function `admin-operations` с service role

---

## Технический план изменений

### Шаг 1: Исправить двойную сериализацию JSON

**Файл:** `src/store/authStore.ts`

**Текущий код (строки 147-155):**
```typescript
verifyPasscode: async (passcode: string) => {
  try {
    console.log('Security Event: Passcode verification request initiated');
    
    const { data, error } = await supabase.functions.invoke('verify-passcode', {
      body: JSON.stringify({ passcode }),
      headers: { 'Content-Type': 'application/json' }
    });
```

**Исправленный код:**
```typescript
verifyPasscode: async (passcode: string) => {
  try {
    console.log('Security Event: Passcode verification request initiated');
    
    const { data, error } = await supabase.functions.invoke('verify-passcode', {
      body: { passcode }
    });
```

### Ожидаемый результат
- Регистрация новых пользователей начнёт работать
- Edge function получит корректный JSON `{ "passcode": "..." }`
- Passcode будет верифицирован успешно

---

## Краткое резюме

| Проблема | Причина | Решение | Сложность |
|----------|---------|---------|-----------|
| Регистрация не работает | Двойная JSON сериализация | Убрать `JSON.stringify()` | Низкая (1 строка) |
| Пустая транскрипция | Проблема с исходным аудио | Проверить файл, увеличить sample rate | Средняя |
| Создать тестового пользователя | — | Использовать UI после фикса #1 | — |

