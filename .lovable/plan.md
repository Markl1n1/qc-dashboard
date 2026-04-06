

# Интернационализация (EN/RU) + удаление блоков

## Задача 1: Удалить блоки из Admin Dashboard

**Файл:** `src/pages/AdminDashboard.tsx`
- Удалить карточку "System Configuration" (строки 110-123)
- Удалить карточку "Password Management" (строки 75-101)

## Задача 2: Система переводов

### Подход
Легковесная система на базе Zustand (уже есть `languageStore.ts`) + JSON-словари. Без тяжёлых библиотек (react-i18next не нужен для 2 языков).

### Новые файлы

| Файл | Назначение |
|------|-----------|
| `src/i18n/translations/en.ts` | Словарь EN — все строки интерфейса |
| `src/i18n/translations/ru.ts` | Словарь RU — русские переводы |
| `src/i18n/useTranslation.ts` | Хук `useTranslation()` → возвращает функцию `t('key')` |
| `src/i18n/index.ts` | Экспорт |

### Обновление languageStore.ts
Расширить store: `uiLanguage: 'en' | 'ru'` + `setUiLanguage(...)`, persist в localStorage.

### Переключатель языка
**Файл:** `src/components/AppSidebar.tsx` — добавить иконку `Languages` (из lucide) справа от логотипа VoiceQC в header. Клик переключает EN↔RU.

### Файлы для перевода (основные страницы и компоненты)

Все hardcoded строки заменяются на `t('key')`:

| Файл | Примеры строк |
|------|--------------|
| `src/components/AppSidebar.tsx` | Dashboard, Upload, Settings, Sign Out, Theme |
| `src/pages/Upload.tsx` | Upload Audio, Agent Name, Transcribe, etc. |
| `src/pages/UnifiedDashboard.tsx` | Search, Filter, Total, Completed, Failed |
| `src/pages/DialogDetail.tsx` | Transcription, Analysis, Results, Call Quality |
| `src/pages/AdminDashboard.tsx` | User Management, Security, System Settings |
| `src/pages/Settings.tsx` | AI Analysis, System, Deepgram, AI Instructions |
| `src/pages/Auth.tsx` | Sign In, Sign Up, Email, Password |
| `src/pages/ChangePassword.tsx` | Change Password, New Password, Confirm |
| `src/pages/AgentManagement.tsx` | Agent Management |
| `src/components/EnhancedSpeakerDialog.tsx` | Copy Dialog, Copy ID, speakers |
| `src/components/CallQualityTab.tsx` | Call Quality, Signal metrics labels |
| `src/components/DialogDetailHeader.tsx` | Back, Export PDF, Analyze |
| `src/components/DialogFilters.tsx` | Filter labels |
| `src/components/LanguageSelector.tsx` | Audio Language |
| `src/components/AgentSelector.tsx` | Select Agent |
| `src/components/GenerateReportDialog.tsx` | Generate Report |
| `src/components/DataRetentionManager.tsx` | Data Retention |
| `src/components/PasscodeManager.tsx` | Passcode labels |
| `src/components/OptimizedAdminManagement.tsx` | User management strings |
| `src/components/BackgroundAnalysisIndicator.tsx` | Status labels |
| `src/components/AudioSignalQualityCard.tsx` | Metric labels |
| `src/components/KeytermManagement.tsx` | Keyterm labels |
| `src/components/DeepgramModelSettings.tsx` | Model settings labels |
| `src/components/AIInstructionsFileManager.tsx` | Instruction labels |

### Структура словаря (пример)

```text
{
  nav: { dashboard, upload, settings, agents, admin, changePassword, signOut, theme },
  upload: { title, agentName, transcribe, dropzone, ... },
  dashboard: { search, filter, total, completed, failed, ... },
  dialog: { transcription, analysis, results, callQuality, copyDialog, copyId, ... },
  auth: { signIn, signUp, email, password, ... },
  settings: { aiAnalysis, system, deepgram, instructions, save, ... },
  admin: { userManagement, security, ... },
  common: { loading, error, save, cancel, delete, ... }
}
```

### Итого
~25 файлов будут изменены + 4 новых файла для системы переводов.

