import { Router, Request, Response, NextFunction } from 'express';
import { SelfRefinementService } from '../../services/SelfRefinementService.js';
import { OutputEvaluationService } from '../../services/OutputEvaluationService.js';
import { PromptService } from '../../services/PromptService.js';

const router = Router();

/**
 * POST /api/refinement/:promptId/refine
 * Execute self-refinement loop for a prompt
 */
router.post('/:promptId/refine', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promptId } = req.params;
    const { testOutput, config } = req.body;

    if (!testOutput) {
      return res.status(400).json({
        success: false,
        error: 'testOutput is required',
      });
    }

    const result = await SelfRefinementService.refinePrompt(promptId, testOutput, config);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/refinement/:promptId/evaluate
 * Evaluate prompt output without refinement
 */
router.post('/:promptId/evaluate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promptId } = req.params;
    const { output, criteria } = req.body;

    if (!output) {
      return res.status(400).json({
        success: false,
        error: 'output is required',
      });
    }

    // Get the prompt content
    const prompt = await PromptService.getPromptWithHistory(promptId);
    if (!prompt) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found',
      });
    }

    const evaluation = await OutputEvaluationService.evaluateOutput(
      { prompt: prompt.content, output },
      criteria
    );

    res.json({
      success: true,
      data: evaluation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/refinement/:promptId/quick-evaluate
 * Quick evaluation for real-time feedback
 */
router.post('/:promptId/quick-evaluate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { output } = req.body;

    if (!output) {
      return res.status(400).json({
        success: false,
        error: 'output is required',
      });
    }

    const result = await OutputEvaluationService.quickEvaluate(output);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/refinement/:promptId/suggest
 * Get refinement suggestions without applying them
 */
router.post('/:promptId/suggest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promptId } = req.params;
    const { testOutput } = req.body;

    if (!testOutput) {
      return res.status(400).json({
        success: false,
        error: 'testOutput is required',
      });
    }

    const prompt = await PromptService.getPromptWithHistory(promptId);
    if (!prompt) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found',
      });
    }

    const suggestions = await SelfRefinementService.suggestRefinements(
      prompt.content,
      testOutput
    );

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/refinement/:promptId/history
 * Get refinement history for a prompt
 */
router.get('/:promptId/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promptId } = req.params;

    const history = await SelfRefinementService.getRefinementHistory(promptId);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/refinement/:promptId/versions
 * Get all versions of a prompt
 */
router.get('/:promptId/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promptId } = req.params;

    const versions = await PromptService.getPromptVersions(promptId);

    res.json({
      success: true,
      data: versions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/refinement/:promptId/compare
 * Compare two versions
 */
router.get('/:promptId/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promptId } = req.params;
    const { version1, version2 } = req.query;

    if (!version1 || !version2) {
      return res.status(400).json({
        success: false,
        error: 'version1 and version2 query parameters are required',
      });
    }

    const comparison = await SelfRefinementService.compareVersions(
      promptId,
      parseInt(version1 as string),
      parseInt(version2 as string)
    );

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/refinement/:promptId/diff
 * Get diff between two versions
 */
router.get('/:promptId/diff', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promptId } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: 'from and to query parameters are required',
      });
    }

    const diff = await PromptService.getVersionDiff(
      promptId,
      parseInt(from as string),
      parseInt(to as string)
    );

    res.json({
      success: true,
      data: diff,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/refinement/:promptId/analytics
 * Get refinement analytics for a prompt
 */
router.get('/:promptId/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promptId } = req.params;

    const analytics = await PromptService.getRefinementAnalytics(promptId);

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'No refinement data found for this prompt',
      });
    }

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/refinement/:promptId/initialize
 * Initialize version history for a prompt
 */
router.post('/:promptId/initialize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promptId } = req.params;

    const version = await PromptService.initializeVersionHistory(promptId);

    res.json({
      success: true,
      data: version,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/refinement/:promptId/apply-version
 * Apply a specific version as the active version
 */
router.post('/:promptId/apply-version', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promptId } = req.params;
    const { versionId } = req.body;

    if (!versionId) {
      return res.status(400).json({
        success: false,
        error: 'versionId is required',
      });
    }

    const success = await SelfRefinementService.applyVersion(promptId, versionId);

    res.json({
      success: true,
      data: { applied: success },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/refinement/:promptId/rollback
 * Rollback to a previous version
 */
router.post('/:promptId/rollback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promptId } = req.params;
    const { version } = req.body;

    if (version === undefined) {
      return res.status(400).json({
        success: false,
        error: 'version is required',
      });
    }

    const success = await SelfRefinementService.rollbackToVersion(promptId, version);

    res.json({
      success: true,
      data: { rolledBack: success },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/refinement/:promptId/continuous
 * Start continuous refinement with multiple test outputs
 */
router.post('/:promptId/continuous', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promptId } = req.params;
    const { testOutputs, config } = req.body;

    if (!testOutputs || !Array.isArray(testOutputs) || testOutputs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'testOutputs array is required and must not be empty',
      });
    }

    const result = await SelfRefinementService.startContinuousRefinement(
      promptId,
      testOutputs,
      config
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
