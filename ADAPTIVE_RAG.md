# نظام RAG التكيفي مع حزم السياق الديناميكية
# Adaptive RAG System with Dynamic Context Packing

## نظرة عامة | Overview

نظام RAG التكيفي هو نظام متقدم لاسترجاع وحقن السياق في البرومبتات، مع إمكانيات تلخيص ذكية وتتبع المصادر الموثوقة.

The Adaptive RAG system is an advanced context retrieval and injection system for prompts, with intelligent summarization capabilities and trusted source tracking.

## المكونات الرئيسية | Main Components

### 1. النماذج (Prisma Schema)

#### RAGContextSession
- **الوصف**: جلسة تتبع ديناميكية لعمليات RAG
- **الحقول**:
  - `query`: استعلام المستخدم
  - `queryEmbedding`: vector embedding للاستعلام
  - `maxChunks`, `minRelevance`, `minTrust`: معايير الفلترة
  - `avgRelevance`, `avgTrust`: إحصائيات النتائج

#### ContextSummary
- **الوصف**: تلخيص المقتطفات مع مؤشرات الثقة
- **الحقول**:
  - `originalChunk`: المحتوى الأصلي
  - `summary`: الملخص المُنتج
  - `relevanceScore`, `trustScore`, `confidenceScore`: مؤشرات الجودة
  - `compressionRatio`: نسبة الضغط

#### ContextTrace
- **الوصف**: حفظ أثر المصدر في البرومبت النهائي
- **الحقول**:
  - `sourceDocument`, `sourceTitle`, `sourceUrl`: معلومات المصدر
  - `injectedAt`: موقع الحقن في البرومبت
  - `attributionText`: نص الإسناد

#### TrustedSource
- **الوصف**: سجل المصادر الموثوقة
- **الحقول**:
  - `name`, `domain`, `url`: معرّفات المصدر
  - `baseTrustScore`: درجة الثقة الأساسية
  - `autoVerify`: تفعيل التحقق التلقائي

### 2. الخدمات (Services)

#### EmbeddingUtil (`backend/src/services/embedding-util.ts`)
أدوات مساعدة لتوليد وإدارة embeddings:
- `generateEmbedding()`: توليد embedding باستخدام OpenAI
- `cosineSimilarity()`: حساب التشابه بين vectors
- `chunkText()`: تقسيم النص إلى أجزاء مع overlap
- `estimateTokenCount()`: تقدير عدد tokens

#### AdaptiveRAGService (`backend/src/services/AdaptiveRAGService.ts`)
الخدمة الرئيسية للـ RAG التكيفي:

##### buildContextMask()
```typescript
// بناء ماسك سياق يحدد المصادر الموثوقة
const contextMask = await adaptiveRAGService.buildContextMask(
  knowledgeBaseId,
  {
    trustThreshold: 0.5,
    verifiedOnly: false,
    allowedDomains: ['example.com'],
    blockedDomains: ['spam.com']
  }
);
```

##### summarizeChunks()
```typescript
// تلخيص المقتطفات مع مؤشرات الثقة
const enrichedChunks = await adaptiveRAGService.summarizeChunks(
  chunks,
  query
);
```

##### injectContextWithTrace()
```typescript
// حقن السياق في البرومبت مع حفظ أثر المصدر
const { prompt, traces } = await adaptiveRAGService.injectContextWithTrace(
  originalPrompt,
  enrichedChunks,
  sessionId,
  {
    maxContextLength: 4000,
    citationFormat: 'inline',
    includeConfidenceScores: true
  }
);
```

##### retrieveAdaptiveContext() - الوظيفة الرئيسية
```typescript
const result = await adaptiveRAGService.retrieveAdaptiveContext(
  knowledgeBaseId,
  query,
  {
    maxChunks: 5,
    minRelevance: 0.7,
    minTrust: 0.5,
    enableSummarization: true,
    maxContextLength: 4000,
    includeSourceTrace: true
  }
);
```

### 3. API Endpoints

#### POST `/api/rag/adaptive/retrieve`
استرجاع سياق تكيفي مع حزم سياق ديناميكية

**Request Body:**
```json
{
  "knowledgeBaseId": "uuid",
  "query": "What is machine learning?",
  "maxChunks": 5,
  "minRelevance": 0.7,
  "minTrust": 0.5,
  "enableSummarization": true,
  "maxContextLength": 4000,
  "includeSourceTrace": true
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "query": "What is machine learning?",
  "enrichedChunks": [
    {
      "id": "chunk-uuid",
      "content": "Original content...",
      "summary": "Concise summary...",
      "source": "research-paper.pdf",
      "sourceTitle": "ML Fundamentals",
      "relevanceScore": 0.92,
      "trustScore": 0.85,
      "confidenceScore": 0.88,
      "isVerified": true
    }
  ],
  "finalPrompt": "# Context from Knowledge Base\n\n[1] Source: ML Fundamentals (✓ Verified, Relevance: 92%, Trust: 85%, Confidence: 88%)\n...",
  "contextStats": {
    "totalChunks": 5,
    "avgRelevance": 0.87,
    "avgTrust": 0.82,
    "avgConfidence": 0.85,
    "totalTokens": 1500
  },
  "sourceTraces": [
    {
      "id": "chunk-uuid",
      "sourceDocument": "research-paper.pdf",
      "sourceTitle": "ML Fundamentals",
      "position": 1,
      "attribution": "[1] Source: ML Fundamentals (✓ Verified, ...)"
    }
  ]
}
```

#### POST `/api/rag/adaptive/context-mask`
بناء ماسك سياق للمصادر الموثوقة

**Request Body:**
```json
{
  "knowledgeBaseId": "uuid",
  "trustThreshold": 0.5,
  "verifiedOnly": false,
  "allowedDomains": ["example.com"],
  "blockedDomains": ["spam.com"]
}
```

#### GET `/api/rag/adaptive/sessions/:sessionId`
الحصول على سجل جلسة RAG مع كل التفاصيل

#### POST `/api/rag/adaptive/trusted-sources`
تسجيل مصدر موثوق جديد

**Request Body:**
```json
{
  "name": "Research Database",
  "domain": "research.example.com",
  "url": "https://research.example.com",
  "sourceType": "database",
  "baseTrustScore": 0.9,
  "autoVerify": true
}
```

#### POST `/api/rag/adaptive/summarize`
تلخيص المقتطفات مع مؤشرات الثقة

**Request Body:**
```json
{
  "chunks": [
    {
      "id": "uuid",
      "content": "Long text content...",
      "source": "document.pdf",
      "title": "Document Title",
      "relevanceScore": 0.9,
      "trustScore": 0.8,
      "isVerified": true
    }
  ],
  "query": "What is the main topic?"
}
```

## مثال تطبيقي | Usage Example

### 1. إنشاء Knowledge Base وإضافة مستندات

```bash
# Create knowledge base
curl -X POST http://localhost:3001/api/rag/knowledge-bases \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AI Research",
    "description": "AI and ML research papers",
    "domain": "artificial-intelligence"
  }'

# Add documents
curl -X POST http://localhost:3001/api/rag/knowledge-bases/{id}/documents \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "title": "Introduction to ML",
        "content": "Machine learning is a subset of AI...",
        "source": "ml-intro.pdf",
        "trustScore": 0.9,
        "metadata": {"author": "John Doe", "year": 2024}
      }
    ]
  }'
```

### 2. تسجيل مصادر موثوقة

```bash
curl -X POST http://localhost:3001/api/rag/adaptive/trusted-sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ArXiv Papers",
    "domain": "arxiv.org",
    "baseTrustScore": 0.95,
    "autoVerify": true
  }'
```

### 3. استرجاع سياق تكيفي

```bash
curl -X POST http://localhost:3001/api/rag/adaptive/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgeBaseId": "{kb-id}",
    "query": "Explain neural networks",
    "maxChunks": 5,
    "minRelevance": 0.7,
    "enableSummarization": true
  }'
```

### 4. مراجعة سجل الجلسة

```bash
curl http://localhost:3001/api/rag/adaptive/sessions/{session-id}
```

## الميزات الرئيسية | Key Features

### 1. ماسك السياق (Context Mask)
- فلترة المصادر بناءً على درجة الثقة
- السماح/حظر مجالات محددة
- دعم المصادر المحققة فقط

### 2. التلخيص الذكي (Smart Summarization)
- تلخيص تلقائي للمقتطفات الطويلة
- الحفاظ على المعلومات الأساسية
- حساب نسبة الضغط

### 3. مؤشرات الثقة (Confidence Scores)
- **Relevance Score**: مدى ملاءمة المحتوى للاستعلام
- **Trust Score**: درجة موثوقية المصدر
- **Confidence Score**: مؤشر شامل يجمع العوامل

### 4. تتبع المصادر (Source Tracing)
- حفظ أثر كل مقتطف في البرومبت
- إسناد واضح للمصادر
- دعم أنماط citation مختلفة (inline, footnote, endnote)

### 5. الإحصائيات (Statistics)
- عدد tokens المستخدمة
- متوسط درجات الثقة والصلة
- عدد مرات استرجاع كل مستند

## خطوات التثبيت | Installation Steps

### 1. تثبيت Dependencies
```bash
cd backend
npm install
```

### 2. تشغيل Prisma Migration
```bash
npx prisma migrate dev --name adaptive_rag_system
```

### 3. توليد Prisma Client
```bash
npx prisma generate
```

### 4. إعداد Environment Variables
```env
DATABASE_URL="postgresql://user:password@localhost:5432/promptstudio"
OPENAI_API_KEY="your-openai-api-key"
```

### 5. تشغيل الخادم
```bash
npm run dev
```

## الأداء والتحسين | Performance & Optimization

### 1. Caching
- استخدام Semantic Cache للاستعلامات المتشابهة
- تخزين embeddings لتجنب إعادة الحساب

### 2. Batch Processing
- معالجة embeddings بشكل دفعي
- تحسين استعلامات قاعدة البيانات

### 3. Context Packing
- ضغط ذكي للسياق لتقليل tokens
- ترتيب حسب الأهمية (relevance × confidence)

## الأمان | Security

### 1. Source Verification
- تحقق من المصادر قبل الاعتماد عليها
- دعم المصادر المحققة فقط عند الحاجة

### 2. Content Filtering
- فلترة المحتوى بناءً على patterns
- حظر مصادر غير موثوقة

### 3. Access Control
- التحكم في الوصول للـ knowledge bases
- تتبع من قام بالتحقق من المصادر

## الخلاصة | Summary

نظام RAG التكيفي يوفر:
✅ استرجاع ذكي للسياق مع فلترة المصادر الموثوقة
✅ تلخيص تلقائي للمقتطفات مع مؤشرات الثقة
✅ حقن السياق في البرومبت مع حفظ أثر المصدر
✅ تتبع شامل لجميع العمليات
✅ API endpoints سهلة الاستخدام
✅ إحصائيات وتحليلات مفصلة

The Adaptive RAG system provides:
✅ Intelligent context retrieval with trusted source filtering
✅ Automatic chunk summarization with confidence indicators
✅ Context injection into prompts with source tracing
✅ Comprehensive tracking of all operations
✅ Easy-to-use API endpoints
✅ Detailed statistics and analytics
