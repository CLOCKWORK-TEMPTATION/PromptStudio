# Meta-Prompting Templates Feature

## نظرة عامة (Overview)

تتيح ميزة **Meta-Prompting Templates** توليد تعليمات ديناميكية حسب:
- **الشخصية (Persona)**: دور المساعد الذكي (مثل: خبير تقني، كاتب إبداعي، محلل بيانات)
- **المجال (Domain)**: مجال الخبرة (مثل: تطوير البرمجيات، علم البيانات، التسويق)
- **القيود الزمنية (Time Constraints)**: عمق الاستجابة (عاجل، قياسي، شامل)

The **Meta-Prompting Templates** feature enables dynamic instruction generation based on:
- **Persona**: The AI assistant's role (e.g., Technical Expert, Creative Writer, Data Analyst)
- **Domain**: Area of expertise (e.g., Software Development, Data Science, Marketing)
- **Time Constraints**: Response depth (Urgent, Standard, Comprehensive)

---

## الميزات الرئيسية (Key Features)

### 1. تثبيت التعليمات للجلسة (Session-Fixed Instructions)
- يتم توليد التعليمات مرة واحدة لكل جلسة
- تبقى ثابتة طوال الجلسة لضمان الاتساق
- يتم التخزين المؤقت لمدة ساعة واحدة

Instructions are generated once per session, remain consistent throughout, and are cached for one hour.

### 2. اختيار الشخصية (Persona Selection)
الشخصيات المتاحة:
- Technical Expert (خبير تقني)
- Creative Writer (كاتب إبداعي)
- Data Analyst (محلل بيانات)
- Product Manager (مدير منتج)
- Teacher (معلم)
- Researcher (باحث)
- Business Consultant (مستشار أعمال)
- Marketing Specialist (أخصائي تسويق)

### 3. اختيار المجال (Domain Selection)
المجالات المتاحة:
- Software Development
- Data Science
- Machine Learning
- Business Strategy
- Content Creation
- Education
- Healthcare
- Finance
- Legal
- Science & Research

### 4. القيود الزمنية (Time Constraints)

#### 🔴 عاجل (Urgent)
- استجابة مختصرة ومباشرة
- التركيز على العناصر الفورية
- الأولوية للسرعة والوضوح

Quick, concise responses focusing on immediate actions.

#### 🟡 قياسي (Standard)
- استجابة متوازنة
- شرح واضح مع إرشادات عملية
- التوازن بين التفاصيل والسرعة

Balanced responses with clear explanations and practical guidance.

#### 🟢 شامل (Comprehensive)
- استجابة تفصيلية ومتعمقة
- سياق واسع مع أمثلة
- استكشاف الحالات الطرفية والنهج البديلة

Thorough, detailed responses with extensive context and examples.

---

## كيفية الاستخدام (Usage)

### في المحرر (In the Editor)

1. افتح علامة تبويب **Meta** في الشريط الجانبي
2. قم بتفعيل Meta-Prompting
3. اختر الشخصية والمجال
4. حدد عمق الاستجابة (عاجل/قياسي/شامل)
5. ستظهر التعليمات المولدة في معاينة

Steps:
1. Open the **Meta** tab in the sidebar
2. Enable Meta-Prompting
3. Select persona and domain
4. Choose response depth
5. View generated instructions in the preview

### في القوالب (With Templates)

```typescript
import { applyMetaPromptingToTemplate } from './services/templateService';

// Apply meta-prompting to a template
const enhancedContent = applyMetaPromptingToTemplate(template, {
  persona: 'Technical Expert',
  domain: 'Software Development',
  timeConstraint: 'comprehensive',
});
```

---

## البنية التقنية (Technical Architecture)

### Backend

**Database Schema** (`MarketplacePrompt` model):
```prisma
persona         String?
domain          String?
timeConstraint  String?  // "urgent", "standard", "comprehensive"
metaInstructions Json?
```

**Service** (`backend/src/services/PromptService.ts`):
- `generateMetaPrompt()`: توليد التعليمات الأساسية
- `generateSessionMetaPrompt()`: توليد وتخزين مؤقت للجلسة
- `clearSessionMetaPrompt()`: مسح ذاكرة التخزين المؤقت

**API Endpoints**:
```
POST /api/prompts/generate-meta
POST /api/prompts/generate-session-meta
DELETE /api/prompts/session-meta/:sessionId
```

### Frontend

**Store** (`src/stores/editorStore.ts`):
```typescript
interface EditorState {
  metaPromptConfig: MetaPromptConfig;
  sessionMetaPrompt: string | null;
  metaPromptEnabled: boolean;
  generateSessionMetaPrompt: (sessionId: string) => Promise<void>;
}
```

**Components**:
- `MetaPromptingPanel`: واجهة التحكم
- Integrated in `EditorView` as "meta" tab

---

## أمثلة (Examples)

### مثال 1: خبير تقني + تطوير البرمجيات + شامل

**Configuration:**
```json
{
  "persona": "Technical Expert",
  "domain": "Software Development",
  "timeConstraint": "comprehensive"
}
```

**Generated Instructions:**
```
You are acting as a Technical Expert. You are an expert in the Software Development domain. Provide a thorough, detailed response with extensive context, examples, and considerations. Take time to explore edge cases and alternative approaches.
```

### مثال 2: معلم + تعليم + قياسي

**Configuration:**
```json
{
  "persona": "Teacher",
  "domain": "Education",
  "timeConstraint": "standard"
}
```

**Generated Instructions:**
```
You are acting as a Teacher. You are an expert in the Education domain. Provide a balanced response with clear explanations and practical guidance.
```

---

## الفوائد (Benefits)

✅ **اتساق أسلوبي**: نفس الأسلوب طوال الجلسة
✅ **تخصيص ديناميكي**: تعليمات مخصصة لكل حالة استخدام
✅ **كفاءة الأداء**: تخزين مؤقت يقلل من العمليات المتكررة
✅ **سهولة الاستخدام**: واجهة بسيطة وواضحة
✅ **مرونة**: دعم تعليمات إضافية مخصصة

- ✅ **Style Consistency**: Same tone throughout the session
- ✅ **Dynamic Customization**: Tailored instructions for each use case
- ✅ **Performance**: Caching reduces redundant operations
- ✅ **Ease of Use**: Simple, intuitive interface
- ✅ **Flexibility**: Support for custom additional instructions

---

## التطوير المستقبلي (Future Enhancements)

🔮 **Planned Features:**
- تعليمات مخصصة متقدمة (Advanced custom instructions)
- قوالب محفوظة للمستخدمين (User-saved templates)
- تقييم جودة الاستجابة (Response quality evaluation)
- A/B testing للتعليمات (A/B testing for instructions)
- دعم لغات متعددة (Multi-language support)

---

## الدعم (Support)

للمساعدة أو الإبلاغ عن مشاكل:
- GitHub Issues: [PromptStudio Issues](https://github.com/mohamedaminradyahmed-netizen/PromptStudio/issues)
- Documentation: `/docs`

For assistance or to report issues:
- GitHub Issues
- Documentation folder
