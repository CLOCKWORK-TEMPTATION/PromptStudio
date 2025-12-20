import { Router, Request, Response } from 'express';
import { LLMServiceAdapter } from '../../services/LLMServiceAdapter.js';
import { AnalysisService } from '../../services/analysisService.js';
import { ReasoningHistoryService } from '../../services/ReasoningHistoryService.js';

const router = Router();

/**
 * Execute Tree-of-Thought reasoning
 */
router.post('/tree-of-thought', async (req: Request, res: Response) => {
  const startTime = Date.now();
  let session;

  try {
    const { prompt, maxDepth, branchingFactor, evaluationCriteria } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Create session
    session = ReasoningHistoryService.createSession(prompt, 'tree-of-thought', {
      maxDepth: maxDepth || 3,
      branchingFactor: branchingFactor || 3,
    });

    const result = await LLMServiceAdapter.executeTreeOfThought(prompt, {
      maxDepth: maxDepth || 3,
      branchingFactor: branchingFactor || 3,
      evaluationCriteria: evaluationCriteria || ['coherence', 'relevance', 'completeness'],
    });

    // Get quality metrics for the best path
    const qualityMetrics = await AnalysisService.generateQualityMetrics(result, prompt);

    const response = {
      success: true,
      sessionId: session.id,
      reasoningPath: result,
      qualityMetrics,
      metadata: {
        totalNodes: countNodes(result.nodes),
        maxDepth,
        branchingFactor,
        executionTime: Date.now() - startTime,
      },
    };

    // Complete session
    ReasoningHistoryService.completeSession(session.id, response);

    res.json(response);
  } catch (error) {
    console.error('Tree-of-Thought error:', error);
    if (session) {
      ReasoningHistoryService.completeSession(
        session.id,
        null,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
    res.status(500).json({ error: 'Failed to execute Tree-of-Thought reasoning' });
  }
});

/**
 * Execute Graph-of-Thought reasoning
 */
router.post('/graph-of-thought', async (req: Request, res: Response) => {
  try {
    const { prompt, maxNodes, connectionThreshold } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await LLMServiceAdapter.executeGraphOfThought(prompt, {
      maxNodes: maxNodes || 10,
      connectionThreshold: connectionThreshold || 0.5,
    });

    res.json({
      success: true,
      graph: result,
      metadata: {
        totalNodes: result.nodes.length,
        totalConnections: result.connections.length,
        avgScore: result.nodes.reduce((sum, n) => sum + n.score, 0) / result.nodes.length,
      },
    });
  } catch (error) {
    console.error('Graph-of-Thought error:', error);
    res.status(500).json({ error: 'Failed to execute Graph-of-Thought reasoning' });
  }
});

/**
 * Execute multiple reasoning paths and evaluate them
 */
router.post('/multi-path-reasoning', async (req: Request, res: Response) => {
  const startTime = Date.now();
  let session;

  try {
    const { prompt, numPaths, maxDepth, branchingFactor } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const pathCount = numPaths || 3;

    // Create session
    session = ReasoningHistoryService.createSession(prompt, 'multi-path', {
      numPaths: pathCount,
      maxDepth: maxDepth || 3,
      branchingFactor: branchingFactor || 2,
    });

    const paths = [];

    // Generate multiple reasoning paths
    for (let i = 0; i < pathCount; i++) {
      const path = await LLMServiceAdapter.executeTreeOfThought(prompt, {
        maxDepth: maxDepth || 3,
        branchingFactor: branchingFactor || 2,
      });
      paths.push(path);
    }

    // Evaluate and select the best path
    const selection = await AnalysisService.evaluateAndSelectBestPath(paths, prompt);

    const executionTime = Date.now() - startTime;

    // Store comparison
    const comparison = ReasoningHistoryService.storeComparison(
      session.id,
      paths,
      selection,
      executionTime
    );

    const response = {
      success: true,
      sessionId: session.id,
      comparisonId: comparison.id,
      selection,
      totalPaths: paths.length,
      executionTime,
      timestamp: new Date().toISOString(),
    };

    // Complete session
    ReasoningHistoryService.completeSession(session.id, response);

    res.json(response);
  } catch (error) {
    console.error('Multi-path reasoning error:', error);
    if (session) {
      ReasoningHistoryService.completeSession(
        session.id,
        null,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
    res.status(500).json({ error: 'Failed to execute multi-path reasoning' });
  }
});

/**
 * Compare two reasoning approaches
 */
router.post('/compare-paths', async (req: Request, res: Response) => {
  try {
    const { prompt, path1Config, path2Config } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Generate two paths with different configurations
    const path1 = await LLMServiceAdapter.executeTreeOfThought(prompt, path1Config || {});
    const path2 = await LLMServiceAdapter.executeTreeOfThought(prompt, path2Config || {});

    // Compare the paths
    const comparison = await AnalysisService.comparePaths(path1, path2, prompt);

    // Get quality metrics for both
    const metrics1 = await AnalysisService.generateQualityMetrics(path1, prompt);
    const metrics2 = await AnalysisService.generateQualityMetrics(path2, prompt);

    res.json({
      success: true,
      comparison,
      path1: {
        reasoning: path1,
        metrics: metrics1,
      },
      path2: {
        reasoning: path2,
        metrics: metrics2,
      },
    });
  } catch (error) {
    console.error('Path comparison error:', error);
    res.status(500).json({ error: 'Failed to compare reasoning paths' });
  }
});

/**
 * Get quality metrics for a reasoning path
 */
router.post('/evaluate-path', async (req: Request, res: Response) => {
  try {
    const { path, prompt } = req.body;

    if (!path || !prompt) {
      return res.status(400).json({ error: 'Path and prompt are required' });
    }

    const metrics = await AnalysisService.generateQualityMetrics(path, prompt);

    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Path evaluation error:', error);
    res.status(500).json({ error: 'Failed to evaluate reasoning path' });
  }
});

/**
 * Get reasoning session history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const sessions = ReasoningHistoryService.getRecentSessions(
      limit ? parseInt(limit as string) : 10
    );

    res.json({
      success: true,
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    console.error('History retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve session history' });
  }
});

/**
 * Get a specific session
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = ReasoningHistoryService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('Session retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

/**
 * Get overall statistics
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const stats = ReasoningHistoryService.getOverallStatistics();

    res.json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    console.error('Statistics retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

/**
 * Get statistics for a specific prompt
 */
router.post('/prompt-statistics', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const stats = ReasoningHistoryService.getPromptStatistics(prompt);

    res.json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    console.error('Prompt statistics error:', error);
    res.status(500).json({ error: 'Failed to retrieve prompt statistics' });
  }
});

/**
 * Helper function to count total nodes in a tree
 */
function countNodes(nodes: any[]): number {
  let count = nodes.length;
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      count += countNodes(node.children);
    }
  }
  return count;
}

export default router;
