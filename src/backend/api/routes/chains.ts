import { Router, Request, Response } from 'express';
import {
  PromptChainService,
  PipelineType,
} from '../../services/PromptChainService';
import { LongTermMemoryService, MemoryType } from '../../services/LongTermMemoryService';

const router = Router();
const memoryService = new LongTermMemoryService();

// ================== Chain Routes ==================

/**
 * Create a new chain
 * POST /api/chains
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      promptId,
      name,
      description,
      stages,
      pipelineType,
      enableMemory,
      reuseContext,
    } = req.body;

    const chain = await PromptChainService.createChain(promptId, {
      name,
      description,
      stages,
      pipelineType: pipelineType as PipelineType,
      enableMemory,
      reuseContext,
    });

    res.json(chain);
  } catch (error) {
    console.error('Error creating chain:', error);
    res.status(500).json({ error: 'Failed to create chain' });
  }
});

/**
 * Execute a chain with long-term memory support
 * POST /api/chains/:id/execute
 */
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { initialContext, sessionId, useMemory, storeInMemory } = req.body;

    const result = await PromptChainService.executeChain(id, initialContext, {
      sessionId,
      useMemory,
      storeInMemory,
    });

    res.json(result);
  } catch (error) {
    console.error('Error executing chain:', error);
    res.status(500).json({ error: 'Failed to execute chain' });
  }
});

/**
 * Get chain execution history
 * GET /api/chains/:id/history
 */
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit, offset } = req.query;

    const history = await PromptChainService.getExecutionHistory(id, {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(history);
  } catch (error) {
    console.error('Error getting execution history:', error);
    res.status(500).json({ error: 'Failed to get execution history' });
  }
});

/**
 * Analyze chain performance
 * GET /api/chains/:id/performance
 */
router.get('/:id/performance', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const analysis = await PromptChainService.analyzeChainPerformance(id);

    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing chain performance:', error);
    res.status(500).json({ error: 'Failed to analyze chain performance' });
  }
});

/**
 * Get available pipeline templates
 * GET /api/chains/templates
 */
router.get('/templates', async (_req: Request, res: Response) => {
  try {
    const templates = PromptChainService.getPipelineTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error getting pipeline templates:', error);
    res.status(500).json({ error: 'Failed to get pipeline templates' });
  }
});

/**
 * Create analysis pipeline from template
 * POST /api/chains/templates/analysis-pipeline
 */
router.post('/templates/analysis-pipeline', async (req: Request, res: Response) => {
  try {
    const { promptId, name } = req.body;

    const chain = await PromptChainService.createAnalysisPipeline(promptId, name);

    res.json(chain);
  } catch (error) {
    console.error('Error creating analysis pipeline:', error);
    res.status(500).json({ error: 'Failed to create analysis pipeline' });
  }
});

/**
 * Create chain from specific pipeline type
 * POST /api/chains/templates/:type
 */
router.post('/templates/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { promptId, name, description, enableMemory, reuseContext } = req.body;

    const pipelineType = type as PipelineType;

    if (!Object.values(PipelineType).includes(pipelineType)) {
      return res.status(400).json({ error: 'Invalid pipeline type' });
    }

    const chain = await PromptChainService.createChain(promptId, {
      name,
      description,
      pipelineType,
      enableMemory: enableMemory ?? true,
      reuseContext: reuseContext ?? true,
    });

    res.json(chain);
  } catch (error) {
    console.error('Error creating chain from template:', error);
    res.status(500).json({ error: 'Failed to create chain from template' });
  }
});

/**
 * Cleanup old memory states
 * POST /api/chains/cleanup
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const { olderThanDays } = req.body;

    const deletedCount = await PromptChainService.cleanupMemoryStates(
      olderThanDays || 7
    );

    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error('Error cleaning up memory states:', error);
    res.status(500).json({ error: 'Failed to cleanup memory states' });
  }
});

// ================== Memory Routes ==================

/**
 * Store context in long-term memory
 * POST /api/chains/memory
 */
router.post('/memory', async (req: Request, res: Response) => {
  try {
    const { type, key, content, metadata, tags, ttlSeconds } = req.body;

    const recordId = await memoryService.store({
      type: type as MemoryType,
      key,
      content,
      metadata,
      tags,
      ttlSeconds,
    });

    res.json({ success: true, recordId });
  } catch (error) {
    console.error('Error storing memory:', error);
    res.status(500).json({ error: 'Failed to store memory' });
  }
});

/**
 * Retrieve similar contexts from memory
 * POST /api/chains/memory/search
 */
router.post('/memory/search', async (req: Request, res: Response) => {
  try {
    const { query, type, tags, limit, minRelevance, taskType } = req.body;

    const results = await memoryService.retrieveSimilarContexts(query, {
      type: type as MemoryType,
      tags,
      limit,
      minRelevance,
      taskType,
    });

    res.json(results);
  } catch (error) {
    console.error('Error searching memory:', error);
    res.status(500).json({ error: 'Failed to search memory' });
  }
});

/**
 * Get patterns for a task type
 * GET /api/chains/memory/patterns/:taskType
 */
router.get('/memory/patterns/:taskType', async (req: Request, res: Response) => {
  try {
    const { taskType } = req.params;
    const { limit } = req.query;

    const patterns = await memoryService.retrievePatterns(
      taskType,
      limit ? parseInt(limit as string) : 10
    );

    res.json(patterns);
  } catch (error) {
    console.error('Error retrieving patterns:', error);
    res.status(500).json({ error: 'Failed to retrieve patterns' });
  }
});

/**
 * Update memory relevance (feedback)
 * POST /api/chains/memory/:id/feedback
 */
router.post('/memory/:id/feedback', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

    if (!['positive', 'negative'].includes(feedback)) {
      return res.status(400).json({ error: 'Invalid feedback value' });
    }

    await memoryService.updateRelevance(id, feedback);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating memory relevance:', error);
    res.status(500).json({ error: 'Failed to update memory relevance' });
  }
});

/**
 * Get memory statistics
 * GET /api/chains/memory/stats
 */
router.get('/memory/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await memoryService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting memory stats:', error);
    res.status(500).json({ error: 'Failed to get memory stats' });
  }
});

/**
 * Consolidate memory (merge similar records)
 * POST /api/chains/memory/consolidate
 */
router.post('/memory/consolidate', async (_req: Request, res: Response) => {
  try {
    const result = await memoryService.consolidateMemory();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error consolidating memory:', error);
    res.status(500).json({ error: 'Failed to consolidate memory' });
  }
});

/**
 * Cleanup expired memory entries
 * POST /api/chains/memory/cleanup
 */
router.post('/memory/cleanup', async (_req: Request, res: Response) => {
  try {
    const deletedCount = await memoryService.cleanup();
    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error('Error cleaning up memory:', error);
    res.status(500).json({ error: 'Failed to cleanup memory' });
  }
});

export default router;
