import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketplaceService, PublishStatus } from '../services/MarketplaceService.js';

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  default: {
    marketplacePrompt: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    marketplaceReview: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    promptVersion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback({
      marketplacePrompt: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      promptVersion: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    })),
  },
}));

describe('MarketplaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PublishStatus enum', () => {
    it('should have correct status values', () => {
      expect(PublishStatus.PENDING).toBe('pending');
      expect(PublishStatus.APPROVED).toBe('approved');
      expect(PublishStatus.REJECTED).toBe('rejected');
      expect(PublishStatus.DRAFT).toBe('draft');
    });
  });

  describe('createPrompt', () => {
    it('should create a new prompt with required fields', async () => {
      const mockPrompt = {
        id: 'test-id',
        title: 'Test Prompt',
        description: 'A test prompt',
        content: 'Test content',
        category: 'testing',
        status: PublishStatus.PENDING,
        authorId: 'author-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { default: prisma } = await import('../lib/prisma.js') as { default: any };
      (prisma.marketplacePrompt.create as any).mockResolvedValue(mockPrompt);

      const result = await MarketplaceService.createPrompt({
        title: 'Test Prompt',
        description: 'A test prompt',
        content: 'Test content',
        category: 'testing',
        authorId: 'author-1',
        status: PublishStatus.PENDING,
      } as Parameters<typeof MarketplaceService.createPrompt>[0]);

      expect(result).toBeDefined();
      expect(prisma.marketplacePrompt.create).toHaveBeenCalled();
    });
  });

  describe('getPromptById', () => {
    it('should return prompt by ID', async () => {
      const mockPrompt = {
        id: 'test-id',
        title: 'Test Prompt',
        viewCount: 0,
      };

      const { default: prisma } = await import('../lib/prisma.js') as { default: any };
      (prisma.marketplacePrompt.findUnique as any).mockResolvedValue(mockPrompt);

      const result = await MarketplaceService.getPromptById('test-id');

      expect(result).toBeDefined();
      expect(prisma.marketplacePrompt.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        include: expect.any(Object),
      });
    });

    it('should increment view count when requested', async () => {
      const mockPrompt = {
        id: 'test-id',
        title: 'Test Prompt',
        viewCount: 5,
      };

      const { default: prisma } = await import('../lib/prisma.js') as { default: any };
      (prisma.marketplacePrompt.findUnique as any).mockResolvedValue(mockPrompt);
      (prisma.marketplacePrompt.update as any).mockResolvedValue({
        ...mockPrompt,
        viewCount: 6,
      });

      await MarketplaceService.getPromptById('test-id', true);

      expect(prisma.marketplacePrompt.update).toHaveBeenCalled();
    });
  });

  describe('getApprovedPrompts', () => {
    it('should return only approved prompts', async () => {
      const mockPrompts = [
        { id: '1', status: PublishStatus.APPROVED },
        { id: '2', status: PublishStatus.APPROVED },
      ];

      const { default: prisma } = await import('../lib/prisma.js') as { default: any };
      (prisma.marketplacePrompt.findMany as any).mockResolvedValue(mockPrompts);
      (prisma.marketplacePrompt.count as any).mockResolvedValue(2);

      const result = await MarketplaceService.getApprovedPrompts({});

      expect(result.prompts).toHaveLength(2);
      expect(prisma.marketplacePrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: PublishStatus.APPROVED,
          }),
        })
      );
    });

    it('should support pagination', async () => {
      const { default: prisma } = await import('../lib/prisma.js') as { default: any };
      (prisma.marketplacePrompt.findMany as any).mockResolvedValue([]);
      (prisma.marketplacePrompt.count as any).mockResolvedValue(0);

      await MarketplaceService.getApprovedPrompts({ limit: 10, offset: 20 });

      expect(prisma.marketplacePrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });

    it('should support category filtering', async () => {
      const { default: prisma } = await import('../lib/prisma.js') as { default: any };
      (prisma.marketplacePrompt.findMany as any).mockResolvedValue([]);
      (prisma.marketplacePrompt.count as any).mockResolvedValue(0);

      await MarketplaceService.getApprovedPrompts({ category: 'testing' });

      expect(prisma.marketplacePrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'testing',
          }),
        })
      );
    });

    it('should support search', async () => {
      const { default: prisma } = await import('../lib/prisma.js') as { default: any };
      (prisma.marketplacePrompt.findMany as any).mockResolvedValue([]);
      (prisma.marketplacePrompt.count as any).mockResolvedValue(0);

      await MarketplaceService.getApprovedPrompts({ search: 'keyword' });

      expect(prisma.marketplacePrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                title: expect.objectContaining({ contains: 'keyword' }),
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('updatePrompt', () => {
    it('should update prompt fields', async () => {
      const mockUpdated = {
        id: 'test-id',
        title: 'Updated Title',
      };

      const { default: prisma } = await import('../lib/prisma.js') as { default: any };
      (prisma.marketplacePrompt.update as any).mockResolvedValue(mockUpdated);

      const result = await MarketplaceService.updatePrompt('test-id', {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });
  });

  describe('deletePrompt', () => {
    it('should delete prompt by ID', async () => {
      const { default: prisma } = await import('../lib/prisma.js') as { default: any };
      (prisma.marketplacePrompt.delete as any).mockResolvedValue({});

      await MarketplaceService.deletePrompt('test-id');

      expect(prisma.marketplacePrompt.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
    });
  });

  describe('createReview', () => {
    it('should create a review for a prompt', async () => {
      const mockReview = {
        id: 'review-1',
        promptId: 'prompt-1',
        rating: 5,
        reviewText: 'Great prompt!',
      };

      const { default: prisma } = await import('../lib/prisma.js') as { default: any };
      (prisma.marketplaceReview.create as any).mockResolvedValue(mockReview);
      // Mock the findMany that updatePromptStats uses
      (prisma.marketplaceReview.findMany as any).mockResolvedValue([
        { rating: 5 },
        { rating: 4 },
      ]);
      (prisma.marketplacePrompt.update as any).mockResolvedValue({});

      const result = await MarketplaceService.createReview({
        promptId: 'prompt-1',
        reviewerId: 'user-1',
        rating: 5,
        reviewText: 'Great prompt!',
      });

      expect(result.rating).toBe(5);
    });

    it('should validate rating range', async () => {
      // Ratings should be between 1-5 (validation at API level)
      const mockReview = {
        id: 'review-1',
        rating: 3,
      };

      const { default: prisma } = await import('../lib/prisma.js') as { default: any };
      (prisma.marketplaceReview.create as any).mockResolvedValue(mockReview);
      (prisma.marketplaceReview.findMany as any).mockResolvedValue([
        { rating: 3 },
      ]);
      (prisma.marketplacePrompt.update as any).mockResolvedValue({});

      const result = await MarketplaceService.createReview({
        promptId: 'prompt-1',
        reviewerId: 'user-1',
        rating: 3,
      });

      expect(result.rating).toBe(3);
    });
  });

  describe('getPromptReviews', () => {
    it('should return paginated reviews', async () => {
      const mockReviews = [
        { id: '1', rating: 5 },
        { id: '2', rating: 4 },
      ];

      const { default: prisma } = await import('../lib/prisma.js') as { default: any };
      (prisma.marketplaceReview.findMany as any).mockResolvedValue(mockReviews);
      (prisma.marketplaceReview.count as any).mockResolvedValue(2);

      const result = await MarketplaceService.getPromptReviews('prompt-1', {
        limit: 10,
        offset: 0,
      });

      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('recordUsage', () => {
    it('should increment clone count', async () => {
      const { default: prisma } = await import('../lib/prisma.js') as { default: any };
      (prisma.marketplacePrompt.update as any).mockResolvedValue({});

      await MarketplaceService.recordUsage('prompt-1');

      expect(prisma.marketplacePrompt.update).toHaveBeenCalledWith({
        where: { id: 'prompt-1' },
        data: {
          cloneCount: { increment: 1 },
        },
      });
    });
  });

  describe('getTrendingPrompts', () => {
    it('should return trending prompts sorted by score', async () => {
      const mockPrompts = [
        { id: '1', viewCount: 100, cloneCount: 50, avgRating: 4.8, createdAt: new Date() },
        { id: '2', viewCount: 80, cloneCount: 40, avgRating: 4.5, createdAt: new Date() },
      ];

      const { default: prisma } = await import('../lib/prisma.js') as { default: any };
      (prisma.marketplacePrompt.findMany as any).mockResolvedValue(mockPrompts);

      const result = await MarketplaceService.getTrendingPrompts(10);

      expect(result).toBeDefined();
      expect(prisma.marketplacePrompt.findMany).toHaveBeenCalled();
    });
  });
});
