# تحسينات البرومبت الهرمية والميزات المتقدمة

## نظرة عامة

تم إضافة 10 تحسينات رئيسية لمنصة PromptStudio تتضمن بنية هرمية للبرومبتات وميزات ذكاء اصطناعي متقدمة.

---

## 1. البنية الهرمية للبرومبت (Hierarchical Prompt Structure)

### الوصف
تنظيم البرومبتات في طبقات هرمية لتحسين الوضوح والفعالية.

### المكونات الأربعة
- **System Prompt**: تعليمات النظام والسياق العام
- **Process Prompt**: إرشادات العملية والمنهجية
- **Task Prompt**: وصف المهمة المحددة
- **Output Prompt**: تنسيق المخرجات المطلوب

### الاستخدام

```typescript
import { PromptService } from './services/PromptService';

const hierarchicalPrompt = PromptService.buildHierarchicalPrompt({
  systemPrompt: 'You are an expert data analyst...',
  processPrompt: 'Follow these steps: 1) Analyze 2) Synthesize...',
  taskPrompt: 'Analyze the following dataset...',
  outputPrompt: 'Present results in JSON format...',
});
```

### API Endpoint
```
POST /api/prompts/build-hierarchical
Body: { systemPrompt, processPrompt, taskPrompt, outputPrompt }
```

---

## 2. Meta-Prompting للشخصيات والمجالات

### الوصف
توليد تعليمات ديناميكية بناءً على الشخصية والمجال المحدد.

### الميزات
- تعريف الشخصية (Persona): خبير، مبتدئ، مدرس، إلخ
- تحديد المجال (Domain): علوم بيانات، كتابة، برمجة، إلخ
- تعليمات ميتا قابلة للتخصيص

### الاستخدام

```typescript
const metaPrompt = PromptService.generateMetaPrompt({
  persona: 'Expert Data Scientist',
  domain: 'Machine Learning',
  metaInstructions: {
    tone: 'professional',
    style: 'detailed',
    expertise: 'advanced',
  },
});
```

### API Endpoint
```
POST /api/prompts/generate-meta
Body: { persona, domain, metaInstructions }
```

---

## 3. Tree/Graph-of-Thought مع التقييم الذاتي

### الوصف
استدلال متقدم يستكشف مسارات تفكير متعددة ويختار الأفضل.

### أنواع الاستدلال

#### Tree-of-Thought
```typescript
const result = await LLMServiceAdapter.executeTreeOfThought(prompt, {
  maxDepth: 3,
  branchingFactor: 3,
  evaluationCriteria: ['coherence', 'relevance', 'completeness'],
});
```

#### Graph-of-Thought
```typescript
const result = await LLMServiceAdapter.executeGraphOfThought(prompt, {
  maxNodes: 10,
  connectionThreshold: 0.5,
});
```

### API Endpoints
```
POST /api/prompts/tree-of-thought
POST /api/prompts/graph-of-thought
```

---

## 4. RAG تكيفي (Adaptive RAG)

### الوصف
استرجاع وتوليد محسّن بحزم سياق ديناميكية ومؤشرات ثقة.

### الميزات
- إنشاء قواعد معرفة (Knowledge Bases)
- تضمين المستندات (Document Embeddings)
- درجات الثقة القابلة للتحديث
- بناء برومبتات معززة بالسياق

### الاستخدام

```typescript
// إنشاء قاعدة معرفة
const kb = await RAGService.createKnowledgeBase({
  name: 'ML Documentation',
  domain: 'Machine Learning',
});

// إضافة مستندات
await RAGService.addToKnowledgeBase(kb.id, [
  {
    title: 'Introduction to Neural Networks',
    content: '...',
    trustScore: 0.95,
  },
]);

// استرجاع سياق
const context = await RAGService.retrieveContext(kb.id, 'What are CNNs?', {
  topK: 5,
  minRelevance: 0.7,
});

// بناء برومبت معزز
const ragPrompt = RAGService.buildRAGPrompt(originalPrompt, context);
```

### API Endpoints
```
POST /api/rag/knowledge-bases
POST /api/rag/knowledge-bases/:id/documents
POST /api/rag/knowledge-bases/:id/retrieve
POST /api/rag/build-prompt
```

---

## 5. تخطيط استخدام الأدوات (Tool Planning)

### الوصف
تخطيط تلقائي لاستخدام الأدوات قبل التنفيذ.

### الاستخدام

```typescript
const plan = await LLMServiceAdapter.generateToolPlan(prompt, [
  { name: 'calculator', description: 'Perform mathematical calculations' },
  { name: 'search', description: 'Search the web for information' },
  { name: 'translate', description: 'Translate text between languages' },
]);

// النتيجة:
// [
//   { toolName: 'calculator', reason: '...', parameters: {...}, order: 0 },
//   { toolName: 'search', reason: '...', parameters: {...}, order: 1 },
// ]
```

### API Endpoint
```
POST /api/prompts/tool-plan
Body: { prompt, availableTools }
```

---

## 6. حلقة Self-Refinement الآلية

### الوصف
تحسين تلقائي للبرومبتات بناءً على نتائج التنفيذ.

### الميزات
- تقييم جودة المخرجات
- توليد تعديلات تلقائية
- تتبع إصدارات البرومبت
- مقارنة بين الإصدارات

### الاستخدام

```typescript
const refinement = await LLMServiceAdapter.selfRefinePrompt(
  originalPrompt,
  executionResult,
  {
    accuracy: 0.65,
    completeness: 0.70,
    style: 0.60,
  }
);

// حفظ النسخة المحسّنة
await PromptService.createPromptVersion(
  promptId,
  refinement.refinedPrompt,
  components,
  refinement.refinementReason,
  0.75
);
```

### API Endpoints
```
POST /api/prompts/self-refine
POST /api/prompts/:id/versions
GET /api/prompts/:id/versions
```

---

## 7. بحث محسّن عن البرومبت (Prompt Optimization)

### الوصف
خوارزميات متقدمة للبحث عن أفضل صياغة للبرومبت.

### الأساليب

#### Bayesian Optimization
```typescript
const result = await PromptOptimizationService.bayesianOptimization(basePrompt, {
  iterations: 10,
  populationSize: 5,
  acquisitionFunction: 'ucb',
});
```

#### Evolutionary/Genetic Algorithm
```typescript
const result = await PromptOptimizationService.evolutionaryOptimization(basePrompt, {
  generations: 10,
  populationSize: 10,
  mutationRate: 0.2,
  crossoverRate: 0.7,
});
```

#### A/B Testing
```typescript
const result = await PromptOptimizationService.abTest(promptA, promptB, 10);
// النتيجة: { winner: 'A', scoreA: 0.87, scoreB: 0.82, confidence: 95 }
```

### API Endpoints
```
POST /api/prompts/optimize/bayesian
POST /api/prompts/optimize/evolutionary
POST /api/prompts/ab-test
```

---

## 8. سلاسل Prompt Chaining مع الذاكرة الطويلة

### الوصف
تنفيذ مهام متعددة المراحل مع سياق مشترك وذاكرة طويلة الأمد.

### الميزات
- تعريف مراحل متسلسلة
- تبعيات بين المراحل
- ذاكرة سياق مشتركة
- تتبع تاريخ التنفيذ

### الاستخدام

```typescript
// إنشاء سلسلة
const chain = await PromptChainService.createChain(promptId, {
  name: 'Analysis Pipeline',
  stages: [
    {
      id: 'analyze',
      name: 'Analysis',
      prompt: 'Analyze the following: {{input}}',
      order: 0,
    },
    {
      id: 'plan',
      name: 'Planning',
      prompt: 'Create a plan based on: {{analyze}}',
      order: 1,
      dependencies: ['analyze'],
    },
    {
      id: 'execute',
      name: 'Execution',
      prompt: 'Execute the plan: {{plan}}',
      order: 2,
      dependencies: ['plan'],
    },
  ],
});

// تنفيذ السلسلة
const result = await PromptChainService.executeChain(chain.id, {
  input: 'User data...',
});
```

### قوالب جاهزة

```typescript
// قالب تحليل شامل
const analysisChain = await PromptChainService.createAnalysisPipeline(
  promptId,
  'Complete Analysis'
);
// المراحل: Analyze → Plan → Draft → Review → Finalize
```

### API Endpoints
```
POST /api/chains
POST /api/chains/:id/execute
GET /api/chains/:id/history
GET /api/chains/:id/performance
POST /api/chains/templates/analysis-pipeline
```

---

## 9. حواجز لغوية وسلامة قبل الإرسال

### الوصف
فحص السلامة الشامل قبل إرسال البرومبتات.

### أنواع الفحوصات

#### كشف السمّية (Toxicity Detection)
- لغة مسيئة أو عدائية
- تصنيف الخطورة (منخفض، متوسط، عالي)

#### كشف PII (Personal Information)
- البريد الإلكتروني
- أرقام الهواتف
- أرقام الضمان الاجتماعي
- بطاقات الائتمان
- عناوين IP

#### كشف الانحياز (Bias Detection)
- لغة تحتوي على تعميمات مطلقة
- تحيز لفظي

### الاستخدام

```typescript
const safetyCheck = await SafetyService.performSafetyCheck(content, {
  checkToxicity: true,
  checkPII: true,
  checkBias: true,
  autoSanitize: true,
});

if (!safetyCheck.passed) {
  console.log('Issues found:', safetyCheck.issues);
  console.log('Recommendations:', safetyCheck.recommendations);

  if (safetyCheck.sanitizedContent) {
    // استخدام المحتوى المنقّح
    content = safetyCheck.sanitizedContent;
  }
}
```

### التحقق من الصحة

```typescript
const validation = await SafetyService.validatePrompt(prompt);

if (!validation.isValid) {
  console.log('Errors:', validation.errors);
  console.log('Warnings:', validation.warnings);
}
```

### API Endpoint
```
POST /api/prompts/safety-check
Body: { content, options }
```

---

## 10. وضع ما قبل الإرسال للتكلفة والنجاح

### الوصف
تحليل شامل قبل إرسال البرومبت لتقدير التكلفة واحتمال النجاح.

### المقاييس المحسوبة

1. **عدد التوكنز (Tokens)**
   - تقدير دقيق بناءً على النص
   - ~4 أحرف لكل توكن

2. **التكلفة (Cost)**
   - حساب بناءً على النموذج المستخدم
   - دعم GPT-4, GPT-3.5, Claude

3. **احتمال النجاح (Success Probability)**
   - تحليل جودة البرومبت
   - فحص البنية والوضوح
   - تقييم وجود أمثلة وتنسيق

4. **درجة السلامة (Safety Score)**
   - فحص شامل للمحتوى
   - تقييم الأمان العام

### الاستخدام

```typescript
const analysis = await PromptService.updatePromptWithAnalysis(promptId, content);

console.log(`Estimated Tokens: ${analysis.estimatedTokens}`);
console.log(`Estimated Cost: $${analysis.estimatedCost}`);
console.log(`Success Probability: ${(analysis.successProbability * 100).toFixed(0)}%`);
```

### الحصول على تحليل مفصل

```typescript
const tokens = PromptService.estimateTokens(prompt);
const cost = PromptService.estimateCost(tokens, 'gpt-4');
const successProb = await PromptService.calculateSuccessProbability(prompt);
const safetyScore = await SafetyService.calculateSafetyScore(prompt);
```

### API Endpoint
```
POST /api/prompts/analyze
Body: { prompt, model }
Response: {
  estimatedTokens,
  estimatedCost,
  successProbability,
  safetyScore,
  validation,
  safetyIssues,
  recommendations
}
```

---

## التغييرات في قاعدة البيانات

### جداول جديدة

1. **PromptVersion**
   - تتبع إصدارات البرومبت
   - سجل التحسينات

2. **PromptChain**
   - تعريف السلاسل
   - مراحل التنفيذ

3. **ChainExecution**
   - سجل التنفيذ
   - تحليل الأداء

4. **KnowledgeBase**
   - قواعد المعرفة
   - تكوين RAG

5. **KnowledgeDocument**
   - المستندات والتضمينات
   - درجات الثقة

### حقول جديدة في MarketplacePrompt

```sql
-- Hierarchical Structure
systemPrompt, processPrompt, taskPrompt, outputPrompt

-- Meta-Prompting
persona, domain, metaInstructions

-- Advanced Features
reasoningMode, ragEnabled, ragSources, toolPlanning, selfRefinement

-- Safety
safetyChecks, toxicityFilter, piiDetection

-- Cost & Performance
estimatedTokens, estimatedCost, successProbability
```

---

## مثال شامل للاستخدام

```typescript
import {
  PromptService,
  LLMServiceAdapter,
  RAGService,
  SafetyService,
  PromptChainService,
  PromptOptimizationService
} from './services';

async function advancedPromptWorkflow() {
  // 1. بناء برومبت هرمي
  const hierarchical = PromptService.buildHierarchicalPrompt({
    systemPrompt: 'You are an expert AI researcher...',
    processPrompt: 'Use rigorous analysis and cite sources...',
    taskPrompt: 'Explain transformer architectures...',
    outputPrompt: 'Provide a structured markdown response...',
  });

  // 2. إضافة meta-prompting
  const metaPrompt = PromptService.generateMetaPrompt({
    persona: 'Senior ML Engineer',
    domain: 'Deep Learning',
  });

  const fullPrompt = `${metaPrompt}\n\n${hierarchical}`;

  // 3. فحص السلامة
  const safety = await SafetyService.performSafetyCheck(fullPrompt, {
    autoSanitize: true,
  });

  if (!safety.passed) {
    console.warn('Safety issues detected:', safety.issues);
  }

  // 4. تحليل ما قبل الإرسال
  const tokens = PromptService.estimateTokens(fullPrompt);
  const cost = PromptService.estimateCost(tokens, 'gpt-4');
  const successProb = await PromptService.calculateSuccessProbability(fullPrompt);

  console.log(`Cost: $${cost.toFixed(4)}, Success: ${(successProb * 100).toFixed(0)}%`);

  // 5. تحسين البرومبت
  const optimized = await PromptOptimizationService.bayesianOptimization(
    fullPrompt,
    { iterations: 5 }
  );

  console.log(`Improvement: ${optimized.improvement.toFixed(2)}%`);

  // 6. استخدام RAG إذا لزم الأمر
  if (needsContext) {
    const context = await RAGService.retrieveContext(knowledgeBaseId, query);
    const ragPrompt = RAGService.buildRAGPrompt(optimized.bestPrompt, context);

    // تنفيذ مع RAG
    return ragPrompt;
  }

  // 7. استخدام Tree-of-Thought للاستدلال المعقد
  if (complexReasoning) {
    const totResult = await LLMServiceAdapter.executeTreeOfThought(
      optimized.bestPrompt,
      { maxDepth: 3 }
    );

    return totResult.finalAnswer;
  }

  return optimized.bestPrompt;
}
```

---

## الخطوات التالية

### للتطوير
1. تطبيق migrations على قاعدة البيانات الفعلية
2. ربط API routes بالتطبيق الرئيسي
3. اختبار الخدمات الجديدة
4. إضافة واجهات مستخدم متقدمة

### للإنتاج
1. تكامل مع LLM APIs الفعلية
2. تحسين خوارزميات التضمين
3. إضافة مراقبة الأداء
4. توسيع نماذج السلامة

---

## المساهمة

نرحب بالمساهمات في تحسين هذه الميزات! يرجى فتح issue أو pull request على GitHub.

---

## الترخيص

MIT License - انظر ملف LICENSE للتفاصيل.
