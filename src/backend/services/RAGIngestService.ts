import prisma from '../lib/prisma.js';
import { EmbeddingUtil } from './embedding-util.js';
import crypto from 'crypto';

/**
 * خيارات معالجة النص
 */
export interface TextPreprocessingOptions {
  removeExtraWhitespace: boolean;
  normalizeUnicode: boolean;
  removeHtmlTags: boolean;
  lowercase: boolean;
  removeUrls: boolean;
  removeEmails: boolean;
  minChunkLength: number;
  maxChunkLength: number;
}

/**
 * نتيجة التقسيم
 */
export interface ChunkResult {
  id: string;
  content: string;
  index: number;
  startOffset: number;
  endOffset: number;
  tokenEstimate: number;
  hash: string;
}

/**
 * نتيجة الإدخال
 */
export interface IngestResult {
  success: boolean;
  documentId: string;
  chunksCreated: number;
  totalTokens: number;
  processingTimeMs: number;
  duplicatesSkipped: number;
  errors: string[];
}

/**
 * إحصائيات الإدخال
 */
export interface IngestStats {
  totalDocuments: number;
  totalChunks: number;
  totalTokens: number;
  avgChunksPerDocument: number;
  avgTokensPerChunk: number;
  duplicateRate: number;
}

/**
 * خدمة إدخال RAG المحسنة
 * تقسيم/تشذيب النصوص، تخزين Embeddings، واسترجاع بسياق
 */
export class RAGIngestService {
  private static defaultPreprocessingOptions: TextPreprocessingOptions = {
    removeExtraWhitespace: true,
    normalizeUnicode: true,
    removeHtmlTags: true,
    lowercase: false,
    removeUrls: false,
    removeEmails: true,
    minChunkLength: 100,
    maxChunkLength: 2000,
  };

  /**
   * معالجة النص قبل التقسيم
   */
  static preprocessText(
    text: string,
    options: Partial<TextPreprocessingOptions> = {}
  ): string {
    const opts = { ...this.defaultPreprocessingOptions, ...options };
    let processed = text;

    // إزالة HTML tags
    if (opts.removeHtmlTags) {
      processed = processed.replace(/<[^>]*>/g, ' ');
    }

    // إزالة URLs
    if (opts.removeUrls) {
      processed = processed.replace(/https?:\/\/[^\s]+/g, '[URL]');
    }

    // إزالة emails
    if (opts.removeEmails) {
      processed = processed.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
    }

    // تطبيع Unicode
    if (opts.normalizeUnicode) {
      processed = processed.normalize('NFKC');
    }

    // إزالة المسافات الزائدة
    if (opts.removeExtraWhitespace) {
      processed = processed
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/ +/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    // تحويل لأحرف صغيرة
    if (opts.lowercase) {
      processed = processed.toLowerCase();
    }

    return processed;
  }

  /**
   * تقسيم النص الذكي مع الحفاظ على السياق
   */
  static smartChunk(
    text: string,
    options: {
      chunkSize?: number;
      overlap?: number;
      respectSentences?: boolean;
      respectParagraphs?: boolean;
    } = {}
  ): ChunkResult[] {
    const {
      chunkSize = 1000,
      overlap = 200,
      respectSentences = true,
      respectParagraphs = true,
    } = options;

    const chunks: ChunkResult[] = [];
    let currentOffset = 0;

    // تقسيم حسب الفقرات أولاً
    const paragraphs = respectParagraphs
      ? text.split(/\n\n+/)
      : [text];

    let currentChunk = '';
    let chunkStartOffset = 0;

    for (const paragraph of paragraphs) {
      // إذا الفقرة كبيرة جداً، نقسمها بالجمل
      if (paragraph.length > chunkSize) {
        const sentences = respectSentences
          ? this.splitIntoSentences(paragraph)
          : [paragraph];

        for (const sentence of sentences) {
          if ((currentChunk + ' ' + sentence).length > chunkSize && currentChunk.length > 0) {
            // حفظ الـ chunk الحالي
            chunks.push(this.createChunkResult(
              currentChunk.trim(),
              chunks.length,
              chunkStartOffset,
              currentOffset
            ));

            // بدء chunk جديد مع overlap
            const overlapText = this.getOverlapText(currentChunk, overlap);
            currentChunk = overlapText + ' ' + sentence;
            chunkStartOffset = currentOffset - overlapText.length;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
          currentOffset += sentence.length + 1;
        }
      } else {
        if ((currentChunk + '\n\n' + paragraph).length > chunkSize && currentChunk.length > 0) {
          chunks.push(this.createChunkResult(
            currentChunk.trim(),
            chunks.length,
            chunkStartOffset,
            currentOffset
          ));

          const overlapText = this.getOverlapText(currentChunk, overlap);
          currentChunk = overlapText + '\n\n' + paragraph;
          chunkStartOffset = currentOffset - overlapText.length;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
        currentOffset += paragraph.length + 2;
      }
    }

    // إضافة الـ chunk الأخير
    if (currentChunk.trim().length > 0) {
      chunks.push(this.createChunkResult(
        currentChunk.trim(),
        chunks.length,
        chunkStartOffset,
        currentOffset
      ));
    }

    return chunks;
  }

  /**
   * تقسيم النص لجمل
   */
  private static splitIntoSentences(text: string): string[] {
    // دعم اللغة العربية والإنجليزية
    const sentenceEnders = /([.!?؟。！？])\s+/g;
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = sentenceEnders.exec(text)) !== null) {
      sentences.push(text.slice(lastIndex, match.index + 1).trim());
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      sentences.push(text.slice(lastIndex).trim());
    }

    return sentences.filter(s => s.length > 0);
  }

  /**
   * الحصول على نص الـ overlap
   */
  private static getOverlapText(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
      return text;
    }

    // محاولة القطع عند حدود الجمل
    const lastPart = text.slice(-overlapSize * 1.5);
    const sentenceStart = lastPart.search(/[.!?؟]\s+/);

    if (sentenceStart > 0 && sentenceStart < overlapSize) {
      return lastPart.slice(sentenceStart + 2).trim();
    }

    // القطع عند حدود الكلمات
    const words = text.split(/\s+/);
    let overlap = '';

    for (let i = words.length - 1; i >= 0; i--) {
      const newOverlap = words[i] + (overlap ? ' ' + overlap : '');
      if (newOverlap.length > overlapSize) {
        break;
      }
      overlap = newOverlap;
    }

    return overlap;
  }

  /**
   * إنشاء نتيجة chunk
   */
  private static createChunkResult(
    content: string,
    index: number,
    startOffset: number,
    endOffset: number
  ): ChunkResult {
    return {
      id: crypto.randomUUID(),
      content,
      index,
      startOffset,
      endOffset,
      tokenEstimate: EmbeddingUtil.estimateTokenCount(content),
      hash: crypto.createHash('sha256').update(content).digest('hex').slice(0, 16),
    };
  }

  /**
   * إدخال مستند كامل مع المعالجة والتخزين
   */
  static async ingestDocument(
    knowledgeBaseId: string,
    document: {
      title: string;
      content: string;
      source?: string;
      sourceUrl?: string;
      trustScore?: number;
      metadata?: Record<string, any>;
    },
    options: {
      preprocessing?: Partial<TextPreprocessingOptions>;
      chunking?: {
        chunkSize?: number;
        overlap?: number;
        respectSentences?: boolean;
        respectParagraphs?: boolean;
      };
      skipDuplicates?: boolean;
    } = {}
  ): Promise<IngestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let duplicatesSkipped = 0;

    try {
      // التحقق من وجود Knowledge Base
      const kb = await prisma.knowledgeBase.findUnique({
        where: { id: knowledgeBaseId },
      });

      if (!kb) {
        throw new Error('Knowledge base not found');
      }

      // معالجة النص
      const preprocessedText = this.preprocessText(
        document.content,
        options.preprocessing
      );

      // تقسيم النص
      const chunks = this.smartChunk(preprocessedText, {
        chunkSize: options.chunking?.chunkSize || kb.chunkSize,
        overlap: options.chunking?.overlap || kb.chunkOverlap,
        ...options.chunking,
      });

      // إنشاء document ID
      const documentId = crypto.randomUUID();
      let chunksCreated = 0;
      let totalTokens = 0;

      // معالجة كل chunk
      for (const chunk of chunks) {
        try {
          // التحقق من التكرار
          if (options.skipDuplicates !== false) {
            const existing = await prisma.knowledgeDocument.findFirst({
              where: {
                knowledgeBaseId,
                content: chunk.content,
              },
            });

            if (existing) {
              duplicatesSkipped++;
              continue;
            }
          }

          // توليد embedding
          const embedding = await EmbeddingUtil.generateEmbedding(chunk.content);

          // تخزين في قاعدة البيانات
          await prisma.knowledgeDocument.create({
            data: {
              knowledgeBaseId,
              title: `${document.title} [Part ${chunk.index + 1}]`,
              content: chunk.content,
              source: document.source,
              trustScore: document.trustScore || 1.0,
              embedding,
              metadata: {
                ...document.metadata,
                documentId,
                chunkIndex: chunk.index,
                startOffset: chunk.startOffset,
                endOffset: chunk.endOffset,
                chunkHash: chunk.hash,
                sourceUrl: document.sourceUrl,
                originalTitle: document.title,
              },
            },
          });

          chunksCreated++;
          totalTokens += chunk.tokenEstimate;
        } catch (chunkError) {
          errors.push(`Chunk ${chunk.index}: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}`);
        }
      }

      return {
        success: errors.length === 0,
        documentId,
        chunksCreated,
        totalTokens,
        processingTimeMs: Date.now() - startTime,
        duplicatesSkipped,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        documentId: '',
        chunksCreated: 0,
        totalTokens: 0,
        processingTimeMs: Date.now() - startTime,
        duplicatesSkipped,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * إدخال عدة مستندات دفعة واحدة
   */
  static async batchIngest(
    knowledgeBaseId: string,
    documents: Array<{
      title: string;
      content: string;
      source?: string;
      sourceUrl?: string;
      trustScore?: number;
      metadata?: Record<string, any>;
    }>,
    options: {
      preprocessing?: Partial<TextPreprocessingOptions>;
      chunking?: {
        chunkSize?: number;
        overlap?: number;
      };
      skipDuplicates?: boolean;
      concurrency?: number;
    } = {}
  ): Promise<{
    results: IngestResult[];
    summary: {
      totalDocuments: number;
      successfulDocuments: number;
      totalChunks: number;
      totalTokens: number;
      totalDuplicatesSkipped: number;
      totalProcessingTimeMs: number;
    };
  }> {
    const startTime = Date.now();
    const results: IngestResult[] = [];
    const concurrency = options.concurrency || 3;

    // معالجة بالتوازي
    for (let i = 0; i < documents.length; i += concurrency) {
      const batch = documents.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(doc => this.ingestDocument(knowledgeBaseId, doc, options))
      );
      results.push(...batchResults);
    }

    // حساب الملخص
    const summary = {
      totalDocuments: results.length,
      successfulDocuments: results.filter(r => r.success).length,
      totalChunks: results.reduce((sum, r) => sum + r.chunksCreated, 0),
      totalTokens: results.reduce((sum, r) => sum + r.totalTokens, 0),
      totalDuplicatesSkipped: results.reduce((sum, r) => sum + r.duplicatesSkipped, 0),
      totalProcessingTimeMs: Date.now() - startTime,
    };

    return { results, summary };
  }

  /**
   * استرجاع مع معايير trust/relevance
   */
  static async retrieveWithCriteria(
    knowledgeBaseId: string,
    query: string,
    criteria: {
      minRelevance?: number;
      minTrust?: number;
      maxChunks?: number;
      verifiedOnly?: boolean;
      weightRelevance?: number;
      weightTrust?: number;
      includeMetadata?: boolean;
    } = {}
  ): Promise<{
    chunks: Array<{
      id: string;
      content: string;
      title: string;
      source: string;
      relevanceScore: number;
      trustScore: number;
      combinedScore: number;
      isVerified: boolean;
      metadata?: Record<string, any>;
    }>;
    stats: {
      totalCandidates: number;
      filteredByRelevance: number;
      filteredByTrust: number;
      avgRelevance: number;
      avgTrust: number;
      avgCombinedScore: number;
    };
  }> {
    const {
      minRelevance = 0.6,
      minTrust = 0.5,
      maxChunks = 10,
      verifiedOnly = false,
      weightRelevance = 0.6,
      weightTrust = 0.4,
      includeMetadata = true,
    } = criteria;

    // توليد embedding للاستعلام
    const queryEmbedding = await EmbeddingUtil.generateEmbedding(query);

    // جلب المستندات
    const documents = await prisma.knowledgeDocument.findMany({
      where: {
        knowledgeBaseId,
        trustScore: { gte: minTrust },
        ...(verifiedOnly && { isVerified: true }),
      },
    });

    // حساب الدرجات
    let filteredByRelevance = 0;
    let filteredByTrust = 0;

    const scoredChunks = documents
      .map(doc => {
        const docEmbedding = doc.embedding as number[] | null;
        const relevanceScore = docEmbedding
          ? EmbeddingUtil.cosineSimilarity(queryEmbedding, docEmbedding)
          : 0;

        return {
          id: doc.id,
          content: doc.content,
          title: doc.title,
          source: doc.source || 'Unknown',
          relevanceScore,
          trustScore: doc.trustScore,
          combinedScore: relevanceScore * weightRelevance + doc.trustScore * weightTrust,
          isVerified: doc.isVerified,
          metadata: includeMetadata ? doc.metadata as Record<string, any> : undefined,
        };
      })
      .filter(chunk => {
        if (chunk.relevanceScore < minRelevance) {
          filteredByRelevance++;
          return false;
        }
        if (chunk.trustScore < minTrust) {
          filteredByTrust++;
          return false;
        }
        return true;
      })
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, maxChunks);

    // حساب الإحصائيات
    const avgRelevance = scoredChunks.length > 0
      ? scoredChunks.reduce((sum, c) => sum + c.relevanceScore, 0) / scoredChunks.length
      : 0;
    const avgTrust = scoredChunks.length > 0
      ? scoredChunks.reduce((sum, c) => sum + c.trustScore, 0) / scoredChunks.length
      : 0;
    const avgCombinedScore = scoredChunks.length > 0
      ? scoredChunks.reduce((sum, c) => sum + c.combinedScore, 0) / scoredChunks.length
      : 0;

    return {
      chunks: scoredChunks,
      stats: {
        totalCandidates: documents.length,
        filteredByRelevance,
        filteredByTrust,
        avgRelevance,
        avgTrust,
        avgCombinedScore,
      },
    };
  }

  /**
   * تحديث درجة الثقة بناءً على الاستخدام
   */
  static async updateTrustFromUsage(
    documentId: string,
    feedback: 'helpful' | 'not_helpful' | 'inaccurate'
  ): Promise<void> {
    const doc = await prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) return;

    let adjustment = 0;
    switch (feedback) {
      case 'helpful':
        adjustment = 0.02;
        break;
      case 'not_helpful':
        adjustment = -0.05;
        break;
      case 'inaccurate':
        adjustment = -0.15;
        break;
    }

    const newTrustScore = Math.max(0, Math.min(1, doc.trustScore + adjustment));

    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        trustScore: newTrustScore,
        retrievalCount: { increment: 1 },
        lastRetrieved: new Date(),
      },
    });
  }

  /**
   * الحصول على إحصائيات الإدخال
   */
  static async getIngestStats(knowledgeBaseId: string): Promise<IngestStats> {
    const [docCount, chunkStats, duplicateCheck] = await Promise.all([
      prisma.knowledgeDocument.groupBy({
        by: ['knowledgeBaseId'],
        where: { knowledgeBaseId },
        _count: { id: true },
      }),
      prisma.knowledgeDocument.aggregate({
        where: { knowledgeBaseId },
        _count: { id: true },
        _avg: { trustScore: true },
      }),
      prisma.knowledgeDocument.findMany({
        where: { knowledgeBaseId },
        select: { content: true },
      }),
    ]);

    // حساب التكرارات
    const contentHashes = duplicateCheck.map(d =>
      crypto.createHash('sha256').update(d.content).digest('hex')
    );
    const uniqueHashes = new Set(contentHashes);
    const duplicateRate = contentHashes.length > 0
      ? (contentHashes.length - uniqueHashes.size) / contentHashes.length
      : 0;

    // تقدير التوكنات
    const totalTokens = duplicateCheck.reduce(
      (sum, d) => sum + EmbeddingUtil.estimateTokenCount(d.content),
      0
    );

    const totalChunks = chunkStats._count.id || 0;

    return {
      totalDocuments: uniqueHashes.size,
      totalChunks,
      totalTokens,
      avgChunksPerDocument: uniqueHashes.size > 0 ? totalChunks / uniqueHashes.size : 0,
      avgTokensPerChunk: totalChunks > 0 ? totalTokens / totalChunks : 0,
      duplicateRate,
    };
  }

  /**
   * تنظيف المستندات منخفضة الجودة
   */
  static async cleanupLowQuality(
    knowledgeBaseId: string,
    options: {
      minTrustScore?: number;
      minRetrievalCount?: number;
      olderThanDays?: number;
    } = {}
  ): Promise<{ deletedCount: number }> {
    const {
      minTrustScore = 0.3,
      minRetrievalCount = 0,
      olderThanDays = 90,
    } = options;

    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await prisma.knowledgeDocument.deleteMany({
      where: {
        knowledgeBaseId,
        OR: [
          { trustScore: { lt: minTrustScore } },
          {
            AND: [
              { retrievalCount: { lte: minRetrievalCount } },
              { createdAt: { lt: cutoffDate } },
            ],
          },
        ],
      },
    });

    return { deletedCount: result.count };
  }
}

export default RAGIngestService;
