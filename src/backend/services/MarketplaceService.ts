
import prisma from '../lib/prisma';
import crypto from 'crypto';

/**
 * حالة النشر
 */
export enum PublishStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

/**
 * بيانات النسخة
 */
export interface VersionData {
  id: string;
  promptId: string;
  version: number;
  content: string;
  systemPrompt?: string;
  processPrompt?: string;
  taskPrompt?: string;
  outputPrompt?: string;
  qualityScore?: number;
  refinementReason?: string;
  changelog?: string;
  createdAt: Date;
}

/**
 * إحصائيات Prompt
 */
export interface PromptStats {
  views: number;
  uses: number;
  forks: number;
  avgRating: number;
  reviewCount: number;
  versionCount: number;
  trendingScore: number;
}

export interface CreateMarketplacePromptData {
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  modelRecommendation?: string;
  variables?: any[];
  systemPrompt?: string;
  processPrompt?: string;
  taskPrompt?: string;
  outputPrompt?: string;
  authorId?: string;
  authorName?: string;
  isFeatured?: boolean;
  isStaffPick?: boolean;
  status?: string;
}

export interface UpdateMarketplacePromptData {
  title?: string;
  description?: string;
  content?: string;
  category?: string;
  tags?: string[];
  modelRecommendation?: string;
  variables?: any[];
  isFeatured?: boolean;
  isStaffPick?: boolean;
  status?: string;
}

export interface CreateReviewData {
  promptId: string;
  reviewerId?: string;
  reviewerName?: string;
  rating: number;
  reviewText?: string;
  isVerified?: boolean;
}

export class MarketplaceService {
  // Get all approved marketplace prompts with filtering and sorting
  static async getApprovedPrompts(options: {
    category?: string;
    search?: string;
    sortBy?: 'popular' | 'recent' | 'rating' | 'trending';
    limit?: number;
    offset?: number;
  } = {}) {
    const {
      category,
      search,
      sortBy = 'popular',
      limit = 50,
      offset = 0,
    } = options;

    let orderBy: any = { cloneCount: 'desc' as const };

    switch (sortBy) {
      case 'recent':
        orderBy = { createdAt: 'desc' as const };
        break;
      case 'rating':
        orderBy = { avgRating: 'desc' as const };
        break;
      case 'trending':
        orderBy = { viewCount: 'desc' as const };
        break;
      case 'popular':
      default:
        orderBy = { cloneCount: 'desc' as const };
        break;
    }

    const where: any = {
      status: 'approved',
    };

    if (category && category !== 'all') {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ];
    }

    const prompts = await prisma.marketplacePrompt.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            rating: true,
            reviewText: true,
            createdAt: true,
            reviewer: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            reviewerName: true,
            isVerified: true,
          },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
    });

    const total = await prisma.marketplacePrompt.count({ where });

    return {
      prompts,
      total,
      hasMore: offset + limit < total,
    };
  }

  // Get a single prompt by ID with full details
  static async getPromptById(id: string, incrementView = false) {
    const prompt = await prisma.marketplacePrompt.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
            color: true,
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!prompt) {
      throw new Error('Prompt not found');
    }

    // Increment view count if requested
    if (incrementView) {
      await prisma.marketplacePrompt.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });
      prompt.viewCount += 1;
    }

    return prompt;
  }

  // Create a new marketplace prompt with advanced features
  static async createPrompt(data: CreateMarketplacePromptData & {
    systemPrompt?: string;
    processPrompt?: string;
    taskPrompt?: string;
    outputPrompt?: string;
    persona?: string;
    domain?: string;
    reasoningMode?: string;
    ragEnabled?: boolean;
    toolPlanning?: boolean;
    selfRefinement?: boolean;
  }) {
    return await prisma.marketplacePrompt.create({
      data: {
        title: data.title,
        description: data.description,
        content: data.content,
        systemPrompt: data.systemPrompt,
        processPrompt: data.processPrompt,
        taskPrompt: data.taskPrompt,
        outputPrompt: data.outputPrompt,
        persona: data.persona,
        domain: data.domain,
        reasoningMode: data.reasoningMode || 'default',
        ragEnabled: data.ragEnabled || false,
        toolPlanning: data.toolPlanning || false,
        selfRefinement: data.selfRefinement || false,
        category: data.category,
        tags: data.tags,
        modelRecommendation: data.modelRecommendation,
        variables: data.variables,
        authorId: data.authorId,
        authorName: data.authorName || 'Anonymous',
        isFeatured: data.isFeatured || false,
        isStaffPick: data.isStaffPick || false,
        status: data.status || 'pending',
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  }

  // Update an existing prompt
  static async updatePrompt(id: string, data: UpdateMarketplacePromptData) {
    return await prisma.marketplacePrompt.update({
      where: { id },
      data,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  }

  // Delete a prompt
  static async deletePrompt(id: string) {
    return await prisma.marketplacePrompt.delete({
      where: { id },
    });
  }

  // Increment clone count
  static async incrementCloneCount(id: string) {
    return await prisma.marketplacePrompt.update({
      where: { id },
      data: { cloneCount: { increment: 1 } },
    });
  }

  // Create a review for a prompt
  static async createReview(data: CreateReviewData) {
    const review = await prisma.marketplaceReview.create({
      data: {
        promptId: data.promptId,
        reviewerId: data.reviewerId,
        reviewerName: data.reviewerName || 'Anonymous',
        rating: data.rating,
        reviewText: data.reviewText,
        isVerified: data.isVerified || false,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Update prompt's average rating and review count
    await this.updatePromptStats(data.promptId);

    return review;
  }

  // Update prompt statistics (rating, review count)
  static async updatePromptStats(promptId: string) {
    const reviews = await prisma.marketplaceReview.findMany({
      where: { promptId },
      select: { rating: true },
    });

    if (reviews.length === 0) return;

    const avgRating = reviews.reduce((sum: number, review: { rating: number }) => sum + review.rating, 0) / reviews.length;

    await prisma.marketplacePrompt.update({
      where: { id: promptId },
      data: {
        avgRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
        reviewCount: reviews.length,
      },
    });
  }

  // Get reviews for a prompt
  static async getPromptReviews(promptId: string, options: { limit?: number; offset?: number } = {}) {
    const { limit = 20, offset = 0 } = options;

    const reviews = await prisma.marketplaceReview.findMany({
      where: { promptId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    const total = await prisma.marketplaceReview.count({ where: { promptId } });

    return {
      reviews,
      total,
      hasMore: offset + limit < total,
    };
  }

  // Get marketplace statistics
  static async getMarketplaceStats() {
    const totalPrompts = await prisma.marketplacePrompt.count({
      where: { status: 'approved' }
    });

    const totalReviews = await prisma.marketplaceReview.count();

    return {
      totalPrompts,
      totalReviews
    };
  }

  // ==================== Version Management ====================

  /**
   * إنشاء نسخة جديدة
   */
  static async createVersion(
    promptId: string,
    data: {
      content: string;
      systemPrompt?: string;
      processPrompt?: string;
      taskPrompt?: string;
      outputPrompt?: string;
      qualityScore?: number;
      refinementReason?: string;
      changelog?: string;
    }
  ): Promise<VersionData> {
    // الحصول على آخر رقم نسخة
    const lastVersion = await prisma.promptVersion.findFirst({
      where: { promptId },
      orderBy: { version: 'desc' },
    });

    const newVersionNum = (lastVersion?.version || 0) + 1;

    const version = await prisma.promptVersion.create({
      data: {
        promptId,
        version: newVersionNum,
        content: data.content,
        systemPrompt: data.systemPrompt,
        processPrompt: data.processPrompt,
        taskPrompt: data.taskPrompt,
        outputPrompt: data.outputPrompt,
        qualityScore: data.qualityScore,
        refinementReason: data.refinementReason,
      },
    });

    return {
      id: version.id,
      promptId: version.promptId,
      version: version.version,
      content: version.content,
      systemPrompt: version.systemPrompt || undefined,
      processPrompt: version.processPrompt || undefined,
      taskPrompt: version.taskPrompt || undefined,
      outputPrompt: version.outputPrompt || undefined,
      qualityScore: version.qualityScore || undefined,
      refinementReason: version.refinementReason || undefined,
      changelog: data.changelog,
      createdAt: version.createdAt,
    };
  }

  /**
   * الحصول على تاريخ النسخ
   */
  static async getVersionHistory(promptId: string): Promise<VersionData[]> {
    const versions = await prisma.promptVersion.findMany({
      where: { promptId },
      orderBy: { version: 'desc' },
    });

    return versions.map(v => ({
      id: v.id,
      promptId: v.promptId,
      version: v.version,
      content: v.content,
      systemPrompt: v.systemPrompt || undefined,
      processPrompt: v.processPrompt || undefined,
      taskPrompt: v.taskPrompt || undefined,
      outputPrompt: v.outputPrompt || undefined,
      qualityScore: v.qualityScore || undefined,
      refinementReason: v.refinementReason || undefined,
      createdAt: v.createdAt,
    }));
  }

  /**
   * مقارنة نسختين
   */
  static async compareVersions(
    promptId: string,
    version1: number,
    version2: number
  ): Promise<{
    version1: VersionData;
    version2: VersionData;
    changes: Array<{ field: string; oldValue: string; newValue: string }>;
  }> {
    const [v1, v2] = await Promise.all([
      prisma.promptVersion.findFirst({ where: { promptId, version: version1 } }),
      prisma.promptVersion.findFirst({ where: { promptId, version: version2 } }),
    ]);

    if (!v1 || !v2) {
      throw new Error('Version not found');
    }

    const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];
    const fieldsToCompare = ['content', 'systemPrompt', 'processPrompt', 'taskPrompt', 'outputPrompt'];

    for (const field of fieldsToCompare) {
      const oldVal = (v1 as any)[field] || '';
      const newVal = (v2 as any)[field] || '';
      if (oldVal !== newVal) {
        changes.push({ field, oldValue: oldVal, newValue: newVal });
      }
    }

    return {
      version1: this.formatVersion(v1),
      version2: this.formatVersion(v2),
      changes,
    };
  }

  /**
   * استعادة نسخة قديمة
   */
  static async restoreVersion(
    promptId: string,
    versionNumber: number,
    authorId: string
  ): Promise<any> {
    const [prompt, version] = await Promise.all([
      prisma.marketplacePrompt.findUnique({ where: { id: promptId } }),
      prisma.promptVersion.findFirst({ where: { promptId, version: versionNumber } }),
    ]);

    if (!prompt || prompt.authorId !== authorId) {
      throw new Error('Prompt not found or unauthorized');
    }

    if (!version) {
      throw new Error('Version not found');
    }

    // تحديث الـ prompt للنسخة المحددة
    const updated = await prisma.marketplacePrompt.update({
      where: { id: promptId },
      data: {
        content: version.content,
        systemPrompt: version.systemPrompt,
        processPrompt: version.processPrompt,
        taskPrompt: version.taskPrompt,
        outputPrompt: version.outputPrompt,
        updatedAt: new Date(),
      },
    });

    // إنشاء نسخة جديدة كـ restore
    await this.createVersion(promptId, {
      content: version.content,
      systemPrompt: version.systemPrompt || undefined,
      processPrompt: version.processPrompt || undefined,
      taskPrompt: version.taskPrompt || undefined,
      outputPrompt: version.outputPrompt || undefined,
      changelog: `Restored from version ${versionNumber}`,
    });

    return updated;
  }

  // ==================== Fork Management ====================

  /**
   * استنساخ (Fork) prompt
   */
  static async forkPrompt(
    originalPromptId: string,
    userId: string,
    data: {
      title?: string;
      description?: string;
    } = {}
  ): Promise<any> {
    const original = await prisma.marketplacePrompt.findUnique({
      where: { id: originalPromptId },
    });

    if (!original) {
      throw new Error('Original prompt not found');
    }

    // زيادة عداد الـ clones (forks)
    await prisma.marketplacePrompt.update({
      where: { id: originalPromptId },
      data: { cloneCount: original.cloneCount + 1 },
    });

    // إنشاء نسخة جديدة
    const forked = await prisma.marketplacePrompt.create({
      data: {
        title: data.title || `${original.title} (Fork)`,
        description: data.description || original.description,
        content: original.content,
        systemPrompt: original.systemPrompt,
        processPrompt: original.processPrompt,
        taskPrompt: original.taskPrompt,
        outputPrompt: original.outputPrompt,
        category: original.category,
        tags: original.tags,
        modelRecommendation: original.modelRecommendation,
        variables: original.variables,
        authorId: userId,
        forkedFromId: originalPromptId,
        status: PublishStatus.DRAFT,
        viewCount: 0,
        cloneCount: 0,
        avgRating: 0,
        reviewCount: 0,
      },
    });

    // إنشاء النسخة الأولى
    await this.createVersion(forked.id, {
      content: original.content,
      systemPrompt: original.systemPrompt || undefined,
      processPrompt: original.processPrompt || undefined,
      taskPrompt: original.taskPrompt || undefined,
      outputPrompt: original.outputPrompt || undefined,
      changelog: `Forked from ${original.title}`,
    });

    return forked;
  }

  /**
   * الحصول على الـ forks لـ prompt
   */
  static async getPromptForks(promptId: string, options: { limit?: number; offset?: number } = {}) {
    const { limit = 20, offset = 0 } = options;

    const forks = await prisma.marketplacePrompt.findMany({
      where: { forkedFromId: promptId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    const total = await prisma.marketplacePrompt.count({ where: { forkedFromId: promptId } });

    return { forks, total, hasMore: offset + limit < total };
  }

  // ==================== Advanced Reviews ====================

  /**
   * التصويت على مراجعة
   */
  static async voteReview(
    reviewId: string,
    userId: string,
    vote: 'helpful' | 'not_helpful'
  ): Promise<any> {
    const review = await prisma.marketplaceReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    // في التنفيذ الكامل، يجب تتبع تصويتات المستخدمين لمنع التصويت المتكرر
    const updateData = vote === 'helpful'
      ? { helpfulCount: { increment: 1 } }
      : { notHelpfulCount: { increment: 1 } };

    return await prisma.marketplaceReview.update({
      where: { id: reviewId },
      data: updateData,
    });
  }

  /**
   * الحصول على المراجعات الأكثر فائدة
   */
  static async getMostHelpfulReviews(promptId: string, limit: number = 5) {
    return await prisma.marketplaceReview.findMany({
      where: { promptId },
      orderBy: { helpfulCount: 'desc' },
      take: limit,
      include: {
        reviewer: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });
  }

  // ==================== Stats & Analytics ====================

  /**
   * الحصول على إحصائيات prompt مفصلة
   */
  static async getPromptStats(promptId: string): Promise<PromptStats> {
    const prompt = await prisma.marketplacePrompt.findUnique({
      where: { id: promptId },
      include: {
        promptVersions: true,
        reviews: true,
      },
    });

    if (!prompt) {
      throw new Error('Prompt not found');
    }

    // حساب Trending Score
    const trendingScore = this.calculateTrendingScore(
      prompt.viewCount,
      prompt.cloneCount,
      prompt.avgRating,
      prompt.createdAt
    );

    return {
      views: prompt.viewCount,
      uses: prompt.cloneCount, // نستخدم cloneCount كبديل لـ uses
      forks: prompt.cloneCount,
      avgRating: prompt.avgRating,
      reviewCount: prompt.reviewCount,
      versionCount: prompt.promptVersions.length,
      trendingScore,
    };
  }

  /**
   * حساب Trending Score
   */
  private static calculateTrendingScore(
    views: number,
    clones: number,
    rating: number,
    createdAt: Date
  ): number {
    const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const ageDecay = Math.max(0.1, 1 - ageInDays / 30);

    const score = views * 0.1 + clones * 0.4 + rating * 10;
    return score * ageDecay;
  }

  /**
   * الحصول على Prompts الأكثر رواجاً
   */
  static async getTrendingPrompts(limit: number = 10) {
    const prompts = await prisma.marketplacePrompt.findMany({
      where: { status: 'approved' },
      orderBy: [
        { viewCount: 'desc' },
        { cloneCount: 'desc' },
        { avgRating: 'desc' },
      ],
      take: limit * 2, // نجلب أكثر للترتيب
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // حساب trending score وإعادة الترتيب
    const withScores = prompts.map(p => ({
      ...p,
      trendingScore: this.calculateTrendingScore(p.viewCount, p.cloneCount, p.avgRating, p.createdAt),
    }));

    return withScores
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);
  }

  /**
   * تسجيل استخدام prompt
   */
  static async recordUsage(promptId: string): Promise<void> {
    await prisma.marketplacePrompt.update({
      where: { id: promptId },
      data: { cloneCount: { increment: 1 } },
    });
  }

  // ==================== Helper Methods ====================

  /**
   * تنسيق النسخة
   */
  private static formatVersion(version: any): VersionData {
    return {
      id: version.id,
      promptId: version.promptId,
      version: version.version,
      content: version.content,
      systemPrompt: version.systemPrompt || undefined,
      processPrompt: version.processPrompt || undefined,
      taskPrompt: version.taskPrompt || undefined,
      outputPrompt: version.outputPrompt || undefined,
      qualityScore: version.qualityScore || undefined,
      refinementReason: version.refinementReason || undefined,
      createdAt: version.createdAt,
    };
  }
}