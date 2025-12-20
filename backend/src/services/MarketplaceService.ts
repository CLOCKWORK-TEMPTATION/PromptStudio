
import prisma from '../lib/prisma';

export interface CreateMarketplacePromptData {
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  modelRecommendation: string;
  variables: any[];
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

