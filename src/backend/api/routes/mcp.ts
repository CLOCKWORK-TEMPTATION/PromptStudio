import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { mcpContextService, CompressionLevel, PruningStrategy } from '../../services/MCPContextService.js';

const router = Router();

// Validation Schemas
const MCPConfigSchema = z.object({
  maxTokens: z.number().min(1000).max(128000).optional(),
  compressionThreshold: z.number().min(0.5).max(1).optional(),
  compressionLevel: z.enum(['none', 'light', 'moderate', 'aggressive']).optional(),
  pruningStrategy: z.enum(['fifo', 'lifo', 'importance', 'relevance', 'hybrid']).optional(),
  keepSystemMessages: z.boolean().optional(),
  summarizationEnabled: z.boolean().optional(),
  cacheEnabled: z.boolean().optional(),
});

const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1),
  importance: z.number().min(0).max(1).optional(),
});

/**
 * إنشاء نافذة سياق جديدة
 * POST /api/mcp/sessions
 */
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { sessionId, config } = z.object({
      sessionId: z.string().min(1),
      config: MCPConfigSchema.optional(),
    }).parse(req.body);

    const window = await mcpContextService.createContextWindow(
      sessionId,
      config ? {
        ...config,
        compressionLevel: config.compressionLevel as CompressionLevel,
        pruningStrategy: config.pruningStrategy as PruningStrategy,
      } : undefined
    );

    res.json({
      success: true,
      window: {
        id: window.id,
        sessionId: window.sessionId,
        maxTokens: window.maxTokens,
        totalTokens: window.totalTokens,
        messageCount: window.messages.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create context window' });
  }
});

/**
 * إضافة رسالة للسياق
 * POST /api/mcp/sessions/:sessionId/messages
 */
router.post('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { message, config } = z.object({
      message: MessageSchema,
      config: MCPConfigSchema.optional(),
    }).parse(req.body);

    const result = await mcpContextService.addMessage(
      sessionId,
      message,
      config ? {
        ...config,
        compressionLevel: config.compressionLevel as CompressionLevel,
        pruningStrategy: config.pruningStrategy as PruningStrategy,
      } : undefined
    );

    res.json({
      success: true,
      window: {
        id: result.window.id,
        totalTokens: result.window.totalTokens,
        messageCount: result.window.messages.length,
        utilizationPercentage: (result.window.totalTokens / result.window.maxTokens) * 100,
      },
      compressionApplied: result.compressionApplied,
      stats: result.stats,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Add message error:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

/**
 * ضغط السياق يدوياً
 * POST /api/mcp/sessions/:sessionId/compress
 */
router.post('/sessions/:sessionId/compress', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const config = MCPConfigSchema.parse(req.body.config || {});

    const result = await mcpContextService.compressContext(
      sessionId,
      config ? {
        ...config,
        compressionLevel: config.compressionLevel as CompressionLevel,
        pruningStrategy: config.pruningStrategy as PruningStrategy,
      } : undefined
    );

    res.json({
      success: true,
      stats: result.stats,
      window: {
        totalTokens: result.window.totalTokens,
        messageCount: result.window.messages.length,
        summaryCount: result.window.summaries.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Compress error:', error);
    res.status(500).json({ error: 'Failed to compress context' });
  }
});

/**
 * الحصول على السياق للإرسال لـ API
 * GET /api/mcp/sessions/:sessionId/context
 */
router.get('/sessions/:sessionId/context', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { maxTokens } = z.object({
      maxTokens: z.string().optional().transform(v => v ? parseInt(v) : undefined),
    }).parse(req.query);

    const messages = mcpContextService.getContextForAPI(sessionId, maxTokens);

    if (messages.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      messages,
      messageCount: messages.length,
      estimatedTokens: messages.reduce(
        (sum, m) => sum + Math.ceil(m.content.length / 4),
        0
      ),
    });
  } catch (error) {
    console.error('Get context error:', error);
    res.status(500).json({ error: 'Failed to get context' });
  }
});

/**
 * الحصول على إحصائيات النافذة
 * GET /api/mcp/sessions/:sessionId/stats
 */
router.get('/sessions/:sessionId/stats', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const stats = mcpContextService.getWindowStats(sessionId);

    if (!stats) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * حذف نافذة سياق
 * DELETE /api/mcp/sessions/:sessionId
 */
router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const deleted = mcpContextService.deleteContextWindow(sessionId);

    if (!deleted) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

/**
 * تنظيف النوافذ غير النشطة
 * POST /api/mcp/cleanup
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const { olderThanMinutes } = z.object({
      olderThanMinutes: z.number().min(1).optional(),
    }).parse(req.body);

    const cleanedCount = await mcpContextService.cleanup(olderThanMinutes);

    res.json({
      success: true,
      cleanedCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup' });
  }
});

export default router;
