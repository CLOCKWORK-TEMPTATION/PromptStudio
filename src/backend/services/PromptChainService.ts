import prisma from '../lib/prisma';
import {
  LongTermMemoryService,
  MemoryType,
  ExecutionContext,
  MemorySearchResult,
} from './LongTermMemoryService';

/**
 * مراحل خط الأنابيب القياسي
 */
export enum StandardStage {
  ANALYZE = 'analyze',     // تحليل المدخل
  PLAN = 'plan',           // تخطيط الاستجابة
  DRAFT = 'draft',         // صياغة المسودة
  REVIEW = 'review',       // مراجعة وتحسين
  FINALIZE = 'finalize',   // الإخراج النهائي
}

/**
 * أنواع خطوط الأنابيب المتاحة
 */
export enum PipelineType {
  STANDARD = 'standard',     // تحليل → تخطيط → صياغة → مراجعة → إخراج
  ANALYSIS = 'analysis',     // تحليل معمق
  CREATIVE = 'creative',     // كتابة إبداعية
  TECHNICAL = 'technical',   // توثيق تقني
  CUSTOM = 'custom',         // مخصص
}

/**
 * تكوين مرحلة في السلسلة
 */
export interface ChainStage {
  id: string;
  name: string;
  prompt: string;
  expectedOutput?: string;
  order: number;
  dependencies?: string[];
  config?: {
    maxTokens?: number;
    temperature?: number;
    useMemory?: boolean;      // استخدام الذاكرة طويلة الأمد
    cacheOutput?: boolean;    // تخزين المخرج في الذاكرة
    retryOnFail?: boolean;    // إعادة المحاولة عند الفشل
    maxRetries?: number;
  };
}

/**
 * سياق تنفيذ السلسلة
 */
export interface ChainContext {
  variables: Record<string, any>;
  stageOutputs: Record<string, string>;
  stageInputs: Record<string, string>;
  metadata: Record<string, any>;
  memoryHints: MemorySearchResult[];  // نتائج البحث في الذاكرة
}

/**
 * نتيجة تنفيذ السلسلة
 */
export interface ChainExecutionResult {
  success: boolean;
  results: Record<string, any>;
  stageResults: {
    stageId: string;
    stageName: string;
    input: string;
    output: string;
    duration: number;
    usedMemory: boolean;
    memorySimilarity?: number;
  }[];
  totalDuration: number;
  totalCost?: number;
  errors?: string[];
  memoryStats?: {
    contextReused: boolean;
    similarContextsFound: number;
    newContextStored: boolean;
  };
}

/**
 * تكوين إنشاء سلسلة جديدة
 */
export interface CreateChainConfig {
  name: string;
  description?: string;
  stages?: ChainStage[];
  pipelineType?: PipelineType;
  enableMemory?: boolean;
  reuseContext?: boolean;
}

/**
 * خدمة سلاسل Prompt مع الذاكرة طويلة الأمد
 */
export class PromptChainService {
  private static memoryService = new LongTermMemoryService();

  /**
   * إنشاء سلسلة جديدة
   */
  static async createChain(
    promptId: string,
    config: CreateChainConfig
  ) {
    const stages = config.stages || this.getDefaultStages(config.pipelineType || PipelineType.STANDARD);

    return await prisma.promptChain.create({
      data: {
        promptId,
        name: config.name,
        description: config.description,
        stages: stages,
        contextMemory: {},
        pipelineType: config.pipelineType || PipelineType.CUSTOM,
        enableMemory: config.enableMemory ?? true,
        reuseContext: config.reuseContext ?? true,
      },
    });
  }

  /**
   * الحصول على المراحل الافتراضية حسب نوع خط الأنابيب
   */
  static getDefaultStages(pipelineType: PipelineType): ChainStage[] {
    switch (pipelineType) {
      case PipelineType.STANDARD:
        return this.getStandardPipelineStages();
      case PipelineType.ANALYSIS:
        return this.getAnalysisPipelineStages();
      case PipelineType.CREATIVE:
        return this.getCreativePipelineStages();
      case PipelineType.TECHNICAL:
        return this.getTechnicalPipelineStages();
      default:
        return this.getStandardPipelineStages();
    }
  }

  /**
   * خط الأنابيب القياسي: تحليل → تخطيط → صياغة → مراجعة → إخراج
   */
  private static getStandardPipelineStages(): ChainStage[] {
    return [
      {
        id: StandardStage.ANALYZE,
        name: 'تحليل',
        prompt: `قم بتحليل المدخل التالي وحدد:
1. الموضوع الرئيسي والمواضيع الفرعية
2. الكيانات والمفاهيم الأساسية
3. السياق والنبرة المطلوبة
4. أي متطلبات أو قيود ضمنية

المدخل:
{{input}}

{{#if memoryContext}}
سياق من مهام سابقة مشابهة:
{{memoryContext}}
{{/if}}`,
        order: 0,
        config: { useMemory: true, cacheOutput: true },
      },
      {
        id: StandardStage.PLAN,
        name: 'تخطيط',
        prompt: `بناءً على التحليل التالي:
{{analyze}}

ضع خطة منظمة للاستجابة تشمل:
1. الهيكل العام للإجابة
2. النقاط الرئيسية المراد تغطيتها
3. الترتيب المنطقي للأفكار
4. الأمثلة أو التوضيحات المطلوبة`,
        order: 1,
        dependencies: [StandardStage.ANALYZE],
        config: { useMemory: true },
      },
      {
        id: StandardStage.DRAFT,
        name: 'صياغة',
        prompt: `اتبع الخطة التالية:
{{plan}}

واكتب مسودة شاملة للاستجابة. يجب أن تكون:
- واضحة ومنظمة
- شاملة للنقاط المطلوبة
- ملائمة للسياق والنبرة المحددة

المدخل الأصلي للرجوع إليه:
{{input}}`,
        order: 2,
        dependencies: [StandardStage.PLAN],
        config: { cacheOutput: true },
      },
      {
        id: StandardStage.REVIEW,
        name: 'مراجعة',
        prompt: `راجع المسودة التالية:
{{draft}}

وقدم:
1. تقييماً للجودة والاكتمال
2. أي أخطاء أو تناقضات
3. اقتراحات للتحسين
4. نقاط القوة والضعف

التحليل الأصلي:
{{analyze}}`,
        order: 3,
        dependencies: [StandardStage.DRAFT],
      },
      {
        id: StandardStage.FINALIZE,
        name: 'إخراج نهائي',
        prompt: `بناءً على المسودة:
{{draft}}

والمراجعة:
{{review}}

أنتج الإصدار النهائي المحسن. تأكد من:
- معالجة جميع الملاحظات
- التنسيق المناسب
- الوضوح والدقة`,
        order: 4,
        dependencies: [StandardStage.DRAFT, StandardStage.REVIEW],
        config: { cacheOutput: true },
      },
    ];
  }

  /**
   * خط أنابيب التحليل المعمق
   */
  private static getAnalysisPipelineStages(): ChainStage[] {
    return [
      {
        id: 'extract',
        name: 'استخراج البيانات',
        prompt: `استخرج جميع البيانات والمعلومات الرئيسية من:
{{input}}

قدمها في شكل منظم.`,
        order: 0,
        config: { useMemory: true, cacheOutput: true },
      },
      {
        id: 'categorize',
        name: 'تصنيف',
        prompt: `صنف البيانات المستخرجة:
{{extract}}

إلى فئات منطقية مع تحديد العلاقات بينها.`,
        order: 1,
        dependencies: ['extract'],
      },
      {
        id: 'analyze_deep',
        name: 'تحليل معمق',
        prompt: `قم بتحليل معمق للفئات:
{{categorize}}

حدد الأنماط والاتجاهات والرؤى.`,
        order: 2,
        dependencies: ['categorize'],
        config: { useMemory: true },
      },
      {
        id: 'synthesize',
        name: 'تركيب',
        prompt: `اجمع نتائج التحليل:
{{analyze_deep}}

في ملخص شامل مع استنتاجات قابلة للتنفيذ.`,
        order: 3,
        dependencies: ['analyze_deep'],
        config: { cacheOutput: true },
      },
    ];
  }

  /**
   * خط أنابيب الكتابة الإبداعية
   */
  private static getCreativePipelineStages(): ChainStage[] {
    return [
      {
        id: 'ideate',
        name: 'توليد الأفكار',
        prompt: `بناءً على الموضوع:
{{input}}

ولد أفكاراً إبداعية متنوعة (5-10 أفكار).`,
        order: 0,
        config: { useMemory: true },
      },
      {
        id: 'select',
        name: 'اختيار',
        prompt: `من الأفكار التالية:
{{ideate}}

اختر أفضل فكرة أو اجمع أفضل العناصر.`,
        order: 1,
        dependencies: ['ideate'],
      },
      {
        id: 'expand',
        name: 'توسيع',
        prompt: `وسع الفكرة المختارة:
{{select}}

أضف تفاصيل وعمقاً إبداعياً.`,
        order: 2,
        dependencies: ['select'],
        config: { cacheOutput: true },
      },
      {
        id: 'polish',
        name: 'صقل',
        prompt: `صقل النص الإبداعي:
{{expand}}

حسن الأسلوب والتدفق والتأثير.`,
        order: 3,
        dependencies: ['expand'],
        config: { cacheOutput: true },
      },
    ];
  }

  /**
   * خط أنابيب التوثيق التقني
   */
  private static getTechnicalPipelineStages(): ChainStage[] {
    return [
      {
        id: 'understand',
        name: 'فهم',
        prompt: `افهم المتطلبات التقنية من:
{{input}}

حدد المكونات والعلاقات والتبعيات.`,
        order: 0,
        config: { useMemory: true, cacheOutput: true },
      },
      {
        id: 'structure',
        name: 'هيكلة',
        prompt: `بناءً على الفهم:
{{understand}}

صمم هيكل التوثيق المناسب.`,
        order: 1,
        dependencies: ['understand'],
      },
      {
        id: 'document',
        name: 'توثيق',
        prompt: `وثق وفق الهيكل:
{{structure}}

استخدم أمثلة كود ورسوم توضيحية حيث يناسب.`,
        order: 2,
        dependencies: ['structure'],
        config: { cacheOutput: true },
      },
      {
        id: 'validate',
        name: 'تحقق',
        prompt: `تحقق من التوثيق:
{{document}}

تأكد من الدقة والاكتمال والوضوح.`,
        order: 3,
        dependencies: ['document'],
        config: { cacheOutput: true },
      },
    ];
  }

  /**
   * تنفيذ السلسلة مع دعم الذاكرة طويلة الأمد
   */
  static async executeChain(
    chainId: string,
    initialContext: Record<string, any> = {},
    options: {
      sessionId?: string;
      useMemory?: boolean;
      storeInMemory?: boolean;
    } = {}
  ): Promise<ChainExecutionResult> {
    const startTime = Date.now();

    const chain = await prisma.promptChain.findUnique({
      where: { id: chainId },
    });

    if (!chain) {
      throw new Error('Chain not found');
    }

    const stages = chain.stages as any as ChainStage[];
    const useMemory = options.useMemory ?? chain.enableMemory;
    const storeInMemory = options.storeInMemory ?? chain.enableMemory;

    // تهيئة السياق
    const context: ChainContext = {
      variables: { ...initialContext },
      stageOutputs: {},
      stageInputs: {},
      metadata: {},
      memoryHints: [],
    };

    // البحث عن سياقات مشابهة في الذاكرة
    let memoryStats = {
      contextReused: false,
      similarContextsFound: 0,
      newContextStored: false,
    };

    if (useMemory && chain.reuseContext && initialContext.input) {
      const similarContexts = await this.memoryService.retrieveSimilarContexts(
        initialContext.input,
        {
          type: MemoryType.TASK_CONTEXT,
          taskType: chain.pipelineType,
          limit: 3,
          minRelevance: 0.75,
        }
      );

      if (similarContexts.length > 0) {
        context.memoryHints = similarContexts;
        memoryStats.similarContextsFound = similarContexts.length;

        // إضافة السياق من الذاكرة للمتغيرات
        context.variables.memoryContext = similarContexts
          .map((s) => s.record.content)
          .join('\n---\n');
        memoryStats.contextReused = true;
      }
    }

    // تهيئة أو تحميل حالة الذاكرة
    await this.initializeMemoryState(chainId, options.sessionId);

    const stageResults: ChainExecutionResult['stageResults'] = [];
    const errors: string[] = [];
    let totalCost = 0;

    // تنفيذ المراحل بالترتيب
    for (const stage of stages.sort((a, b) => a.order - b.order)) {
      try {
        // التحقق من التبعيات
        if (stage.dependencies && stage.dependencies.length > 0) {
          const missingDeps = stage.dependencies.filter(
            (dep) => !context.stageOutputs[dep]
          );

          if (missingDeps.length > 0) {
            throw new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
          }
        }

        // البحث عن مخرجات مشابهة في الذاكرة
        let usedMemory = false;
        let memorySimilarity: number | undefined;

        if (useMemory && stage.config?.useMemory) {
          const stagePrompt = this.interpolatePrompt(stage.prompt, context);
          const similarOutput = await this.memoryService.retrieveSimilarStageOutput(
            stage.name,
            stagePrompt,
            { minRelevance: 0.9 }
          );

          if (similarOutput && similarOutput.similarity > 0.92) {
            // استخدام المخرج المخزن مباشرة
            context.stageOutputs[stage.id] = similarOutput.record.content;
            usedMemory = true;
            memorySimilarity = similarOutput.similarity;

            // تحديث درجة الصلة
            await this.memoryService.updateRelevance(
              similarOutput.record.id,
              'positive'
            );

            stageResults.push({
              stageId: stage.id,
              stageName: stage.name,
              input: stagePrompt,
              output: similarOutput.record.content,
              duration: 0,
              usedMemory: true,
              memorySimilarity: similarOutput.similarity,
            });

            continue;
          }
        }

        // بناء وتنفيذ المرحلة
        const stagePrompt = this.interpolatePrompt(stage.prompt, context);
        context.stageInputs[stage.id] = stagePrompt;

        const stageResult = await this.executeStage(stagePrompt, stage);

        // تخزين النتيجة
        context.stageOutputs[stage.id] = stageResult.output;
        context.metadata[`${stage.id}_duration`] = stageResult.duration;
        totalCost += stageResult.cost || 0;

        stageResults.push({
          stageId: stage.id,
          stageName: stage.name,
          input: stagePrompt,
          output: stageResult.output,
          duration: stageResult.duration,
          usedMemory,
          memorySimilarity,
        });

        // تحديث حالة الذاكرة
        await this.updateMemoryState(chainId, options.sessionId, {
          currentStage: stage.id,
          stageOutput: { [stage.id]: stageResult.output },
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Stage ${stage.name} failed: ${errorMessage}`);

        // محاولة إعادة التنفيذ إذا كان مفعلاً
        if (stage.config?.retryOnFail) {
          const maxRetries = stage.config.maxRetries || 2;
          for (let retry = 0; retry < maxRetries; retry++) {
            try {
              const stagePrompt = this.interpolatePrompt(stage.prompt, context);
              const stageResult = await this.executeStage(stagePrompt, stage);
              context.stageOutputs[stage.id] = stageResult.output;
              errors.pop(); // إزالة الخطأ إذا نجحت إعادة المحاولة
              break;
            } catch {
              if (retry === maxRetries - 1) {
                // حفظ التنفيذ الفاشل
                await this.saveExecution(
                  chainId,
                  context.stageOutputs,
                  Date.now() - startTime,
                  totalCost,
                  false,
                  errorMessage
                );

                return {
                  success: false,
                  results: context.stageOutputs,
                  stageResults,
                  totalDuration: Date.now() - startTime,
                  totalCost,
                  errors,
                  memoryStats,
                };
              }
            }
          }
        } else {
          // حفظ التنفيذ الفاشل
          await this.saveExecution(
            chainId,
            context.stageOutputs,
            Date.now() - startTime,
            totalCost,
            false,
            errorMessage
          );

          return {
            success: false,
            results: context.stageOutputs,
            stageResults,
            totalDuration: Date.now() - startTime,
            totalCost,
            errors,
            memoryStats,
          };
        }
      }
    }

    const totalDuration = Date.now() - startTime;

    // حفظ التنفيذ الناجح
    await this.saveExecution(chainId, context.stageOutputs, totalDuration, totalCost, true);

    // تخزين السياق في الذاكرة طويلة الأمد
    if (storeInMemory) {
      const executionContext: ExecutionContext = {
        taskId: chainId,
        taskType: chain.pipelineType,
        input: initialContext.input || '',
        stages: stageResults.map((sr) => ({
          stageId: sr.stageId,
          stageName: sr.stageName,
          input: sr.input,
          output: sr.output,
          duration: sr.duration,
          timestamp: new Date(),
        })),
        finalOutput: context.stageOutputs[stages[stages.length - 1].id] || '',
        success: true,
        metadata: context.metadata,
      };

      await this.memoryService.storeExecutionContext(executionContext);
      memoryStats.newContextStored = true;
    }

    // تحديث ذاكرة سياق السلسلة
    await this.updateContextMemory(chainId, context);

    return {
      success: true,
      results: context.stageOutputs,
      stageResults,
      totalDuration,
      totalCost,
      memoryStats,
    };
  }

  /**
   * استيفاء المتغيرات في القالب
   */
  private static interpolatePrompt(
    prompt: string,
    context: ChainContext
  ): string {
    let interpolated = prompt;

    // استبدال مخرجات المراحل
    Object.entries(context.stageOutputs).forEach(([stageId, output]) => {
      interpolated = interpolated.replace(
        new RegExp(`\\{\\{${stageId}\\}\\}`, 'g'),
        output
      );
    });

    // استبدال المتغيرات
    Object.entries(context.variables).forEach(([key, value]) => {
      interpolated = interpolated.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        String(value)
      );
    });

    // معالجة الشروط البسيطة
    interpolated = interpolated.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, varName, content) => {
        return context.variables[varName] ? content : '';
      }
    );

    return interpolated;
  }

  /**
   * تنفيذ مرحلة واحدة
   */
  private static async executeStage(
    prompt: string,
    stage: ChainStage
  ): Promise<{
    output: string;
    duration: number;
    cost?: number;
  }> {
    const startTime = Date.now();

    // Placeholder implementation - في التنفيذ الحقيقي يستدعى LLM
    // هذا محاكاة للتنفيذ
    await new Promise((resolve) => setTimeout(resolve, 100));

    const output = `نتيجة المرحلة "${stage.name}": تمت معالجة ${prompt.length} حرف بنجاح.`;

    const duration = Date.now() - startTime;
    const cost = prompt.length * 0.00001;

    return { output, duration, cost };
  }

  /**
   * تهيئة حالة الذاكرة للسلسلة
   */
  private static async initializeMemoryState(
    chainId: string,
    sessionId?: string
  ): Promise<void> {
    const existing = await prisma.chainMemoryState.findFirst({
      where: {
        chainId,
        sessionId: sessionId || null,
      },
    });

    if (!existing) {
      await prisma.chainMemoryState.create({
        data: {
          chainId,
          sessionId,
          shortTermMemory: {},
          workingMemory: {},
          stageHistory: [],
          isActive: true,
        },
      });
    }
  }

  /**
   * تحديث حالة الذاكرة
   */
  private static async updateMemoryState(
    chainId: string,
    sessionId: string | undefined,
    updates: {
      currentStage?: string;
      stageOutput?: Record<string, string>;
    }
  ): Promise<void> {
    const state = await prisma.chainMemoryState.findFirst({
      where: {
        chainId,
        sessionId: sessionId || null,
      },
    });

    if (!state) return;

    const workingMemory = (state.workingMemory as Record<string, any>) || {};
    const stageHistory = (state.stageHistory as any[]) || [];

    if (updates.stageOutput) {
      Object.assign(workingMemory, updates.stageOutput);
    }

    if (updates.currentStage) {
      stageHistory.push({
        stage: updates.currentStage,
        timestamp: new Date().toISOString(),
      });
    }

    await prisma.chainMemoryState.update({
      where: { id: state.id },
      data: {
        currentStage: updates.currentStage,
        workingMemory,
        stageHistory,
      },
    });
  }

  /**
   * حفظ تنفيذ السلسلة
   */
  private static async saveExecution(
    chainId: string,
    stageResults: Record<string, any>,
    duration: number,
    cost: number,
    success: boolean,
    errorMessage?: string
  ) {
    return await prisma.chainExecution.create({
      data: {
        chainId,
        stageResults,
        totalDuration: duration,
        totalCost: cost,
        success,
        errorMessage,
      },
    });
  }

  /**
   * تحديث ذاكرة سياق السلسلة
   */
  private static async updateContextMemory(
    chainId: string,
    context: ChainContext
  ): Promise<void> {
    const chain = await prisma.promptChain.findUnique({
      where: { id: chainId },
      select: { contextMemory: true },
    });

    const existingMemory = (chain?.contextMemory as Record<string, any>) || {};

    const updatedMemory = {
      ...existingMemory,
      lastExecution: new Date().toISOString(),
      executionCount: (existingMemory.executionCount || 0) + 1,
      recentOutputs: Object.entries(context.stageOutputs).map(
        ([stageId, output]) => ({
          stageId,
          output: output.substring(0, 500),
          timestamp: new Date().toISOString(),
        })
      ),
    };

    await prisma.promptChain.update({
      where: { id: chainId },
      data: { contextMemory: updatedMemory },
    });
  }

  /**
   * الحصول على سجل التنفيذات
   */
  static async getExecutionHistory(
    chainId: string,
    options: { limit?: number; offset?: number } = {}
  ) {
    const { limit = 20, offset = 0 } = options;

    return await prisma.chainExecution.findMany({
      where: { chainId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * تحليل أداء السلسلة
   */
  static async analyzeChainPerformance(chainId: string) {
    const executions = await prisma.chainExecution.findMany({
      where: { chainId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (executions.length === 0) {
      return null;
    }

    const successCount = executions.filter((e) => e.success).length;
    const avgDuration =
      executions.reduce((sum, e) => sum + e.totalDuration, 0) / executions.length;
    const avgCost =
      executions.reduce((sum, e) => sum + (e.totalCost || 0), 0) / executions.length;

    const recentExecutions = executions.slice(0, 10);
    const recentSuccessRate =
      recentExecutions.filter((e) => e.success).length / recentExecutions.length;

    // تحليل استخدام الذاكرة
    const memoryStats = await this.memoryService.getStats();

    return {
      totalExecutions: executions.length,
      successRate: successCount / executions.length,
      recentSuccessRate,
      avgDuration,
      avgCost,
      trends: {
        improving: recentSuccessRate > successCount / executions.length,
      },
      memoryUsage: memoryStats,
    };
  }

  /**
   * إنشاء خط أنابيب تحليل قياسي
   */
  static async createAnalysisPipeline(promptId: string, name: string) {
    return await this.createChain(promptId, {
      name,
      description: 'خط أنابيب متعدد المراحل: تحليل ← تخطيط ← صياغة ← مراجعة ← إخراج',
      pipelineType: PipelineType.STANDARD,
      enableMemory: true,
      reuseContext: true,
    });
  }

  /**
   * الحصول على قوالب خطوط الأنابيب المتاحة
   */
  static getPipelineTemplates() {
    return [
      {
        type: PipelineType.STANDARD,
        name: 'قياسي',
        nameEn: 'Standard',
        description: 'تحليل → تخطيط → صياغة → مراجعة → إخراج',
        stages: this.getStandardPipelineStages().map((s) => ({
          id: s.id,
          name: s.name,
        })),
      },
      {
        type: PipelineType.ANALYSIS,
        name: 'تحليل معمق',
        nameEn: 'Deep Analysis',
        description: 'استخراج → تصنيف → تحليل → تركيب',
        stages: this.getAnalysisPipelineStages().map((s) => ({
          id: s.id,
          name: s.name,
        })),
      },
      {
        type: PipelineType.CREATIVE,
        name: 'إبداعي',
        nameEn: 'Creative',
        description: 'توليد أفكار → اختيار → توسيع → صقل',
        stages: this.getCreativePipelineStages().map((s) => ({
          id: s.id,
          name: s.name,
        })),
      },
      {
        type: PipelineType.TECHNICAL,
        name: 'تقني',
        nameEn: 'Technical',
        description: 'فهم → هيكلة → توثيق → تحقق',
        stages: this.getTechnicalPipelineStages().map((s) => ({
          id: s.id,
          name: s.name,
        })),
      },
    ];
  }

  /**
   * حذف حالات الذاكرة القديمة
   */
  static async cleanupMemoryStates(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await prisma.chainMemoryState.deleteMany({
      where: {
        isActive: false,
        updatedAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }
}
