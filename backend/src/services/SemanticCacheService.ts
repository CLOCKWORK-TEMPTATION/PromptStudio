import crypto from 'crypto';
import OpenAI from 'openai';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import { config } from '../config/index.js';
import type {
  SemanticCacheEntry,
  CacheConfig,
  CacheAnalytics,
  CacheSearchResult,
  CacheLookupRequest,
  CacheLookupResponse,
  CacheStoreRequest,
  CacheInvalidateRequest,
  CacheInvalidateResponse,
  CacheStatistics,
} from '../../../shared/types/cache.js';

export class SemanticCacheService {
  private openai: OpenAI | null = null;
  private cacheConfig: CacheConfig | null = null;

  constructor() {
    if (config.openai.apiKey) {
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    }
  }

  private async getConfig(): Promise<CacheConfig> {
    if (this.cacheConfig) {
      return this.cacheConfig;
    }

    let dbConfig = await prisma.cacheConfig.findFirst();

    if (!dbConfig) {
      dbConfig = await prisma.cacheConfig.create({
        data: {
          enabled: true,
          similarityThreshold: 0.85,
          defaultTTLSeconds: 3600,
          maxCacheSize: 10000,
          invalidationRules: [],
        },
      });
    }

    this.cacheConfig = {
      id: dbConfig.id,
      enabled: dbConfig.enabled,
      similarityThreshold: dbConfig.similarityThreshold,
      defaultTTLSeconds: dbConfig.defaultTTLSeconds,
      maxCacheSize: dbConfig.maxCacheSize,
      invalidationRules: dbConfig.invalidationRules as any,
      updatedAt: dbConfig.updatedAt.toISOString(),
    };

    return this.cacheConfig;
  }

  async updateConfig(updates: Partial<CacheConfig>): Promise<CacheConfig> {
    const currentConfig = await this.getConfig();

    const updatedConfig = await prisma.cacheConfig.update({
      where: { id: currentConfig.id },
      data: {
        enabled: updates.enabled ?? currentConfig.enabled,
        similarityThreshold: updates.similarityThreshold ?? currentConfig.similarityThreshold,
        defaultTTLSeconds: updates.defaultTTLSeconds ?? currentConfig.defaultTTLSeconds,
        maxCacheSize: updates.maxCacheSize ?? currentConfig.maxCacheSize,
        invalidationRules: updates.invalidationRules ?? currentConfig.invalidationRules,
      },
    });

    this.cacheConfig = {
      id: updatedConfig.id,
      enabled: updatedConfig.enabled,
      similarityThreshold: updatedConfig.similarityThreshold,
      defaultTTLSeconds: updatedConfig.defaultTTLSeconds,
      maxCacheSize: updatedConfig.maxCacheSize,
      invalidationRules: updatedConfig.invalidationRules as any,
      updatedAt: updatedConfig.updatedAt.toISOString(),
    };

    return this.cacheConfig;
  }

  // Generate hash for exact matching
  private generateHash(prompt: string): string {
    return crypto.createHash('sha256').update(prompt.toLowerCase().trim()).digest('hex');
  }

  // Generate embedding using OpenAI
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      // Fallback: simple hash-based pseudo-embedding for testing
      const hash = this.generateHash(text);
      const embedding: number[] = [];
      for (let i = 0; i < 1536; i++) {
        const charCode = hash.charCodeAt(i % hash.length);
        embedding.push((charCode - 64) / 64);
      }
      return embedding;
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000), // Limit input length
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  // Calculate cosine similarity between two embeddings
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

  // Look up cache entry
  async lookup(request: CacheLookupRequest): Promise<CacheLookupResponse> {
    const config = await this.getConfig();

    if (!config.enabled) {
      return { hit: false, cached: false };
    }

    const { prompt, model, threshold = config.similarityThreshold, tags } = request;

    // First, try exact match via hash
    const promptHash = this.generateHash(prompt);
    const exactMatch = await this.findByHash(promptHash, model);

    if (exactMatch) {
      // Update hit count
      await this.recordHit(exactMatch.id);
      return {
        hit: true,
        entry: exactMatch,
        similarity: 1.0,
        cached: true,
      };
    }

    // Try semantic search
    try {
      const embedding = await this.generateEmbedding(prompt);
      const similarEntry = await this.findSimilar(embedding, threshold, model, tags);

      if (similarEntry) {
        await this.recordHit(similarEntry.entry.id);
        return {
          hit: true,
          entry: similarEntry.entry,
          similarity: similarEntry.similarity,
          cached: true,
        };
      }
    } catch (error) {
      console.error('Semantic search error:', error);
    }

    // Record miss
    await this.recordMiss();

    return { hit: false, cached: false };
  }

  private async findByHash(hash: string, model?: string): Promise<SemanticCacheEntry | null> {
    const where: any = {
      promptHash: hash,
      expiresAt: { gt: new Date() },
    };

    if (model) {
      where.model = model;
    }

    const entry = await prisma.semanticCache.findFirst({
      where,
      include: { tags: true },
    });

    if (!entry) return null;

    return this.formatEntry(entry);
  }

  private async findSimilar(
    embedding: number[],
    threshold: number,
    model?: string,
    tags?: string[]
  ): Promise<CacheSearchResult | null> {
    // Get all non-expired entries
    const where: any = {
      expiresAt: { gt: new Date() },
    };

    if (model) {
      where.model = model;
    }

    if (tags && tags.length > 0) {
      where.tags = {
        some: {
          name: { in: tags },
        },
      };
    }

    const entries = await prisma.semanticCache.findMany({
      where,
      include: { tags: true },
      take: 1000, // Limit for performance
    });

    let bestMatch: { entry: any; similarity: number } | null = null;

    for (const entry of entries) {
      const entryEmbedding = entry.embedding as number[];
      const similarity = this.cosineSimilarity(embedding, entryEmbedding);

      if (similarity >= threshold && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { entry, similarity };
      }
    }

    if (!bestMatch) return null;

    return {
      entry: this.formatEntry(bestMatch.entry),
      similarity: bestMatch.similarity,
    };
  }

  // Store new cache entry
  async store(request: CacheStoreRequest): Promise<SemanticCacheEntry> {
    const config = await this.getConfig();
    const { prompt, response, model, tags = [], ttlSeconds, userId } = request;

    // Check cache size
    const currentSize = await prisma.semanticCache.count();
    if (currentSize >= config.maxCacheSize) {
      // Remove oldest entries
      const toDelete = await prisma.semanticCache.findMany({
        orderBy: { lastAccessedAt: 'asc' },
        take: Math.floor(config.maxCacheSize * 0.1), // Remove 10%
        select: { id: true },
      });

      await prisma.semanticCache.deleteMany({
        where: { id: { in: toDelete.map(e => e.id) } },
      });
    }

    const promptHash = this.generateHash(prompt);
    const embedding = await this.generateEmbedding(prompt);
    const ttl = ttlSeconds || config.defaultTTLSeconds;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    // Estimate tokens saved (rough approximation)
    const tokensSaved = Math.ceil(response.length / 4);

    const entry = await prisma.semanticCache.create({
      data: {
        prompt,
        promptHash,
        embedding,
        response,
        model,
        tokensSaved,
        expiresAt,
        userId,
        tags: {
          create: tags.map(name => ({ name })),
        },
      },
      include: { tags: true },
    });

    return this.formatEntry(entry);
  }

  // Invalidate cache entries
  async invalidate(request: CacheInvalidateRequest): Promise<CacheInvalidateResponse> {
    const { type, ids, tags, pattern } = request;

    let deletedCount = 0;

    switch (type) {
      case 'id':
        if (ids && ids.length > 0) {
          const result = await prisma.semanticCache.deleteMany({
            where: { id: { in: ids } },
          });
          deletedCount = result.count;
        }
        break;

      case 'tag':
        if (tags && tags.length > 0) {
          // Find entries with matching tags
          const entries = await prisma.cacheTag.findMany({
            where: { name: { in: tags } },
            select: { cacheId: true },
          });
          const cacheIds = [...new Set(entries.map(e => e.cacheId))];

          if (cacheIds.length > 0) {
            const result = await prisma.semanticCache.deleteMany({
              where: { id: { in: cacheIds } },
            });
            deletedCount = result.count;
          }
        }
        break;

      case 'pattern':
        if (pattern) {
          // Find entries matching the pattern
          const entries = await prisma.semanticCache.findMany({
            where: {
              prompt: { contains: pattern },
            },
            select: { id: true },
          });

          if (entries.length > 0) {
            const result = await prisma.semanticCache.deleteMany({
              where: { id: { in: entries.map(e => e.id) } },
            });
            deletedCount = result.count;
          }
        }
        break;

      case 'all':
        const result = await prisma.semanticCache.deleteMany({});
        deletedCount = result.count;
        break;
    }

    return { deletedCount, success: true };
  }

  // Get analytics
  async getAnalytics(): Promise<CacheAnalytics> {
    const [
      totalEntries,
      stats,
      topTags,
      oldestEntry,
      newestEntry,
    ] = await Promise.all([
      prisma.semanticCache.count(),
      prisma.cacheStatistics.findMany({
        orderBy: { date: 'desc' },
        take: 30,
      }),
      prisma.cacheTag.groupBy({
        by: ['name'],
        _count: { name: true },
        orderBy: { _count: { name: 'desc' } },
        take: 10,
      }),
      prisma.semanticCache.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.semanticCache.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const totalHits = stats.reduce((sum, s) => sum + s.totalHits, 0);
    const totalMisses = stats.reduce((sum, s) => sum + s.totalMisses, 0);
    const tokensSaved = stats.reduce((sum, s) => sum + s.tokensSaved, 0);
    const costSaved = stats.reduce((sum, s) => sum + s.costSaved, 0);

    const hitRate = totalHits + totalMisses > 0
      ? totalHits / (totalHits + totalMisses)
      : 0;

    return {
      totalEntries,
      totalHits,
      totalMisses,
      hitRate,
      tokensSaved,
      estimatedCostSaved: costSaved,
      averageSimilarity: 0.9, // Would need to track this
      cacheSize: totalEntries,
      oldestEntry: oldestEntry?.createdAt.toISOString() || '',
      newestEntry: newestEntry?.createdAt.toISOString() || '',
      topTags: topTags.map(t => ({ tag: t.name, count: t._count.name })),
      dailyStats: stats.map(s => ({
        id: s.id,
        date: s.date.toISOString(),
        totalHits: s.totalHits,
        totalMisses: s.totalMisses,
        tokensSaved: s.tokensSaved,
        costSaved: s.costSaved,
      })),
    };
  }

  // Get all entries with pagination
  async getEntries(options: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    tags?: string[];
    search?: string;
  }): Promise<{ entries: SemanticCacheEntry[]; total: number }> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      tags,
      search,
    } = options;

    const where: any = {};

    if (tags && tags.length > 0) {
      where.tags = {
        some: { name: { in: tags } },
      };
    }

    if (search) {
      where.OR = [
        { prompt: { contains: search, mode: 'insensitive' } },
        { response: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [entries, total] = await Promise.all([
      prisma.semanticCache.findMany({
        where,
        include: { tags: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.semanticCache.count({ where }),
    ]);

    return {
      entries: entries.map(e => this.formatEntry(e)),
      total,
    };
  }

  // Helper methods
  private formatEntry(entry: any): SemanticCacheEntry {
    return {
      id: entry.id,
      prompt: entry.prompt,
      promptHash: entry.promptHash,
      embedding: entry.embedding as number[],
      response: entry.response,
      model: entry.model,
      hitCount: entry.hitCount,
      tokensSaved: entry.tokensSaved,
      createdAt: entry.createdAt.toISOString(),
      expiresAt: entry.expiresAt.toISOString(),
      lastAccessedAt: entry.lastAccessedAt.toISOString(),
      userId: entry.userId,
      tags: entry.tags?.map((t: any) => ({
        id: t.id,
        name: t.name,
        cacheId: t.cacheId,
      })) || [],
    };
  }

  private async recordHit(entryId: string): Promise<void> {
    const entry = await prisma.semanticCache.update({
      where: { id: entryId },
      data: {
        hitCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });

    // Update daily stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.cacheStatistics.upsert({
      where: { date: today },
      create: {
        date: today,
        totalHits: 1,
        tokensSaved: entry.tokensSaved,
        costSaved: entry.tokensSaved * 0.00001, // Rough estimate
      },
      update: {
        totalHits: { increment: 1 },
        tokensSaved: { increment: entry.tokensSaved },
        costSaved: { increment: entry.tokensSaved * 0.00001 },
      },
    });
  }

  private async recordMiss(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.cacheStatistics.upsert({
      where: { date: today },
      create: {
        date: today,
        totalMisses: 1,
      },
      update: {
        totalMisses: { increment: 1 },
      },
    });
  }

  // Cleanup expired entries
  async cleanup(): Promise<number> {
    const result = await prisma.semanticCache.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }
}

export const semanticCacheService = new SemanticCacheService();
export default semanticCacheService;
