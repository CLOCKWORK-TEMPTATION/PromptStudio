// ============================================================
// Optimization API Routes - Epic 1.4
// Enhanced with Worker Service & Real-time Updates
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { getOptimizationWorker } from '../../services/OptimizationWorkerService.js';
import { optimizationLogger } from '../../services/StructuredLogger.js';
import { budgetService } from '../../services/BudgetEnforcementService.js';
import { parseContentSnapshot } from '../../../shared/utils/promptRenderer.js';
import { logAuditEvent } from './audit.js';
import type {
  OptimizationBudget,
} from '../../../shared/types/dspy.js';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

const budgetSchema = z.object({
  maxCalls: z.number().int().min(1).max(10000).optional(),
  maxTokens: z.number().int().min(1).max(1000000).optional(),
  maxUSD: z.number().min(0.01).max(1000).optional(),
}).strict();

const createOptimizationSchema = z.object({
  templateId: z.string().uuid(),
  baseVersionId: z.string().uuid(),
  datasetId: z.string().uuid(),
  optimizerType: z.enum(['bootstrap_fewshot', 'copro']),
  metricType: z.enum(['exact_match', 'contains', 'json_valid', 'judge_rubric']),
  budget: budgetSchema.optional().default({}),
  workspaceId: z.string().uuid().optional(),
}).strict();

const applyOptimizationSchema = z.object({
  activate: z.boolean().optional().default(true),
}).strict();

const METRICS_REQUIRING_LABELS = new Set(['exact_match', 'contains']);

// ============================================================
// POST /api/optimize - Create optimization run
// ============================================================

router.post('/', async (req: Request, res: Response) => {
  const logger = optimizationLogger.child({});

  try {
    const validation = createOptimizationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const {
      templateId,
      baseVersionId,
      datasetId,
      optimizerType,
      metricType,
      budget,
      workspaceId,
    } = validation.data;

    // Check budget constraints if workspace provided
    if (workspaceId) {
      const budgetCheck = await budgetService.canStartOptimizationRun(workspaceId);
      if (!budgetCheck.allowed) {
        logger.warn('Budget check failed', { workspaceId, reason: budgetCheck.reason });
        return res.status(429).json({
          error: 'Budget limit reached',
          reason: budgetCheck.reason,
          currentUsage: budgetCheck.currentUsage,
        });
      }
    }

    // Verify template and version exist
    const version = await prisma.templateVersion.findUnique({
      where: { id: baseVersionId },
      include: { template: true },
    });

    if (!version || version.templateId !== templateId) {
      return res.status(404).json({ error: 'Template version not found' });
    }

    // Verify dataset exists
    const dataset = await prisma.evaluationDataset.findUnique({
      where: { id: datasetId },
      include: { _count: { select: { examples: true } } },
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    if (dataset._count.examples === 0) {
      return res.status(400).json({ error: 'Dataset has no examples' });
    }

    if (dataset.format === 'labeled' && metricType === 'judge_rubric') {
      return res.status(400).json({
        error: 'Judge rubric requires an unlabeled dataset',
        details: { metricType, datasetFormat: dataset.format },
      });
    }

    const selectedMetricType = dataset.format === 'unlabeled' ? 'judge_rubric' : metricType;

    if (METRICS_REQUIRING_LABELS.has(selectedMetricType)) {
      const missingExpectedOutput = await prisma.datasetExample.count({
        where: {
          datasetId,
          OR: [{ expectedOutput: null }, { expectedOutput: '' }],
        },
      });

      if (missingExpectedOutput > 0) {
        return res.status(400).json({
          error: 'Dataset examples missing expected output for labeled metric',
          details: { missingExpectedOutput },
        });
      }
    }

    // Set default budget if not provided
    const finalBudget: OptimizationBudget = {
      maxCalls: budget.maxCalls || 100,
      maxTokens: budget.maxTokens || 100000,
      maxUSD: budget.maxUSD || 10,
    };

    // Create optimization run with status=queued
    const run = await prisma.optimizationRun.create({
      data: {
        templateId,
        baseVersionId,
        datasetId,
        optimizerType,
        metricType: selectedMetricType,
        budget: finalBudget as unknown as Prisma.InputJsonValue,
        status: 'queued',
        progress: 0,
        stage: 'Waiting to start',
        tenantId: workspaceId,
      },
    });

    logger.info('Optimization run created', {
      runId: run.id,
      workspaceId,
      templateId,
      optimizerType,
      metricType: selectedMetricType,
    });

    // Enqueue job to worker (worker will pick it up automatically)
    const worker = getOptimizationWorker();
    const jobId = await worker.enqueueJob({
      runId: run.id,
      templateId,
      baseVersionId,
      datasetId,
      optimizerType,
      metricType: selectedMetricType,
      budget: finalBudget,
      tenantId: workspaceId,
      workspaceId,
    });

    await logAuditEvent(
      'optimization.started',
      'OptimizationRun',
      run.id,
      {
        jobId,
        templateId,
        datasetId,
        optimizerType,
        metricType: selectedMetricType,
        workspaceId,
      },
      req
    );

    res.status(201).json({
      id: run.id,
      jobId,
      status: run.status,
      progress: run.progress,
      stage: run.stage,
      createdAt: run.createdAt,
    });
  } catch (error) {
    logger.errorWithStack('Error creating optimization run', error as Error);
    res.status(500).json({ error: 'Failed to create optimization run' });
  }
});

// ============================================================
// GET /api/optimize/:id - Get optimization run status
// ============================================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const run = await prisma.optimizationRun.findUnique({
      where: { id },
      include: {
        template: {
          select: { id: true, name: true },
        },
        baseVersion: {
          select: { id: true, versionNumber: true },
        },
        dataset: {
          select: { id: true, name: true },
        },
      },
    });

    if (!run) {
      return res.status(404).json({ error: 'Optimization run not found' });
    }

    res.json({
      id: run.id,
      status: run.status,
      progress: run.progress,
      stage: run.stage,
      errorMessage: run.errorMessage,
      template: run.template,
      baseVersion: run.baseVersion,
      dataset: run.dataset,
      optimizerType: run.optimizerType,
      metricType: run.metricType,
      budget: run.budget,
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    });
  } catch (error) {
    console.error('Error getting optimization run:', error);
    res.status(500).json({ error: 'Failed to get optimization run' });
  }
});

// ============================================================
// GET /api/optimize/:id/result - Get optimization result
// ============================================================

router.get('/:id/result', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await prisma.optimizationResult.findFirst({
      where: { runId: id },
      include: {
        run: {
          include: {
            baseVersion: {
              select: { id: true, versionNumber: true, contentSnapshot: true },
            },
          },
        },
        appliedVersion: {
          select: { id: true, versionNumber: true },
        },
      },
    });

    if (!result) {
      return res.status(404).json({ error: 'Optimization result not found' });
    }

    res.json({
      id: result.id,
      runId: result.runId,
      optimizedSnapshot: result.optimizedSnapshot,
      baselineScore: result.baselineScore,
      optimizedScore: result.optimizedScore,
      scoreDelta: result.scoreDelta,
      cost: result.cost,
      diagnostics: result.diagnostics,
      appliedVersion: result.appliedVersion,
      baseVersion: result.run.baseVersion,
      createdAt: result.createdAt,
    });
  } catch (error) {
    console.error('Error getting optimization result:', error);
    res.status(500).json({ error: 'Failed to get optimization result' });
  }
});

// ============================================================
// POST /api/optimize/:id/apply - Apply optimization result
// ============================================================

router.post('/:id/apply', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = applyOptimizationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const { activate } = validation.data;

    // Get the optimization result
    const result = await prisma.optimizationResult.findFirst({
      where: { runId: id },
      include: {
        run: {
          include: {
            baseVersion: true,
          },
        },
      },
    });

    if (!result) {
      return res.status(404).json({ error: 'Optimization result not found' });
    }

    // Get the latest version number
    const latestVersion = await prisma.templateVersion.findFirst({
      where: { templateId: result.run.templateId },
      orderBy: { versionNumber: 'desc' },
    });

    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    // Parse base version content and merge with optimized
    const baseSnapshot = parseContentSnapshot(result.run.baseVersion.contentSnapshot);
    const optimizedSnapshot = result.optimizedSnapshot as { system?: string; developer?: string; demos?: unknown[] };

    const newContentSnapshot = {
      ...baseSnapshot,
      system: optimizedSnapshot.system || baseSnapshot.system,
      developer: optimizedSnapshot.developer || baseSnapshot.developer,
      // Include demos if present (for bootstrap_fewshot)
      ...(optimizedSnapshot.demos && { demos: optimizedSnapshot.demos }),
    };

    // If activating, deactivate all other versions first
    if (activate) {
      await prisma.templateVersion.updateMany({
        where: { templateId: result.run.templateId },
        data: { isActive: false },
      });
    }

    // Create new version from optimized result
    const newVersion = await prisma.templateVersion.create({
      data: {
        templateId: result.run.templateId,
        versionNumber: newVersionNumber,
        contentSnapshot: newContentSnapshot as unknown as Prisma.InputJsonValue,
        isActive: activate,
      },
    });

    // Update result with applied version
    await prisma.optimizationResult.update({
      where: { id: result.id },
      data: { appliedVersionId: newVersion.id },
    });

    // Update template's active version if activating
    if (activate) {
      await prisma.promptTemplate.update({
        where: { id: result.run.templateId },
        data: { activeVersionId: newVersion.id },
      });
    }

    res.json({
      newVersionId: newVersion.id,
      versionNumber: newVersion.versionNumber,
      isActive: newVersion.isActive,
    });
  } catch (error) {
    console.error('Error applying optimization result:', error);
    res.status(500).json({ error: 'Failed to apply optimization result' });
  }
});

// ============================================================
// POST /api/optimize/:id/cancel - Cancel optimization run
// ============================================================

router.post('/:id/cancel', async (req: Request, res: Response) => {
  const logger = optimizationLogger.child({ runId: req.params.id });

  try {
    const { id } = req.params;

    const run = await prisma.optimizationRun.findUnique({
      where: { id },
    });

    if (!run) {
      return res.status(404).json({ error: 'Optimization run not found' });
    }

    if (run.status === 'succeeded' || run.status === 'failed') {
      return res.status(400).json({ error: 'Cannot cancel completed run' });
    }

    // Use worker to cancel (handles active jobs)
    const worker = getOptimizationWorker();
    await worker.cancelJob(id);

    logger.info('Optimization run cancelled');

    res.json({ success: true });
  } catch (error) {
    logger.errorWithStack('Error canceling optimization run', error as Error);
    res.status(500).json({ error: 'Failed to cancel optimization run' });
  }
});

// ============================================================
// POST /api/optimize/:id/restart - Restart failed/cancelled run
// ============================================================

router.post('/:id/restart', async (req: Request, res: Response) => {
  const logger = optimizationLogger.child({ runId: req.params.id });

  try {
    const { id } = req.params;

    const worker = getOptimizationWorker();
    const newRunId = await worker.restartRun(id);

    logger.info('Optimization run restarted', { newRunId });

    // Get new run details
    const newRun = await prisma.optimizationRun.findUnique({
      where: { id: newRunId },
    });

    res.status(201).json({
      originalRunId: id,
      newRunId,
      status: newRun?.status,
      createdAt: newRun?.createdAt,
    });
  } catch (error) {
    logger.errorWithStack('Error restarting optimization run', error as Error);
    const message = error instanceof Error ? error.message : 'Failed to restart optimization run';
    res.status(400).json({ error: message });
  }
});

// ============================================================
// GET /api/optimize - List optimization runs
// ============================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const { templateId, status, limit = '20', offset = '0' } = req.query;

    const where: Record<string, unknown> = {};

    if (templateId) {
      where.templateId = templateId as string;
    }

    if (status) {
      where.status = status as string;
    }

    const runs = await prisma.optimizationRun.findMany({
      where,
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      orderBy: { createdAt: 'desc' },
      include: {
        template: {
          select: { id: true, name: true },
        },
        dataset: {
          select: { id: true, name: true },
        },
        result: {
          select: {
            id: true,
            baselineScore: true,
            optimizedScore: true,
            scoreDelta: true,
          },
        },
      },
    });

    const total = await prisma.optimizationRun.count({ where });

    res.json({
      runs,
      total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('Error listing optimization runs:', error);
    res.status(500).json({ error: 'Failed to list optimization runs' });
  }
});

export default router;
