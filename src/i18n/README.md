# نظام الترجمة (i18n)

## الاستخدام

### 1. إضافة LanguageProvider في التطبيق

```tsx
import { LanguageProvider } from './i18n';

function App() {
  return (
    <LanguageProvider defaultLanguage="en">
      {/* Your app components */}
    </LanguageProvider>
  );
}
```

### 2. استخدام hook الترجمة

```tsx
import { useTranslation } from './i18n';

function MyComponent() {
  const { t, language, setLanguage, dir } = useTranslation();

  return (
    <div dir={dir}>
      <h1>{t('editor.title')}</h1>
      <p>{t('editor.prompt')}</p>
      
      {/* مع معاملات */}
      <p>{t('validation.minLength', { min: 5 })}</p>
      
      {/* تبديل اللغة */}
      <button onClick={() => setLanguage('ar')}>العربية</button>
      <button onClick={() => setLanguage('en')}>English</button>
    </div>
  );
}
```

### 3. استخدام مكون LanguageSwitcher

```tsx
import { LanguageSwitcher } from './components/LanguageSwitcher';

function Header() {
  return (
    <header>
      <LanguageSwitcher theme="dark" />
    </header>
  );
}
```

## إضافة ترجمات جديدة

### في `src/i18n/ar.ts`:
```typescript
export const ar = {
  mySection: {
    title: 'العنوان',
    description: 'الوصف',
  },
};
```

### في `src/i18n/en.ts`:
```typescript
export const en = {
  mySection: {
    title: 'Title',
    description: 'Description',
  },
};
```

## الميزات

- ✅ دعم العربية والإنجليزية
- ✅ RTL/LTR تلقائي
- ✅ حفظ اللغة في localStorage
- ✅ معاملات ديناميكية في النصوص
- ✅ Type-safe مع TypeScript
- ✅ مكون تبديل اللغة جاهز

## مفاتيح الترجمة المتاحة

- `common.*` - نصوص عامة
- `nav.*` - التنقل
- `editor.*` - المحرر
- `providers.*` - مزودي AI
- `models.*` - النماذج
- `templates.*` - القوالب
- `marketplace.*` - السوق
- `history.*` - السجل
- `settings.*` - الإعدادات
- `validation.*` - التحقق
- `messages.*` - الرسائل
- `tooltips.*` - التلميحات
- `presets.*` - الإعدادات المسبقة
