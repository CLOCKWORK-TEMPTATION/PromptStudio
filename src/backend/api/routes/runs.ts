// ============================================================
// Run History API Routes - Epic 3.5
// Unified view of Optimization and Evaluation runs
// ============================================================

import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

const router = Router();

// ============================================================
// Types
// ============================================================

interface UnifiedRun {
  id: string;
  type: 'optimization' | 'evaluation';
  status: string;
  progress: number;
  stage?: string;

  // Scores
  score?: number;
  scoreDelta?: number;

  // Cost
  cost?: {
    calls?: number;
    tokens?: number;
    usdEstimate?: number;
  };

  // Duration
  durationMs?: number;

  // Metadata
  templateId?: string;
  templateName?: string;
  datasetId?: string;
  datasetName?: string;
  metricType?: string;
  optimizerType?: string;

  // Mode (for evaluations)
  mode?: string;
  winsA?: number;
  winsB?: number;
  ties?: number;

  // Timestamps
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;

  // Actor
  createdById?: string;
  createdByName?: string;

  // Error
  errorMessage?: string;
}

// ============================================================
// GET /api/runs - List all runs (unified view)
// ============================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      type,
      status,
      templateId,
      datasetId,
      dateFrom,
      dateTo,
      limit = '20',
      offset = '0',
    } = req.query;

    // Build queries for both types
    const optimizationWhere: Prisma.OptimizationRunWhereInput = {};
    const evaluationWhere: Prisma.AdvancedEvaluationRunWhereInput = {};

    if (status) {
      optimizationWhere.status = status as string;
      evaluationWhere.status = status as string;
    }

    if (templateId) {
      optimizationWhere.templateId = templateId as string;
      evaluationWhere.templateId = templateId as string;
    }

    if (datasetId) {
      optimizationWhere.datasetId = datasetId as string;
      evaluationWhere.datasetId = datasetId as string;
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom as string);
      optimizationWhere.createdAt = { gte: fromDate };
      evaluationWhere.createdAt = { gte: fromDate };
    }

    if (dateTo) {
      const toDate = new Date(dateTo as string);
      optimizationWhere.createdAt = {
        ...(optimizationWhere.createdAt as Prisma.DateTimeFilter || {}),
        lte: toDate,
      };
      evaluationWhere.createdAt = {
        ...(evaluationWhere.createdAt as Prisma.DateTimeFilter || {}),
        lte: toDate,
      };
    }

    // Fetch runs based on type filter
    const parsedLimit = parseInt(limit as string, 10);
    const parsedOffset = parseInt(offset as string, 10);

    let optimizationRuns: any[] = [];
    let evaluationRuns: any[] = [];
    let optimizationTotal = 0;
    let evaluationTotal = 0;

    if (!type || type === 'optimization') {
      [optimizationRuns, optimizationTotal] = await Promise.all([
        prisma.optimizationRun.findMany({
          where: optimizationWhere,
          take: parsedLimit,
          skip: type === 'optimization' ? parsedOffset : 0,
          orderBy: { createdAt: 'desc' },
          include: {
            template: { select: { id: true, name: true } },
            dataset: { select: { id: true, name: true } },
            result: { select: { baselineScore: true, optimizedScore: true, scoreDelta: true, cost: true } },
            createdBy: { select: { id: true, name: true } },
          },
        }),
        prisma.optimizationRun.count({ where: optimizationWhere }),
      ]);
    }

    if (!type || type === 'evaluation') {
      [evaluationRuns, evaluationTotal] = await Promise.all([
        prisma.advancedEvaluationRun.findMany({
          where: evaluationWhere,
          take: parsedLimit,
          skip: type === 'evaluation' ? parsedOffset : 0,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.advancedEvaluationRun.count({ where: evaluationWhere }),
      ]);
    }

    // Transform to unified format
    const unifiedRuns: UnifiedRun[] = [];

    for (const run of optimizationRuns) {
      const cost = run.result?.cost as { calls?: number; tokens?: number; usdEstimate?: number } | undefined;
      const durationMs = run.finishedAt && run.startedAt
        ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
        : undefined;

      unifiedRuns.push({
        id: run.id,
        type: 'optimization',
        status: run.status,
        progress: run.progress,
        stage: run.stage,
        score: run.result?.optimizedScore,
        scoreDelta: run.result?.scoreDelta,
        cost,
        durationMs,
        templateId: run.templateId,
        templateName: run.template?.name,
        datasetId: run.datasetId,
        datasetName: run.dataset?.name,
        metricType: run.metricType,
        optimizerType: run.optimizerType,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        createdById: run.createdById,
        createdByName: run.createdBy?.name,
        errorMessage: run.errorMessage,
      });
    }

    for (const run of evaluationRuns) {
      const cost = run.cost as { calls?: number; tokens?: number; usdEstimate?: number } | undefined;
      const durationMs = run.finishedAt && run.startedAt
        ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
        : undefined;

      unifiedRuns.push({
        id: run.id,
        type: 'evaluation',
        status: run.status,
        progress: run.progress,
        stage: run.stage,
        score: run.score,
        cost,
        durationMs,
        templateId: run.templateId,
        datasetId: run.datasetId,
        metricType: run.metricType,
        mode: run.mode,
        winsA: run.winsA,
        winsB: run.winsB,
        ties: run.ties,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        createdById: run.createdById,
        errorMessage: run.errorMessage,
      });
    }

    // Sort by createdAt descending
    unifiedRuns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination to unified list if no type filter
    const paginatedRuns = type
      ? unifiedRuns
      : unifiedRuns.slice(parsedOffset, parsedOffset + parsedLimit);

    res.json({
      runs: paginatedRuns,
      total: type ? (type === 'optimization' ? optimizationTotal : evaluationTotal) : optimizationTotal + evaluationTotal,
      optimizationTotal,
      evaluationTotal,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  } catch (error) {
    console.error('Error listing runs:', error);
    res.status(500).json({ error: 'Failed to list runs' });
  }
});

// ============================================================
// GET /api/runs/:type/:id - Get run details
// ============================================================

router.get('/:type/:id', async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;

    if (type === 'optimization') {
      const run = await prisma.optimizationRun.findUnique({
        where: { id },
        include: {
          template: true,
          baseVersion: true,
          dataset: { include: { _count: { select: { examples: true } } } },
          result: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      if (!run) {
        return res.status(404).json({ error: 'Optimization run not found' });
      }

      res.json({
        ...run,
        type: 'optimization',
        durationMs: run.finishedAt && run.startedAt
          ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
          : undefined,
      });
    } else if (type === 'evaluation') {
      const run = await prisma.advancedEvaluationRun.findUnique({
        where: { id },
        include: {
          judgeRubric: true,
          results: {
            take: 10,
            orderBy: { createdAt: 'asc' },
          },
          _count: { select: { results: true } },
        },
      });

      if (!run) {
        return res.status(404).json({ error: 'Evaluation run not found' });
      }

      res.json({
        ...run,
        type: 'evaluation',
        totalResults: run._count.results,
        durationMs: run.finishedAt && run.startedAt
          ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
          : undefined,
      });
    } else {
      return res.status(400).json({ error: 'Invalid run type. Use "optimization" or "evaluation".' });
    }
  } catch (error) {
    console.error('Error getting run details:', error);
    res.status(500).json({ error: 'Failed to get run details' });
  }
});

// ============================================================
// GET /api/runs/stats - Get run statistics
// ============================================================

router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const { workspaceId, dateFrom, dateTo } = req.query;

    const dateFilter: Prisma.DateTimeFilter = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom as string);
    if (dateTo) dateFilter.lte = new Date(dateTo as string);

    const optimizationWhere: Prisma.OptimizationRunWhereInput = {};
    const evaluationWhere: Prisma.AdvancedEvaluationRunWhereInput = {};

    if (Object.keys(dateFilter).length > 0) {
      optimizationWhere.createdAt = dateFilter;
      evaluationWhere.createdAt = dateFilter;
    }

    if (workspaceId) {
      optimizationWhere.tenantId = workspaceId as string;
      evaluationWhere.workspaceId = workspaceId as string;
    }

    // Fetch statistics
    const [
      optimizationStats,
      evaluationStats,
      optimizationByStatus,
      evaluationByStatus,
    ] = await Promise.all([
      prisma.optimizationRun.aggregate({
        where: optimizationWhere,
        _count: true,
      }),
      prisma.advancedEvaluationRun.aggregate({
        where: evaluationWhere,
        _count: true,
        _avg: { score: true },
      }),
      prisma.optimizationRun.groupBy({
        by: ['status'],
        where: optimizationWhere,
        _count: true,
      }),
      prisma.advancedEvaluationRun.groupBy({
        by: ['status'],
        where: evaluationWhere,
        _count: true,
      }),
    ]);

    // Calculate success rates
    const optSucceeded = optimizationByStatus.find(s => s.status === 'succeeded')?._count || 0;
    const optFailed = optimizationByStatus.find(s => s.status === 'failed')?._count || 0;
    const optTotal = optimizationStats._count;
    const optSuccessRate = optTotal > 0 ? (optSucceeded / optTotal) * 100 : 0;

    const evalSucceeded = evaluationByStatus.find(s => s.status === 'succeeded')?._count || 0;
    const evalFailed = evaluationByStatus.find(s => s.status === 'failed')?._count || 0;
    const evalTotal = evaluationStats._count;
    const evalSuccessRate = evalTotal > 0 ? (evalSucceeded / evalTotal) * 100 : 0;

    res.json({
      optimization: {
        total: optTotal,
        succeeded: optSucceeded,
        failed: optFailed,
        running: optimizationByStatus.find(s => s.status === 'running')?._count || 0,
        queued: optimizationByStatus.find(s => s.status === 'queued')?._count || 0,
        successRate: optSuccessRate.toFixed(1),
      },
      evaluation: {
        total: evalTotal,
        succeeded: evalSucceeded,
        failed: evalFailed,
        running: evaluationByStatus.find(s => s.status === 'running')?._count || 0,
        queued: evaluationByStatus.find(s => s.status === 'queued')?._count || 0,
        successRate: evalSuccessRate.toFixed(1),
        avgScore: evaluationStats._avg?.score?.toFixed(3) || null,
      },
      combined: {
        total: optTotal + evalTotal,
        succeeded: optSucceeded + evalSucceeded,
        failed: optFailed + evalFailed,
        successRate: ((optTotal + evalTotal) > 0
          ? ((optSucceeded + evalSucceeded) / (optTotal + evalTotal)) * 100
          : 0).toFixed(1),
      },
    });
  } catch (error) {
    console.error('Error getting run stats:', error);
    res.status(500).json({ error: 'Failed to get run statistics' });
  }
});

export default router;
