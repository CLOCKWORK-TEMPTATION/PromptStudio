import { Router, Request, Response } from 'express';
import { semanticCacheService } from '../../services/SemanticCacheService.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get cache configuration
router.get('/config', async (req: Request, res: Response) => {
  try {
    const config = await semanticCacheService['getConfig']();

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Get cache config error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to get cache configuration' },
    });
  }
});

// Update cache configuration
router.patch('/config', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const config = await semanticCacheService.updateConfig(updates);

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Update cache config error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to update cache configuration' },
    });
  }
});

// Lookup cache entry
router.post('/lookup', async (req: Request, res: Response) => {
  try {
    const { prompt, model, threshold, tags } = req.body;

    if (!prompt) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Prompt is required' },
      });
      return;
    }

    const result = await semanticCacheService.lookup({
      prompt,
      model,
      threshold,
      tags,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Cache lookup error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to lookup cache' },
    });
  }
});

// Store cache entry
router.post('/store', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { prompt, response, model, tags, ttlSeconds } = req.body;

    if (!prompt || !response || !model) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Prompt, response, and model are required' },
      });
      return;
    }

    const entry = await semanticCacheService.store({
      prompt,
      response,
      model,
      tags,
      ttlSeconds,
      userId: authReq.userId,
    });

    res.status(201).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    console.error('Cache store error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to store cache entry' },
    });
  }
});

// Get all cache entries
router.get('/entries', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      pageSize = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      tags,
      search,
    } = req.query;

    const result = await semanticCacheService.getEntries({
      page: parseInt(page as string, 10),
      pageSize: parseInt(pageSize as string, 10),
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      tags: tags ? (tags as string).split(',') : undefined,
      search: search as string,
    });

    res.json({
      success: true,
      data: result.entries,
      meta: {
        page: parseInt(page as string, 10),
        pageSize: parseInt(pageSize as string, 10),
        total: result.total,
        hasMore: parseInt(page as string, 10) * parseInt(pageSize as string, 10) < result.total,
      },
    });
  } catch (error) {
    console.error('Get cache entries error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to get cache entries' },
    });
  }
});

// Get cache analytics
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const analytics = await semanticCacheService.getAnalytics();

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Get cache analytics error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to get cache analytics' },
    });
  }
});

// Invalidate cache entries
router.post('/invalidate', async (req: Request, res: Response) => {
  try {
    const { type, ids, tags, pattern } = req.body;

    if (!type) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalidation type is required' },
      });
      return;
    }

    const result = await semanticCacheService.invalidate({
      type,
      ids,
      tags,
      pattern,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Cache invalidate error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to invalidate cache' },
    });
  }
});

// Delete specific cache entry
router.delete('/entries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await semanticCacheService.invalidate({
      type: 'id',
      ids: [id],
    });

    if (result.deletedCount === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Cache entry not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: { message: 'Cache entry deleted successfully' },
    });
  } catch (error) {
    console.error('Delete cache entry error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to delete cache entry' },
    });
  }
});

// Cleanup expired entries
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const deletedCount = await semanticCacheService.cleanup();

    res.json({
      success: true,
      data: { deletedCount, message: `Cleaned up ${deletedCount} expired entries` },
    });
  } catch (error) {
    console.error('Cache cleanup error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to cleanup cache' },
    });
  }
});

// Clear all cache
router.delete('/all', async (req: Request, res: Response) => {
  try {
    const result = await semanticCacheService.invalidate({ type: 'all' });

    res.json({
      success: true,
      data: { deletedCount: result.deletedCount, message: 'All cache entries cleared' },
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to clear cache' },
    });
  }
});

export { router as cacheRouter };
