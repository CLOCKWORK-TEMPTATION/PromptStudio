import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { MarketplaceService, PublishStatus } from '../../services/MarketplaceService.js';

const router = Router();

// Validation Schemas
const CreatePromptSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  content: z.string().min(10),
  category: z.string().min(1),
  tags: z.array(z.string()).max(10).optional(),
  modelRecommendation: z.string().optional(),
  variables: z.array(z.any()).optional(),
  systemPrompt: z.string().optional(),
  processPrompt: z.string().optional(),
  taskPrompt: z.string().optional(),
  outputPrompt: z.string().optional(),
});

const UpdatePromptSchema = CreatePromptSchema.partial();

const CreateReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  reviewText: z.string().max(2000).optional(),
});

const SearchOptionsSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['popular', 'recent', 'rating', 'trending']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

// ==================== Prompts ====================

/**
 * البحث في الـ Marketplace
 * GET /api/marketplace/prompts
 */
router.get('/prompts', async (req: Request, res: Response) => {
  try {
    const options = SearchOptionsSchema.parse(req.query);

    const result = await MarketplaceService.getApprovedPrompts(options);

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Search prompts error:', error);
    res.status(500).json({ error: 'Failed to search prompts' });
  }
});

/**
 * الحصول على Prompts الأكثر رواجاً
 * GET /api/marketplace/prompts/trending
 */
router.get('/prompts/trending', async (req: Request, res: Response) => {
  try {
    const { limit } = z.object({
      limit: z.string().optional().transform(v => v ? parseInt(v) : 10),
    }).parse(req.query);

    const prompts = await MarketplaceService.getTrendingPrompts(limit);

    res.json(prompts);
  } catch (error) {
    console.error('Get trending error:', error);
    res.status(500).json({ error: 'Failed to get trending prompts' });
  }
});

/**
 * الحصول على prompt بالـ ID
 * GET /api/marketplace/prompts/:id
 */
router.get('/prompts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { incrementView } = z.object({
      incrementView: z.string().optional().transform(v => v === 'true'),
    }).parse(req.query);

    const prompt = await MarketplaceService.getPromptById(id, incrementView);

    res.json(prompt);
  } catch (error) {
    console.error('Get prompt error:', error);
    res.status(500).json({ error: 'Failed to get prompt' });
  }
});

/**
 * إنشاء prompt جديد
 * POST /api/marketplace/prompts
 */
router.post('/prompts', async (req: Request, res: Response) => {
  try {
    const data = CreatePromptSchema.parse(req.body);
    const authorId = (req as any).userId; // من middleware المصادقة

    const prompt = await MarketplaceService.createPrompt({
      ...data,
      tags: data.tags ?? [],
      authorId,
      status: PublishStatus.PENDING,
    });

    res.status(201).json(prompt);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Create prompt error:', error);
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

/**
 * تحديث prompt
 * PUT /api/marketplace/prompts/:id
 */
router.put('/prompts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = UpdatePromptSchema.parse(req.body);

    const prompt = await MarketplaceService.updatePrompt(id, data);

    res.json(prompt);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Update prompt error:', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

/**
 * حذف prompt
 * DELETE /api/marketplace/prompts/:id
 */
router.delete('/prompts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await MarketplaceService.deletePrompt(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete prompt error:', error);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

// ==================== Versions ====================

/**
 * الحصول على تاريخ النسخ
 * GET /api/marketplace/prompts/:id/versions
 */
router.get('/prompts/:id/versions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const versions = await MarketplaceService.getVersionHistory(id);

    res.json(versions);
  } catch (error) {
    console.error('Get versions error:', error);
    res.status(500).json({ error: 'Failed to get versions' });
  }
});

/**
 * مقارنة نسختين
 * GET /api/marketplace/prompts/:id/versions/compare
 */
router.get('/prompts/:id/versions/compare', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { v1, v2 } = z.object({
      v1: z.string().transform(v => parseInt(v)),
      v2: z.string().transform(v => parseInt(v)),
    }).parse(req.query);

    const comparison = await MarketplaceService.compareVersions(id, v1, v2);

    res.json(comparison);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Compare versions error:', error);
    res.status(500).json({ error: 'Failed to compare versions' });
  }
});

/**
 * استعادة نسخة قديمة
 * POST /api/marketplace/prompts/:id/versions/:version/restore
 */
router.post('/prompts/:id/versions/:version/restore', async (req: Request, res: Response) => {
  try {
    const { id, version } = req.params;
    const authorId = (req as any).userId;

    const prompt = await MarketplaceService.restoreVersion(
      id,
      parseInt(version),
      authorId
    );

    res.json(prompt);
  } catch (error) {
    console.error('Restore version error:', error);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

// ==================== Forks ====================

/**
 * استنساخ (Fork) prompt
 * POST /api/marketplace/prompts/:id/fork
 */
router.post('/prompts/:id/fork', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description } = z.object({
      title: z.string().optional(),
      description: z.string().optional(),
    }).parse(req.body);

    const userId = (req as any).userId;

    const forked = await MarketplaceService.forkPrompt(id, userId, {
      title,
      description,
    });

    res.status(201).json(forked);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Fork prompt error:', error);
    res.status(500).json({ error: 'Failed to fork prompt' });
  }
});

/**
 * الحصول على الـ forks
 * GET /api/marketplace/prompts/:id/forks
 */
router.get('/prompts/:id/forks', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit, offset } = z.object({
      limit: z.string().optional().transform(v => v ? parseInt(v) : 20),
      offset: z.string().optional().transform(v => v ? parseInt(v) : 0),
    }).parse(req.query);

    const result = await MarketplaceService.getPromptForks(id, { limit, offset });

    res.json(result);
  } catch (error) {
    console.error('Get forks error:', error);
    res.status(500).json({ error: 'Failed to get forks' });
  }
});

// ==================== Reviews ====================

/**
 * الحصول على مراجعات prompt
 * GET /api/marketplace/prompts/:id/reviews
 */
router.get('/prompts/:id/reviews', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit, offset } = z.object({
      limit: z.string().optional().transform(v => v ? parseInt(v) : 20),
      offset: z.string().optional().transform(v => v ? parseInt(v) : 0),
    }).parse(req.query);

    const result = await MarketplaceService.getPromptReviews(id, { limit, offset });

    res.json(result);
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews' });
  }
});

/**
 * إضافة مراجعة
 * POST /api/marketplace/prompts/:id/reviews
 */
router.post('/prompts/:id/reviews', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = CreateReviewSchema.parse(req.body);
    const reviewerId = (req as any).userId;

    const review = await MarketplaceService.createReview({
      promptId: id,
      reviewerId,
      rating: data.rating,
      reviewText: data.reviewText,
    });

    res.status(201).json(review);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

/**
 * التصويت على مراجعة
 * POST /api/marketplace/reviews/:reviewId/vote
 */
router.post('/reviews/:reviewId/vote', async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { vote } = z.object({
      vote: z.enum(['helpful', 'not_helpful']),
    }).parse(req.body);

    const userId = (req as any).userId;

    const review = await MarketplaceService.voteReview(reviewId, userId, vote);

    res.json(review);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Vote review error:', error);
    res.status(500).json({ error: 'Failed to vote on review' });
  }
});

/**
 * الحصول على المراجعات الأكثر فائدة
 * GET /api/marketplace/prompts/:id/reviews/helpful
 */
router.get('/prompts/:id/reviews/helpful', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit } = z.object({
      limit: z.string().optional().transform(v => v ? parseInt(v) : 5),
    }).parse(req.query);

    const reviews = await MarketplaceService.getMostHelpfulReviews(id, limit);

    res.json(reviews);
  } catch (error) {
    console.error('Get helpful reviews error:', error);
    res.status(500).json({ error: 'Failed to get helpful reviews' });
  }
});

// ==================== Stats ====================

/**
 * الحصول على إحصائيات prompt
 * GET /api/marketplace/prompts/:id/stats
 */
router.get('/prompts/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stats = await MarketplaceService.getPromptStats(id);

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * تسجيل استخدام prompt
 * POST /api/marketplace/prompts/:id/use
 */
router.post('/prompts/:id/use', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await MarketplaceService.recordUsage(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Record usage error:', error);
    res.status(500).json({ error: 'Failed to record usage' });
  }
});

/**
 * الحصول على إحصائيات الـ Marketplace
 * GET /api/marketplace/stats
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await MarketplaceService.getMarketplaceStats();

    res.json(stats);
  } catch (error) {
    console.error('Get marketplace stats error:', error);
    res.status(500).json({ error: 'Failed to get marketplace stats' });
  }
});

export default router;
