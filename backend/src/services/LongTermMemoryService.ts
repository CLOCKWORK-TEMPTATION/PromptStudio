import crypto from 'crypto';
import prisma from '../lib/prisma';
import { SemanticCacheService } from './SemanticCacheService';

/**
 * أنواع السياقات المخزنة
 */
export enum MemoryType {
  TASK_CONTEXT = 'task_context',       // سياق المهمة الكامل
  STAGE_OUTPUT = 'stage_output',       // مخرجات المراحل
  USER_PREFERENCE = 'user_preference', // تفضيلات المستخدم
  PATTERN = 'pattern',                 // أنماط متكررة
  INSIGHT = 'insight',                 // رؤى مستخلصة
}

/**
 * سجل الذاكرة
 */
export interface MemoryRecord {
  id: string;
  type: MemoryType;
  key: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
  accessCount: number;
  relevanceScore: number;
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt?: Date;
  tags: string[];
}

/**
 * سياق التنفيذ المخزن
 */
export interface ExecutionContext {
  taskId: string;
  taskType: string;
  input: string;
  stages: {
    stageId: string;
    stageName: string;
    input: string;
    output: string;
    duration: number;
    timestamp: Date;
  }[];
  finalOutput: string;
  success: boolean;
  metadata: Record<string, any>;
}

/**
 * نتيجة البحث في الذاكرة
 */
export interface MemorySearchResult {
  record: MemoryRecord;
  similarity: number;
  relevance: number;
}

/**
 * خيارات استرجاع الذاكرة
 */
export interface MemoryRetrievalOptions {
  type?: MemoryType;
  tags?: string[];
  limit?: number;
  minRelevance?: number;
  includeExpired?: boolean;
  taskType?: string;
}

/**
 * خدمة الذاكرة طويلة الأمد
 * تخزن السياقات والمخرجات لإعادة استخدامها في المهام المتكررة
 */
export class LongTermMemoryService {
  private semanticCache: SemanticCacheService;

  constructor() {
    this.semanticCache = new SemanticCacheService();
  }

  /**
   * تخزين سياق تنفيذ كامل
   */
  async storeExecutionContext(context: ExecutionContext): Promise<string> {
    const contextKey = this.generateContextKey(context);

    // تخزين السياق الكامل
    const mainRecord = await this.store({
      type: MemoryType.TASK_CONTEXT,
      key: contextKey,
      content: JSON.stringify({
        taskType: context.taskType,
        input: context.input,
        finalOutput: context.finalOutput,
        success: context.success,
      }),
      metadata: {
        taskId: context.taskId,
        taskType: context.taskType,
        stageCount: context.stages.length,
        totalDuration: context.stages.reduce((sum, s) => sum + s.duration, 0),
        ...context.metadata,
      },
      tags: [context.taskType, context.success ? 'successful' : 'failed'],
    });

    // تخزين مخرجات كل مرحلة بشكل منفصل للوصول السريع
    for (const stage of context.stages) {
      await this.store({
        type: MemoryType.STAGE_OUTPUT,
        key: `${contextKey}:${stage.stageId}`,
        content: stage.output,
        metadata: {
          taskId: context.taskId,
          stageId: stage.stageId,
          stageName: stage.stageName,
          stageInput: stage.input.substring(0, 500), // تخزين ملخص المدخل
          duration: stage.duration,
        },
        tags: [context.taskType, stage.stageName],
      });
    }

    // استخراج وتخزين الأنماط
    await this.extractAndStorePatterns(context);

    return mainRecord;
  }

  /**
   * استرجاع سياقات مشابهة
   */
  async retrieveSimilarContexts(
    query: string,
    options: MemoryRetrievalOptions = {}
  ): Promise<MemorySearchResult[]> {
    const {
      type = MemoryType.TASK_CONTEXT,
      tags,
      limit = 5,
      minRelevance = 0.7,
      taskType,
    } = options;

    // البحث الدلالي
    const cacheResult = await this.semanticCache.lookup({
      prompt: query,
      threshold: minRelevance,
      tags: tags || (taskType ? [taskType] : undefined),
    });

    const results: MemorySearchResult[] = [];

    // البحث في قاعدة البيانات
    const whereClause: any = {
      type,
      ...(tags && tags.length > 0 ? { tags: { hasSome: tags } } : {}),
      ...(options.includeExpired ? {} : {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      }),
    };

    if (taskType) {
      whereClause.metadata = {
        path: ['taskType'],
        equals: taskType,
      };
    }

    const records = await prisma.longTermMemory.findMany({
      where: whereClause,
      orderBy: [
        { relevanceScore: 'desc' },
        { accessCount: 'desc' },
        { lastAccessedAt: 'desc' },
      ],
      take: limit * 2, // نحصل على أكثر ثم نفلتر
    });

    for (const record of records) {
      const embedding = record.embedding as number[] | null;
      let similarity = 0.5; // قيمة افتراضية

      // حساب التشابه إذا توفر الـ embedding
      if (embedding && cacheResult.entry?.embedding) {
        similarity = this.cosineSimilarity(embedding, cacheResult.entry.embedding);
      }

      // حساب الصلة بناءً على عوامل متعددة
      const relevance = this.calculateRelevance(record, similarity);

      if (relevance >= minRelevance) {
        results.push({
          record: this.formatRecord(record),
          similarity,
          relevance,
        });
      }
    }

    // ترتيب النتائج وتحديد العدد
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * استرجاع مخرجات مرحلة سابقة مشابهة
   */
  async retrieveSimilarStageOutput(
    stageName: string,
    stageInput: string,
    options: MemoryRetrievalOptions = {}
  ): Promise<MemorySearchResult | null> {
    const results = await this.retrieveSimilarContexts(stageInput, {
      ...options,
      type: MemoryType.STAGE_OUTPUT,
      tags: [...(options.tags || []), stageName],
      limit: 1,
    });

    return results[0] || null;
  }

  /**
   * استرجاع الأنماط المتكررة لنوع مهمة معين
   */
  async retrievePatterns(
    taskType: string,
    limit: number = 10
  ): Promise<MemoryRecord[]> {
    const records = await prisma.longTermMemory.findMany({
      where: {
        type: MemoryType.PATTERN,
        tags: { has: taskType },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: [
        { accessCount: 'desc' },
        { relevanceScore: 'desc' },
      ],
      take: limit,
    });

    return records.map(r => this.formatRecord(r));
  }

  /**
   * تخزين سجل ذاكرة جديد
   */
  async store(data: {
    type: MemoryType;
    key: string;
    content: string;
    metadata?: Record<string, any>;
    tags?: string[];
    ttlSeconds?: number;
  }): Promise<string> {
    const { type, key, content, metadata = {}, tags = [], ttlSeconds } = data;

    // توليد embedding للمحتوى
    const embedding = await this.generateEmbedding(content);

    // حساب تاريخ الانتهاء
    const expiresAt = ttlSeconds
      ? new Date(Date.now() + ttlSeconds * 1000)
      : null;

    // التحقق من وجود سجل بنفس المفتاح
    const existing = await prisma.longTermMemory.findFirst({
      where: { key, type },
    });

    if (existing) {
      // تحديث السجل الموجود
      const updated = await prisma.longTermMemory.update({
        where: { id: existing.id },
        data: {
          content,
          metadata,
          embedding,
          tags,
          expiresAt,
          lastAccessedAt: new Date(),
          accessCount: { increment: 1 },
        },
      });
      return updated.id;
    }

    // إنشاء سجل جديد
    const record = await prisma.longTermMemory.create({
      data: {
        type,
        key,
        content,
        metadata,
        embedding,
        tags,
        expiresAt,
        relevanceScore: 1.0,
        accessCount: 1,
      },
    });

    return record.id;
  }

  /**
   * تحديث درجة الصلة بناءً على الاستخدام
   */
  async updateRelevance(recordId: string, feedback: 'positive' | 'negative'): Promise<void> {
    const record = await prisma.longTermMemory.findUnique({
      where: { id: recordId },
    });

    if (!record) return;

    const adjustment = feedback === 'positive' ? 0.05 : -0.1;
    const newScore = Math.max(0, Math.min(1, record.relevanceScore + adjustment));

    await prisma.longTermMemory.update({
      where: { id: recordId },
      data: {
        relevanceScore: newScore,
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });
  }

  /**
   * دمج السياقات المتشابهة لتحسين الأداء
   */
  async consolidateMemory(): Promise<{ merged: number; deleted: number }> {
    let merged = 0;
    let deleted = 0;

    // الحصول على جميع السجلات مجمعة حسب النوع والـ tags
    const groups = await prisma.longTermMemory.groupBy({
      by: ['type'],
      _count: { id: true },
    });

    for (const group of groups) {
      if (group._count.id < 2) continue;

      const records = await prisma.longTermMemory.findMany({
        where: { type: group.type },
        orderBy: { createdAt: 'asc' },
      });

      // البحث عن السجلات المتشابهة جداً
      for (let i = 0; i < records.length; i++) {
        for (let j = i + 1; j < records.length; j++) {
          const r1 = records[i];
          const r2 = records[j];

          // حساب التشابه
          const embedding1 = r1.embedding as number[] | null;
          const embedding2 = r2.embedding as number[] | null;

          if (embedding1 && embedding2) {
            const similarity = this.cosineSimilarity(embedding1, embedding2);

            // دمج السجلات المتشابهة جداً (> 0.95)
            if (similarity > 0.95) {
              // الاحتفاظ بالسجل الأكثر استخداماً
              const keepRecord = r1.accessCount >= r2.accessCount ? r1 : r2;
              const deleteRecord = r1.accessCount >= r2.accessCount ? r2 : r1;

              // تحديث السجل المحتفظ به
              await prisma.longTermMemory.update({
                where: { id: keepRecord.id },
                data: {
                  accessCount: keepRecord.accessCount + deleteRecord.accessCount,
                  relevanceScore: Math.max(keepRecord.relevanceScore, deleteRecord.relevanceScore),
                  tags: [...new Set([...keepRecord.tags, ...deleteRecord.tags])],
                },
              });

              // حذف السجل المكرر
              await prisma.longTermMemory.delete({
                where: { id: deleteRecord.id },
              });

              merged++;
              deleted++;

              // إزالة السجل المحذوف من القائمة
              records.splice(j, 1);
              j--;
            }
          }
        }
      }
    }

    return { merged, deleted };
  }

  /**
   * تنظيف السجلات المنتهية الصلاحية
   */
  async cleanup(): Promise<number> {
    const result = await prisma.longTermMemory.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }

  /**
   * الحصول على إحصائيات الذاكرة
   */
  async getStats(): Promise<{
    totalRecords: number;
    byType: Record<string, number>;
    avgRelevance: number;
    topTags: { tag: string; count: number }[];
    memoryUsage: number;
  }> {
    const [total, byType, avgRelevance, allRecords] = await Promise.all([
      prisma.longTermMemory.count(),
      prisma.longTermMemory.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
      prisma.longTermMemory.aggregate({
        _avg: { relevanceScore: true },
      }),
      prisma.longTermMemory.findMany({
        select: { tags: true, content: true },
      }),
    ]);

    // حساب الـ tags الأكثر استخداماً
    const tagCounts: Record<string, number> = {};
    let memoryUsage = 0;

    for (const record of allRecords) {
      for (const tag of record.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
      memoryUsage += record.content.length;
    }

    const topTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRecords: total,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      avgRelevance: avgRelevance._avg.relevanceScore || 0,
      topTags,
      memoryUsage,
    };
  }

  // ========== Helper Methods ==========

  private generateContextKey(context: ExecutionContext): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${context.taskType}:${context.input.substring(0, 200)}`)
      .digest('hex')
      .substring(0, 16);
    return `ctx:${context.taskType}:${hash}`;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // استخدام الـ SemanticCacheService لتوليد الـ embedding
    // هذا placeholder - في الإنتاج يستخدم OpenAI أو نموذج مشابه
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    const embedding: number[] = [];
    for (let i = 0; i < 1536; i++) {
      const charCode = hash.charCodeAt(i % hash.length);
      embedding.push((charCode - 64) / 64);
    }
    return embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private calculateRelevance(record: any, similarity: number): number {
    // حساب الصلة بناءً على عوامل متعددة
    const ageFactor = this.calculateAgeFactor(record.lastAccessedAt);
    const usageFactor = Math.min(record.accessCount / 100, 1);
    const baseFactor = record.relevanceScore;

    // المعادلة: 40% تشابه + 30% صلة أساسية + 20% استخدام + 10% حداثة
    return (
      similarity * 0.4 +
      baseFactor * 0.3 +
      usageFactor * 0.2 +
      ageFactor * 0.1
    );
  }

  private calculateAgeFactor(lastAccessed: Date): number {
    const ageInDays = (Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    // تناقص تدريجي: 1.0 لليوم الحالي، 0.5 بعد أسبوع، 0.1 بعد شهر
    return Math.max(0.1, 1 - (ageInDays / 30));
  }

  private async extractAndStorePatterns(context: ExecutionContext): Promise<void> {
    // استخراج الأنماط من السياق
    if (!context.success) return; // فقط من التنفيذات الناجحة

    // نمط: تسلسل المراحل الناجح
    const stageSequence = context.stages.map(s => s.stageName).join(' → ');

    await this.store({
      type: MemoryType.PATTERN,
      key: `pattern:sequence:${context.taskType}`,
      content: JSON.stringify({
        sequence: stageSequence,
        avgDuration: context.stages.reduce((sum, s) => sum + s.duration, 0) / context.stages.length,
      }),
      metadata: {
        taskType: context.taskType,
        patternType: 'sequence',
      },
      tags: [context.taskType, 'sequence'],
    });

    // نمط: العلاقة بين المدخل والمخرج
    if (context.input && context.finalOutput) {
      await this.store({
        type: MemoryType.INSIGHT,
        key: `insight:io:${this.generateContextKey(context)}`,
        content: JSON.stringify({
          inputSummary: context.input.substring(0, 200),
          outputSummary: context.finalOutput.substring(0, 200),
          transformationType: this.detectTransformationType(context.input, context.finalOutput),
        }),
        metadata: {
          taskType: context.taskType,
          insightType: 'io_relationship',
        },
        tags: [context.taskType, 'insight'],
        ttlSeconds: 60 * 60 * 24 * 30, // 30 يوم
      });
    }
  }

  private detectTransformationType(input: string, output: string): string {
    // كشف نوع التحويل
    const inputLength = input.length;
    const outputLength = output.length;
    const ratio = outputLength / inputLength;

    if (ratio < 0.5) return 'summarization';
    if (ratio > 2) return 'expansion';
    if (ratio >= 0.8 && ratio <= 1.2) return 'transformation';
    return 'mixed';
  }

  private formatRecord(record: any): MemoryRecord {
    return {
      id: record.id,
      type: record.type as MemoryType,
      key: record.key,
      content: record.content,
      metadata: record.metadata || {},
      embedding: record.embedding as number[] | undefined,
      accessCount: record.accessCount,
      relevanceScore: record.relevanceScore,
      createdAt: record.createdAt,
      lastAccessedAt: record.lastAccessedAt,
      expiresAt: record.expiresAt || undefined,
      tags: record.tags,
    };
  }
}

export const longTermMemoryService = new LongTermMemoryService();
export default longTermMemoryService;
