// ============================================================
// Optimization API Routes - Epic 1.4
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { DspyServiceClient } from '../../services/DspyServiceClient.js';
import { parseContentSnapshot } from '../../../shared/utils/promptRenderer';
import type {
  OptimizerType,
  OptimizationMetricType,
  OptimizationBudget,
} from '../../../shared/types/dspy';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

const createOptimizationSchema = z.object({
  templateId: z.string().uuid(),
  baseVersionId: z.string().uuid(),
  datasetId: z.string().uuid(),
  optimizerType: z.enum(['bootstrap_fewshot', 'copro']),
  metricType: z.enum(['exact_match', 'contains', 'json_valid', 'judge_rubric']),
  budget: z.object({
    maxCalls: z.number().positive().optional(),
    maxTokens: z.number().positive().optional(),
    maxUSD: z.number().positive().optional(),
  }).optional().default({}),
});

const applyOptimizationSchema = z.object({
  activate: z.boolean().optional().default(true),
});

// ============================================================
// POST /api/optimize - Create optimization run
// ============================================================

router.post('/', async (req: Request, res: Response) => {
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
    } = validation.data;

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
        metricType,
        budget: finalBudget as unknown as Prisma.InputJsonValue,
        status: 'queued',
        progress: 0,
        stage: 'Waiting to start',
      },
    });

    // Trigger async optimization (via queue or background process)
    // In a production setup, this would be pushed to a job queue
    triggerOptimizationJob(run.id).catch(err => {
      console.error('Failed to trigger optimization job:', err);
    });

    res.status(201).json({
      id: run.id,
      status: run.status,
      progress: run.progress,
      stage: run.stage,
      createdAt: run.createdAt,
    });
  } catch (error) {
    console.error('Error creating optimization run:', error);
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

    await prisma.optimizationRun.update({
      where: { id },
      data: {
        status: 'canceled',
        finishedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error canceling optimization run:', error);
    res.status(500).json({ error: 'Failed to cancel optimization run' });
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

// ============================================================
// Background Job Trigger (Simplified inline execution)
// ============================================================

async function triggerOptimizationJob(runId: string): Promise<void> {
  // In production, this would push to a queue (BullMQ, etc.)
  // For now, execute inline with async handling

  try {
    // Update status to running
    await prisma.optimizationRun.update({
      where: { id: runId },
      data: {
        status: 'running',
        startedAt: new Date(),
        stage: 'Loading data',
        progress: 10,
      },
    });

    // Load run data
    const run = await prisma.optimizationRun.findUnique({
      where: { id: runId },
      include: {
        baseVersion: true,
        dataset: {
          include: {
            examples: true,
          },
        },
      },
    });

    if (!run) {
      throw new Error('Run not found');
    }

    // Update progress
    await prisma.optimizationRun.update({
      where: { id: runId },
      data: {
        stage: 'Preparing DSPy compilation',
        progress: 20,
      },
    });

    // Parse content snapshot
    const contentSnapshot = parseContentSnapshot(run.baseVersion.contentSnapshot);

    // Prepare dataset for DSPy
    const dspyDataset = run.dataset.examples.map(ex => ({
      input_variables: ex.inputVariables as Record<string, unknown>,
      expected_output: ex.expectedOutput || undefined,
    }));

    // Update progress
    await prisma.optimizationRun.update({
      where: { id: runId },
      data: {
        stage: 'Calling DSPy service',
        progress: 40,
      },
    });

    // Call DSPy service
    const dspyClient = new DspyServiceClient();
    const compileResult = await dspyClient.compile({
      basePromptSnapshot: {
        system: contentSnapshot.system,
        developer: contentSnapshot.developer,
        user: contentSnapshot.user,
        context: contentSnapshot.context,
      },
      dataset: dspyDataset,
      model: {
        providerModelString: contentSnapshot.modelConfig?.model || 'gpt-4',
        temperature: contentSnapshot.modelConfig?.temperature,
        maxTokens: contentSnapshot.modelConfig?.maxTokens,
      },
      optimizer: {
        type: run.optimizerType as 'bootstrap_fewshot' | 'copro',
      },
      metricType: run.metricType as 'exact_match' | 'contains' | 'json_valid',
      budget: run.budget as { maxCalls?: number; maxTokens?: number; maxUSD?: number },
    });

    // Update progress
    await prisma.optimizationRun.update({
      where: { id: runId },
      data: {
        stage: 'Saving results',
        progress: 90,
      },
    });

    // Save result
    await prisma.optimizationResult.create({
      data: {
        runId,
        optimizedSnapshot: compileResult.optimizedPromptSnapshot as unknown as Prisma.InputJsonValue,
        dspyArtifactJson: compileResult.dspyArtifactJson ? JSON.parse(compileResult.dspyArtifactJson) : null,
        baselineScore: compileResult.baselineScore,
        optimizedScore: compileResult.optimizedScore,
        scoreDelta: compileResult.delta,
        cost: compileResult.cost as unknown as Prisma.InputJsonValue,
        diagnostics: compileResult.diagnostics as unknown as Prisma.InputJsonValue,
      },
    });

    // Mark as succeeded
    await prisma.optimizationRun.update({
      where: { id: runId },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
        stage: 'Completed',
        progress: 100,
      },
    });
  } catch (error) {
    console.error('Optimization job failed:', error);

    // Mark as failed
    await prisma.optimizationRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

export default router;
