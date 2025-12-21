<!-- markdownlint-disable MD033 -->
# 📖 دليل الاستخدام الشامل - PromptStudio

## نظرة عامة

PromptStudio هي منصة احترافية متكاملة لهندسة الـ Prompts مدعومة بالذكاء الاصطناعي، توفر إمكانيات متقدمة مثل:

- توليد SDK تلقائيًا
- النشر السحابي على منصات متعددة
- التعاون الفوري في الوقت الفعلي
- التخزين المؤقت الدلالي (Semantic Caching)
- التحسين الذكي للـ Prompts
- نظام RAG المتقدم

---

## 📑 جدول المحتويات

1. [البدء السريع](#quick-start)
2. [إدارة المستخدمين والمصادقة](#user-management)
3. [التعاون في الوقت الفعلي](#realtime-collaboration)
4. [إدارة الـ Prompts](#prompt-management)
5. [الذكاء الاصطناعي والاستدلال المتقدم](#ai-reasoning)
6. [تحسين الـ Prompts](#prompt-optimization)
7. [سلاسل الـ Prompts (Chains)](#prompt-chains)
8. [نظام RAG](#rag-system)
9. [السوق (Marketplace)](#marketplace)
10. [الأمان والجودة](#security-quality)
11. [التخزين المؤقت الدلالي](#semantic-cache)
12. [توليد SDK](#sdk-generation)
13. [النشر السحابي](#cloud-deployment)
14. [الميزات المتقدمة](#advanced-features)

---

<a id="quick-start"></a>

## 🚀 البدء السريع

### 1. تثبيت المتطلبات

```bash
# تثبيت الحزم
npm install

# إعداد قاعدة البيانات
npm run db:generate
npm run db:migrate
```

### 2. إعداد ملف البيئة (.env)

```env
# قاعدة البيانات
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/promptstudio"

# Redis للتخزين المؤقت
REDIS_URL="redis://localhost:6379"

# المصادقة
JWT_SECRET="your-super-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"

# OpenAI API
OPENAI_API_KEY="sk-your-openai-api-key"

# الإعدادات الاختيارية
FRONTEND_URL="http://localhost:3000"
PORT=3001
```

### 3. تشغيل التطبيق

```bash
# تشغيل الواجهة الأمامية (Next.js)
npm run dev

# تشغيل الخادم الخلفي (في نافذة منفصلة)
npm run backend:dev
```

الآن يمكنك الوصول إلى التطبيق عبر: `http://localhost:3000`

---

<a id="user-management"></a>

## 👤 إدارة المستخدمين والمصادقة

### التسجيل

**الطلب:**

```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "Ahmed Ali"
}
```

**الاستجابة:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Ahmed Ali",
      "color": "#FF5733"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2024-01-15T10:30:00Z"
  }
}
```

### تسجيل الدخول

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### الدخول كضيف (Guest)

للتجربة السريعة بدون تسجيل:

```bash
POST /api/auth/guest
Content-Type: application/json

{
  "name": "Guest User"
}
```

الضيف يحصل على حساب مؤقت لمدة 24 ساعة.

### الحصول على بيانات المستخدم الحالي

```bash
GET /api/auth/me
Authorization: Bearer YOUR_JWT_TOKEN
```

### تحديث الملف الشخصي

```bash
PATCH /api/auth/me
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "Ahmed Ali Updated",
  "avatar": "https://example.com/avatar.jpg",
  "color": "#00FF00"
}
```

---

<a id="realtime-collaboration"></a>

## 👥 التعاون في الوقت الفعلي

### إنشاء جلسة تعاون

```bash
POST /api/sessions
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "مشروع تطوير Chatbot",
  "description": "تطوير prompts لـ chatbot خدمة العملاء",
  "prompt": "أنت مساعد ذكي لخدمة العملاء...",
  "modelConfig": {
    "model": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 2000
  }
}
```

**الاستجابة:**

```json
{
  "success": true,
  "data": {
    "id": "session-uuid",
    "name": "مشروع تطوير Chatbot",
    "shareToken": "share_abc123xyz",
    "shareUrl": "http://localhost:3000/sessions/share/share_abc123xyz",
    "ownerId": "user-uuid",
    "createdAt": "2024-01-10T10:00:00Z"
  }
}
```

### دعوة أعضاء للجلسة

```bash
POST /api/sessions/{sessionId}/members
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "userId": "member-user-uuid",
  "role": "EDITOR"  // OWNER, EDITOR, VIEWER
}
```

### الانضمام عبر رابط المشاركة

```bash
GET /api/sessions/share/{shareToken}
```

### WebSocket - الاتصال للتحرير الفوري

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

// الانضمام للجلسة
socket.emit('join_session', { sessionId: 'session-uuid' });

// الاستماع للتعديلات
socket.on('edit', (data) => {
  console.log('تعديل جديد:', data);
  // تطبيق التعديل على المحرر
});

// إرسال تعديل
socket.emit('edit', {
  sessionId: 'session-uuid',
  operation: {
    type: 'insert',
    position: 10,
    content: 'نص جديد'
  }
});

// تتبع الحضور
socket.on('user_joined', (user) => {
  console.log(`${user.name} انضم للجلسة`);
});

socket.on('cursor_move', ({ userId, position }) => {
  // تحديث موضع مؤشر المستخدم
});
```

### إضافة تعليق

```bash
POST /api/sessions/{sessionId}/comments
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "content": "أعتقد يجب تحسين هذا الجزء",
  "position": 45,
  "selection": "أنت مساعد ذكي"
}
```

### حفظ نسخة (Snapshot)

```bash
POST /api/sessions/{sessionId}/snapshots
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "نسخة v1.0 - جاهز للإنتاج",
  "description": "النسخة المستقرة الأولى"
}
```

### استرجاع نسخة محفوظة

```bash
POST /api/sessions/{sessionId}/snapshots/{snapshotId}/restore
Authorization: Bearer YOUR_JWT_TOKEN
```

---

<a id="prompt-management"></a>

## 📝 إدارة الـ Prompts

### بناء Prompt هرمي

يمكنك بناء prompt متطور بهيكل هرمي:

```bash
POST /api/prompts/build-hierarchical
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "systemPrompt": "أنت خبير في البرمجة بلغة Python",
  "processPrompt": "حلل الكود خطوة بخطوة",
  "taskPrompt": "اكتب دالة لحساب fibonacci",
  "outputPrompt": "اعرض الكود مع شرح تفصيلي",
  "modelConfig": {
    "model": "gpt-4",
    "temperature": 0.3
  }
}
```

**الاستجابة:**

```json
{
  "success": true,
  "data": {
    "hierarchicalPrompt": "=== SYSTEM ===\nأنت خبير في البرمجة بلغة Python\n\n=== PROCESS ===\n...",
    "structure": {
      "system": "...",
      "process": "...",
      "task": "...",
      "output": "..."
    },
    "tokenEstimate": 245
  }
}
```

### توليد Meta-Prompt

Meta-prompting يساعد النموذج على فهم السياق بشكل أفضل:

```bash
POST /api/prompts/generate-meta
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "basePrompt": "اكتب مقالة عن الذكاء الاصطناعي",
  "persona": "كاتب تقني متخصص",
  "domain": "تكنولوجيا المعلومات",
  "timeConstraints": "إجابة سريعة خلال دقيقة",
  "customMeta": "استخدم أمثلة عملية"
}
```

### التحليل قبل الإرسال (Pre-Send Analysis)

قبل إرسال الـ prompt، احصل على تحليل شامل:

```bash
POST /api/prompts/analyze
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "prompt": "اشرح مفهوم الـ Blockchain بطريقة مبسطة",
  "modelConfig": {
    "model": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 1000
  }
}
```

**الاستجابة:**

```json
{
  "success": true,
  "data": {
    "tokenEstimate": {
      "input": 12,
      "estimatedOutput": 450,
      "total": 462
    },
    "costEstimate": {
      "inputCost": 0.00036,
      "outputCost": 0.0135,
      "totalCost": 0.01386,
      "currency": "USD"
    },
    "safetyCheck": {
      "isSafe": true,
      "toxicityScore": 0.02,
      "hasPII": false,
      "hasInjection": false
    },
    "successProbability": 0.92,
    "estimatedResponseTime": 8.5,
    "recommendations": [
      "الـ prompt واضح ومحدد",
      "النموذج مناسب للمهمة"
    ]
  }
}
```

---

<a id="ai-reasoning"></a>

## 🧠 الذكاء الاصطناعي والاستدلال المتقدم

### Tree-of-Thought Reasoning

استكشاف مسارات تفكير متعددة:

```bash
POST /api/reasoning/tree-of-thought
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "prompt": "كيف يمكن حل مشكلة الاحتباس الحراري؟",
  "maxDepth": 3,
  "branchingFactor": 3,
  "evaluationCriteria": ["جدوى", "تأثير", "تكلفة"]
}
```

**الاستجابة:**

```json
{
  "success": true,
  "sessionId": "reasoning-session-uuid",
  "data": {
    "result": {
      "nodes": [
        {
          "thought": "الحل 1: الطاقة المتجددة",
          "score": 0.9,
          "children": [...]
        },
        {
          "thought": "الحل 2: تقليل الانبعاثات",
          "score": 0.85,
          "children": [...]
        }
      ],
      "finalAnswer": "أفضل حل هو التركيز على الطاقة المتجددة...",
      "totalScore": 0.88
    },
    "qualityMetrics": {
      "coherence": 0.92,
      "completeness": 0.87,
      "depth": 3
    },
    "duration": 12.5
  }
}
```

### Graph-of-Thought Reasoning

استدلال قائم على العلاقات بين الأفكار:

```bash
POST /api/reasoning/graph-of-thought
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "prompt": "ما العلاقة بين الذكاء الاصطناعي والأمن السيبراني؟",
  "maxNodes": 10,
  "connectionThreshold": 0.7
}
```

### Multi-Path Reasoning

استكشاف عدة مسارات بالتوازي واختيار الأفضل:

```bash
POST /api/reasoning/multi-path-reasoning
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "prompt": "صمم معمارية نظام للتجارة الإلكترونية",
  "pathCount": 5,
  "maxDepth": 3,
  "branchingFactor": 2
}
```

### تخطيط الأدوات (Tool Planning)

تخطيط تلقائي لاستخدام الأدوات:

```bash
POST /api/prompts/plan-tools
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "task": "ابحث عن أحدث أخبار الذكاء الاصطناعي وأنشئ ملخص",
  "availableTools": [
    {
      "name": "web_search",
      "description": "البحث في الإنترنت",
      "parameters": {
        "type": "object",
        "properties": {
          "query": { "type": "string" }
        }
      }
    },
    {
      "name": "summarize",
      "description": "تلخيص نص",
      "parameters": {
        "type": "object",
        "properties": {
          "text": { "type": "string" },
          "maxLength": { "type": "number" }
        }
      }
    }
  ]
}
```

**الاستجابة:**

```json
{
  "success": true,
  "data": {
    "plan": [
      {
        "step": 1,
        "tool": "web_search",
        "reason": "نحتاج أولاً للبحث عن الأخبار",
        "parameters": {
          "query": "أحدث أخبار الذكاء الاصطناعي 2024"
        },
        "confidence": 0.95
      },
      {
        "step": 2,
        "tool": "summarize",
        "reason": "بعد الحصول على النتائج، نلخصها",
        "parameters": {
          "text": "${result_from_step_1}",
          "maxLength": 500
        },
        "confidence": 0.9,
        "dependencies": ["step_1"]
      }
    ],
    "estimatedDuration": "15 seconds"
  }
}
```

### تنفيذ خطة الأدوات

```bash
POST /api/prompts/execute-plan
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "plan": [...],  // الخطة من الطلب السابق
  "executeAll": true
}
```

---

<a id="prompt-optimization"></a>

## 🔧 تحسين الـ Prompts

### التحسين البايزي (Bayesian Optimization)

```bash
POST /api/prompts/optimize/bayesian
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "prompt": "اكتب وصف منتج جذاب",
  "testCases": [
    {
      "input": "هاتف ذكي",
      "expected": "وصف تسويقي احترافي"
    }
  ],
  "maxIterations": 10,
  "explorationWeight": 0.3
}
```

### الخوارزمية التطورية (Evolutionary Optimization)

```bash
POST /api/prompts/optimize/evolutionary
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "prompt": "ترجم النص التالي إلى الإنجليزية",
  "testCases": [
    {
      "input": "مرحباً بك في تطبيقنا",
      "expected": "Welcome to our application"
    }
  ],
  "populationSize": 10,
  "generations": 5,
  "mutationRate": 0.3
}
```

### اختبار A/B Testing

```bash
POST /api/prompts/ab-test
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "promptA": "اشرح بطريقة مبسطة",
  "promptB": "اشرح بأسلوب تقني متقدم",
  "testCases": [
    { "input": "ما هو الـ Docker؟" }
  ],
  "metrics": ["clarity", "accuracy", "engagement"]
}
```

### التحسين الذاتي (Self-Refinement)

```bash
POST /api/refinement/{promptId}/refine
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "maxIterations": 5,
  "targetMetric": "overall_quality",
  "threshold": 0.9,
  "testInput": "اشرح مفهوم الـ APIs"
}
```

**الاستجابة:**

```json
{
  "success": true,
  "data": {
    "iterations": [
      {
        "iteration": 1,
        "prompt": "النسخة الأصلية...",
        "evaluation": {
          "clarity": 0.7,
          "accuracy": 0.8,
          "overall": 0.75
        },
        "suggestions": ["أضف أمثلة", "وضح المصطلحات"]
      },
      {
        "iteration": 2,
        "prompt": "النسخة المحسنة...",
        "evaluation": {
          "clarity": 0.85,
          "accuracy": 0.9,
          "overall": 0.875
        },
        "improvement": 0.125
      }
    ],
    "finalPrompt": "النسخة النهائية المحسنة...",
    "finalScore": 0.92,
    "totalImprovement": 0.17
  }
}
```

### تجربة التحسين السريع

```bash
POST /api/prompts/experiments/quick-optimize
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "initialPrompt": "اكتب email احترافي",
  "goal": "رسالة بريد إلكتروني واضحة وموجزة",
  "testCases": [
    {
      "input": "طلب اجتماع مع المدير",
      "expected": "email رسمي ومهذب"
    }
  ],
  "maxTrials": 20,
  "targetScore": 0.85
}
```

---

<a id="prompt-chains"></a>

## ⛓️ سلاسل الـ Prompts (Chains)

### إنشاء Chain

```bash
POST /api/chains
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "تحليل المشاعر الشامل",
  "description": "تحليل النص ثم ترجمته ثم تلخيصه",
  "stages": [
    {
      "name": "تحليل المشاعر",
      "prompt": "حلل مشاعر النص التالي: {{input}}",
      "outputKey": "sentiment"
    },
    {
      "name": "الترجمة",
      "prompt": "ترجم إلى الإنجليزية: {{input}}",
      "outputKey": "translation"
    },
    {
      "name": "التلخيص",
      "prompt": "لخص النتائج: المشاعر: {{sentiment}}, الترجمة: {{translation}}",
      "outputKey": "summary"
    }
  ],
  "config": {
    "enableMemory": true,
    "maxMemoryAge": 86400000
  }
}
```

### تنفيذ Chain

```bash
POST /api/chains/{chainId}/execute
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "input": "أنا سعيد جداً بهذا المنتج الرائع!",
  "variables": {},
  "useMemory": true
}
```

**الاستجابة:**

```json
{
  "success": true,
  "data": {
    "executionId": "exec-uuid",
    "results": {
      "sentiment": "إيجابي جداً (0.95)",
      "translation": "I am very happy with this wonderful product!",
      "summary": "تعبير عن رضا شديد عن المنتج"
    },
    "duration": 5.2,
    "memoryUsed": true,
    "tokensUsed": 234,
    "cost": 0.0047
  }
}
```

### استخدام القوالب الجاهزة

```bash
POST /api/chains/templates/analysis-pipeline
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "تحليل تقارير العملاء",
  "config": {
    "analysisDepth": "detailed",
    "includeRecommendations": true
  }
}
```

### الذاكرة طويلة الأمد

تخزين السياق للاستخدام المستقبلي:

```bash
POST /api/chains/memory
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "taskType": "customer_support",
  "context": "العميل يشتكي من بطء التطبيق",
  "solution": "تم حل المشكلة بتحديث الكاش",
  "metadata": {
    "satisfaction": "عالي",
    "resolutionTime": "10 دقائق"
  }
}
```

### البحث في الذاكرة

```bash
POST /api/chains/memory/search
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "query": "مشاكل الأداء",
  "taskType": "customer_support",
  "limit": 5,
  "minRelevance": 0.7
}
```

---

<a id="rag-system"></a>

## 📚 نظام RAG (Retrieval-Augmented Generation)

### إنشاء قاعدة معرفة

```bash
POST /api/rag/knowledge-bases
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "قاعدة معرفة المنتجات",
  "description": "معلومات شاملة عن منتجاتنا",
  "config": {
    "embeddingModel": "text-embedding-3-small",
    "chunkSize": 500,
    "chunkOverlap": 50
  }
}
```

### إضافة مستندات

```bash
POST /api/rag/knowledge-bases/{knowledgeBaseId}/documents
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "documents": [
    {
      "title": "دليل المستخدم - المنتج A",
      "content": "المنتج A هو حل متكامل...",
      "source": "user-manual.pdf",
      "trustScore": 1.0,
      "metadata": {
        "category": "documentation",
        "version": "2.0"
      }
    }
  ]
}
```

### الاستعلام مع RAG

```bash
POST /api/rag/knowledge-bases/{knowledgeBaseId}/retrieve
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "query": "كيف أستخدم ميزة X في المنتج A؟",
  "topK": 5,
  "minSimilarity": 0.7
}
```

**الاستجابة:**

```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "title": "دليل المستخدم - المنتج A",
        "content": "لاستخدام ميزة X...",
        "similarity": 0.92,
        "trustScore": 1.0,
        "source": "user-manual.pdf"
      }
    ],
    "totalFound": 5
  }
}
```

### بناء Prompt معزز بـ RAG

```bash
POST /api/rag/build-prompt
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "knowledgeBaseId": "kb-uuid",
  "query": "اشرح كيفية استخدام ميزة X",
  "systemPrompt": "أنت مساعد تقني متخصص",
  "maxContextLength": 2000,
  "includeSourceAttribution": true
}
```

### RAG المتكيف (Adaptive RAG)

استرجاع ذكي مع تعديل ديناميكي للسياق:

```bash
POST /api/rag/adaptive/retrieve
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "knowledgeBaseId": "kb-uuid",
  "query": "مشكلة في الدفع الإلكتروني",
  "maxContextLength": 3000,
  "prioritizeRecent": true,
  "trustThreshold": 0.8,
  "diversityWeight": 0.3
}
```

### تسجيل مصادر موثوقة

```bash
POST /api/rag/adaptive/trusted-sources
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "knowledgeBaseId": "kb-uuid",
  "sourcePattern": "official-docs/*",
  "trustLevel": 1.0,
  "expiresAt": "2025-12-31"
}
```

---

<a id="marketplace"></a>

## 🛍️ السوق (Marketplace)

### نشر Prompt في السوق

```bash
POST /api/marketplace/prompts
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "title": "مولد محتوى تسويقي احترافي",
  "description": "يولد محتوى تسويقي جذاب للمنتجات",
  "content": "أنت خبير تسويق محترف...",
  "category": "marketing",
  "tags": ["تسويق", "محتوى", "إعلانات"],
  "systemPrompt": "أنت خبير في التسويق الرقمي",
  "taskPrompt": "اكتب محتوى جذاب عن: {{product}}",
  "modelRecommendation": "gpt-4",
  "pricing": {
    "type": "free"
  },
  "examples": [
    {
      "input": "هاتف ذكي",
      "output": "اكتشف عالماً من الإمكانيات..."
    }
  ]
}
```

### البحث في السوق

```bash
GET /api/marketplace/prompts?category=marketing&tags=تسويق&sort=trending&page=1&limit=20
Authorization: Bearer YOUR_JWT_TOKEN
```

### الحصول على Prompts الرائجة

```bash
GET /api/marketplace/prompts/trending?period=week&limit=10
Authorization: Bearer YOUR_JWT_TOKEN
```

### نسخ (Fork) Prompt

```bash
POST /api/marketplace/prompts/{promptId}/fork
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "customizations": {
    "title": "نسختي من المولد التسويقي",
    "content": "تعديلات على الـ prompt الأصلي..."
  }
}
```

### إضافة تقييم

```bash
POST /api/marketplace/prompts/{promptId}/reviews
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "rating": 5,
  "comment": "ممتاز! ساعدني كثيراً في عملي",
  "verified": true
}
```

### التصويت على التقييم

```bash
POST /api/marketplace/reviews/{reviewId}/vote
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "voteType": "helpful"  // أو "not_helpful"
}
```

---

<a id="security-quality"></a>

## 🔒 الأمان والجودة

### فحص الأمان

```bash
POST /api/prompts/safety-check
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "prompt": "النص المراد فحصه",
  "checkTypes": ["toxicity", "pii", "injection"]
}
```

**الاستجابة:**

```json
{
  "success": true,
  "data": {
    "isSafe": true,
    "toxicityScore": 0.02,
    "toxicityLabel": "safe",
    "hasPII": false,
    "piiDetected": [],
    "hasInjection": false,
    "injectionPatterns": [],
    "overallSafetyScore": 0.98,
    "recommendations": [
      "الـ prompt آمن للاستخدام"
    ]
  }
}
```

### فحص ما قبل الإطلاق

```bash
POST /api/quality/security/pre-release-check
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "promptId": "prompt-uuid",
  "environments": ["staging", "production"]
}
```

---

<a id="semantic-cache"></a>

## 💾 التخزين المؤقت الدلالي (Semantic Cache)

### تكوين الكاش

```bash
GET /api/cache/config
Authorization: Bearer YOUR_JWT_TOKEN
```

```bash
PATCH /api/cache/config
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "enabled": true,
  "ttlSeconds": 7200,
  "similarityThreshold": 0.85,
  "maxEntries": 10000
}
```

### البحث في الكاش

```bash
POST /api/cache/lookup
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "prompt": "ما هي فوائد الذكاء الاصطناعي؟",
  "modelConfig": {
    "model": "gpt-4",
    "temperature": 0.7
  },
  "similarityThreshold": 0.85
}
```

**استجابة عند وجود نتيجة مطابقة:**

```json
{
  "success": true,
  "data": {
    "hit": true,
    "entry": {
      "id": "cache-uuid",
      "prompt": "ما فوائد AI؟",
      "response": "الذكاء الاصطناعي يوفر العديد من الفوائد...",
      "similarity": 0.92,
      "createdAt": "2024-01-10T10:00:00Z",
      "tags": ["ai", "benefits"]
    },
    "tokensSaved": 450,
    "costSaved": 0.0135
  }
}
```

### تخزين في الكاش

```bash
POST /api/cache/store
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "prompt": "ما هي فوائد الذكاء الاصطناعي؟",
  "response": "الذكاء الاصطناعي يوفر فوائد عديدة...",
  "modelConfig": {
    "model": "gpt-4",
    "temperature": 0.7
  },
  "tags": ["ai", "benefits"],
  "metadata": {
    "category": "education"
  }
}
```

### إحصائيات الكاش

```bash
GET /api/cache/analytics?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer YOUR_JWT_TOKEN
```

**الاستجابة:**

```json
{
  "success": true,
  "data": {
    "totalEntries": 1250,
    "totalHits": 3420,
    "totalMisses": 1580,
    "hitRate": 0.684,
    "tokensSaved": 145000,
    "costSaved": 4.35,
    "averageSimilarity": 0.89,
    "storageSize": "25.3 MB"
  }
}
```

### إبطال الكاش

```bash
POST /api/cache/invalidate
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "invalidationType": "tag",  // أو "pattern" أو "ids"
  "value": "ai"  // اسم الـ tag
}
```

### تنظيف الكاش المنتهي

```bash
POST /api/cache/cleanup
Authorization: Bearer YOUR_JWT_TOKEN
```

---

<a id="sdk-generation"></a>

## 🔨 توليد SDK

### توليد Python SDK

من واجهة الويب:

1. اذهب إلى تبويب "SDK Generator"
2. اختر "Python"
3. قم بتكوين الخيارات:

   ```javascript
   {
     language: 'python',
     functionName: 'generate_response',
     className: 'AIClient',
     includeRetry: true,
     retryAttempts: 3,
     retryDelay: 1000,
     async: true,
     includeTypes: true
   }
   ```

4. انقر على "Generate SDK"

**الكود المولد:**

```python
import openai
import time
from typing import Optional, Dict, Any

class AIClient:
    def __init__(self, api_key: str):
        self.client = openai.OpenAI(api_key=api_key)

    async def generate_response(
        self,
        prompt: str,
        model: str = "gpt-4",
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> Optional[str]:
        """
        Generate AI response with automatic retry logic
        """
        for attempt in range(3):
            try:
                response = await self.client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                return response.choices[0].message.content
            except Exception as e:
                if attempt < 2:
                    time.sleep(1 * (attempt + 1))
                    continue
                raise e
        return None

# Usage
client = AIClient(api_key="your-api-key")
result = await client.generate_response("Hello, AI!")
print(result)
```

### توليد TypeScript SDK

```javascript
{
  language: 'typescript',
  functionName: 'generateResponse',
  className: 'AIClient',
  includeRetry: true,
  retryAttempts: 3,
  async: true
}
```

**الكود المولد:**

```typescript
import OpenAI from 'openai';

export class AIClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateResponse(
    prompt: string,
    model: string = 'gpt-4',
    temperature: number = 0.7,
    maxTokens: number = 2000
  ): Promise<string | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
        });
        return response.choices[0].message.content;
      } catch (error) {
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }
    return null;
  }
}

// Usage
const client = new AIClient('your-api-key');
const result = await client.generateResponse('Hello, AI!');
console.log(result);
```

---

<a id="cloud-deployment"></a>

## ☁️ النشر السحابي

### Vercel Edge Functions

1. اختر "Cloud Deployment" → "Vercel"
2. كوّن الإعدادات:

   ```javascript
   {
     provider: 'vercel',
     functionName: 'ai-handler',
     runtime: 'edge',
     region: 'iad1',  // Washington DC
     environment: {
       OPENAI_API_KEY: 'your-key'
     },
     rateLimit: {
       enabled: true,
       maxRequests: 100,
       windowMs: 60000
     }
   }
   ```

3. انقر "Generate Deployment"

**الملفات المولدة:**

`api/ai-handler.ts`:

```typescript
import { OpenAI } from 'openai';

export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

export default async function handler(req: Request) {
  const { prompt } = await req.json();

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });

  return new Response(
    JSON.stringify({ result: response.choices[0].message.content }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
```

`vercel.json`:

```json
{
  "functions": {
    "api/ai-handler.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  },
  "env": {
    "OPENAI_API_KEY": "@openai-api-key"
  }
}
```

### Cloudflare Workers

```javascript
{
  provider: 'cloudflare',
  functionName: 'ai-worker',
  region: 'auto',
  kvNamespace: 'AI_CACHE'
}
```

**الملفات المولدة:**

`worker.js`:

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const { prompt } = await request.json();

  // Check KV cache
  const cached = await AI_CACHE.get(prompt);
  if (cached) {
    return new Response(cached, {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const result = await response.json();
  const output = JSON.stringify({
    result: result.choices[0].message.content
  });

  // Cache for 1 hour
  await AI_CACHE.put(prompt, output, { expirationTtl: 3600 });

  return new Response(output, {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

`wrangler.toml`:

```toml
name = "ai-worker"
type = "javascript"
account_id = "your-account-id"
workers_dev = true

[env.production]
kv_namespaces = [
  { binding = "AI_CACHE", id = "your-kv-id" }
]

[env.production.vars]
OPENAI_API_KEY = "your-key"
```

### AWS Lambda

```javascript
{
  provider: 'aws',
  functionName: 'ai-lambda',
  runtime: 'nodejs18.x',
  region: 'us-east-1',
  memory: 1024,
  timeout: 30
}
```

**الملفات المولدة:**

`template.yaml` (SAM):

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  AIFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: index.handler
      Runtime: nodejs18.x
      MemorySize: 1024
      Timeout: 30
      Environment:
        Variables:
          OPENAI_API_KEY: !Ref OpenAIKey
      Events:
        ApiEvent:
          Type: Api
          Properties:
            Path: /ai
            Method: POST
```

`index.js`:

```javascript
const { OpenAI } = require('openai');

exports.handler = async (event) => {
  const { prompt } = JSON.parse(event.body);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      result: response.choices[0].message.content,
    }),
  };
};
```

### Google Cloud Functions

```javascript
{
  provider: 'gcp',
  functionName: 'ai-function',
  runtime: 'nodejs18',
  region: 'us-central1',
  memory: '1GB',
  trigger: 'http'
}
```

---

<a id="advanced-features"></a>

## 🎯 الميزات المتقدمة

### إدارة سياق النوافذ المتعددة (MCP)

```bash
POST /api/mcp/sessions
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "sessionId": "chat-123",
  "maxTokens": 8000,
  "compressionStrategy": "moderate",
  "pruningStrategy": "hybrid"
}
```

### إضافة رسائل للسياق

```bash
POST /api/mcp/sessions/{sessionId}/messages
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "role": "user",
  "content": "ما هي أفضل ممارسات البرمجة؟",
  "importance": 0.8
}
```

### ضغط السياق يدوياً

```bash
POST /api/mcp/sessions/{sessionId}/compress
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "compressionLevel": "aggressive",
  "preserveImportant": true
}
```

### الحصول على السياق للإرسال

```bash
GET /api/mcp/sessions/{sessionId}/context
Authorization: Bearer YOUR_JWT_TOKEN
```

**الاستجابة:**

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "role": "system",
        "content": "أنت مساعد ذكي..."
      },
      {
        "role": "user",
        "content": "ما هي أفضل ممارسات البرمجة؟"
      }
    ],
    "totalTokens": 450,
    "compressed": true,
    "compressionRatio": 0.35
  }
}
```

### الترجمة مع السياق الثقافي

```bash
POST /api/translation
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "text": "الضيافة العربية الأصيلة",
  "sourceLang": "ar",
  "targetLang": "en",
  "culturalContext": {
    "preserveIdioms": true,
    "formalityLevel": "formal",
    "targetAudience": "international"
  }
}
```

---

## 📊 التحليلات والإحصائيات

### إحصائيات الاستدلال

```bash
GET /api/reasoning/statistics
Authorization: Bearer YOUR_JWT_TOKEN
```

### إحصائيات الذاكرة

```bash
GET /api/chains/memory/stats
Authorization: Bearer YOUR_JWT_TOKEN
```

### إحصائيات السوق

```bash
GET /api/marketplace/stats
Authorization: Bearer YOUR_JWT_TOKEN
```

### إحصائيات التجارب

```bash
GET /api/prompts/experiments/stats/summary
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 🔧 نصائح وأفضل الممارسات

### 1. استخدام التخزين المؤقت بفعالية

- ضع threshold مناسب (0.80-0.90) للحصول على تطابق جيد
- استخدم tags لتنظيم الكاش
- نظف الكاش القديم بانتظام

### 2. تحسين الـ Prompts

- ابدأ بـ Quick Optimize للحصول على نتائج سريعة
- استخدم A/B Testing لمقارنة الخيارات
- طبق Self-Refinement للتحسين المستمر

### 3. استخدام RAG

- قسّم المستندات إلى chunks مناسبة (300-500 كلمة)
- حدد trust scores بدقة للمصادر
- استخدم Adaptive RAG للاستعلامات المعقدة

### 4. التعاون الفعال

- حدد أدوار واضحة للأعضاء (OWNER, EDITOR, VIEWER)
- احفظ snapshots بانتظام
- استخدم التعليقات للتواصل

### 5. الأمان

- فحص safety قبل النشر في production
- مراقبة PII في الـ prompts
- استخدام pre-release checks

---

## 🆘 استكشاف الأخطاء

### خطأ: "Similarity threshold too low"

**الحل:** ارفع similarity threshold في طلب الكاش

### خطأ: "Token limit exceeded"

**الحل:**

- قلل maxTokens في modelConfig
- استخدم MCP compression
- قسّم الـ prompt لعدة أجزاء

### خطأ: "Insufficient permissions"

**الحل:** تحقق من دور المستخدم في الجلسة

### خطأ: "Knowledge base not found"

**الحل:** تأكد من إنشاء knowledge base أولاً

---

## 📞 الدعم والمساعدة

للحصول على مساعدة إضافية:

1. راجع الأمثلة في مجلد `examples/`
2. تحقق من الوثائق التقنية في `docs/`
3. افتح issue على GitHub
4. تواصل مع فريق الدعم

---

## 🎓 موارد إضافية

- [API Reference](./API_REFERENCE.md) - مرجع شامل لجميع endpoints
- [Architecture Guide](./ARCHITECTURE.md) - دليل البنية المعمارية
- [Contributing Guide](./CONTRIBUTING.md) - دليل المساهمة
- [Changelog](./CHANGELOG.md) - سجل التغييرات

---

**ملاحظة:** هذا الدليل يغطي جميع الميزات المتاحة حالياً. بعض الميزات قد تكون في مرحلة Beta أو قيد التطوير.

آخر تحديث: يناير 2025
