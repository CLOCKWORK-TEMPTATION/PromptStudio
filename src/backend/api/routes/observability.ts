// ============================================================
// Observability API Routes - Epic 3.4
// Metrics, performance insights, and system monitoring
// ============================================================

import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { healthCheckService } from '../../services/HealthCheckService.js';

const router = Router();

// ============================================================
// GET /api/observability/metrics - Get system metrics
// ============================================================

router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const healthStatus = await healthCheckService.performHealthCheck();

    // Get additional database metrics
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [
      totalOptRuns,
      recentOptRuns,
      activeOptRuns,
      totalEvalRuns,
      recentEvalRuns,
      activeEvalRuns,
      totalTemplates,
      totalDatasets,
    ] = await Promise.all([
      prisma.optimizationRun.count(),
      prisma.optimizationRun.count({ where: { createdAt: { gte: oneDayAgo } } }),
      prisma.optimizationRun.count({ where: { status: { in: ['queued', 'running'] } } }),
      prisma.advancedEvaluationRun.count(),
      prisma.advancedEvaluationRun.count({ where: { createdAt: { gte: oneDayAgo } } }),
      prisma.advancedEvaluationRun.count({ where: { status: { in: ['queued', 'running'] } } }),
      prisma.promptTemplate.count(),
      prisma.evaluationDataset.count(),
    ]);

    res.json({
      system: {
        status: healthStatus.status,
        uptime: healthStatus.uptime,
        version: healthStatus.version,
        timestamp: healthStatus.timestamp,
      },
      services: healthStatus.services,
      resources: healthStatus.metrics,
      runs: {
        optimization: {
          total: totalOptRuns,
          last24h: recentOptRuns,
          active: activeOptRuns,
        },
        evaluation: {
          total: totalEvalRuns,
          last24h: recentEvalRuns,
          active: activeEvalRuns,
        },
      },
      entities: {
        templates: totalTemplates,
        datasets: totalDatasets,
      },
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// ============================================================
// GET /api/observability/performance - Get performance insights
// ============================================================

router.get('/performance', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    const optWhere: Record<string, unknown> = {};
    const evalWhere: Record<string, unknown> = {};
    if (tenantId) {
      optWhere.tenantId = tenantId;
      evalWhere.workspaceId = tenantId;
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get completed optimization runs with results
    const completedOptRuns = await prisma.optimizationRun.findMany({
      where: {
        ...optWhere,
        status: { in: ['succeeded', 'completed'] },
        finishedAt: { gte: oneWeekAgo },
      },
      select: {
        id: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        budget: true,
        result: {
          select: {
            optimizedScore: true,
            baselineScore: true,
          },
        },
      },
      orderBy: { finishedAt: 'desc' },
      take: 50,
    });

    // Get completed evaluation runs
    const completedEvalRuns = await prisma.advancedEvaluationRun.findMany({
      where: {
        ...evalWhere,
        status: 'completed',
        finishedAt: { gte: oneWeekAgo },
      },
      select: {
        id: true,
        mode: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        cost: true,
        score: true,
      },
      orderBy: { finishedAt: 'desc' },
      take: 50,
    });

    // Calculate average durations
    const calculateAvgDuration = (runs: { startedAt: Date | null; finishedAt: Date | null }[]) => {
      const durations = runs
        .filter(r => r.startedAt && r.finishedAt)
        .map(r => new Date(r.finishedAt!).getTime() - new Date(r.startedAt!).getTime());

      if (durations.length === 0) return 0;
      return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000);
    };

    res.json({
      optimization: {
        completedLast7Days: completedOptRuns.length,
        avgDurationSeconds: calculateAvgDuration(completedOptRuns),
        recentRuns: completedOptRuns.slice(0, 10).map(r => ({
          id: r.id,
          duration: r.startedAt && r.finishedAt
            ? Math.round((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)
            : null,
          budget: r.budget,
          score: r.result?.optimizedScore,
          completedAt: r.finishedAt,
        })),
      },
      evaluation: {
        completedLast7Days: completedEvalRuns.length,
        avgDurationSeconds: calculateAvgDuration(completedEvalRuns),
        recentRuns: completedEvalRuns.slice(0, 10).map(r => ({
          id: r.id,
          mode: r.mode,
          duration: r.startedAt && r.finishedAt
            ? Math.round((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)
            : null,
          cost: r.cost,
          score: r.score,
          completedAt: r.finishedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error getting performance insights:', error);
    res.status(500).json({ error: 'Failed to get performance insights' });
  }
});

// ============================================================
// GET /api/observability/errors - Get recent errors
// ============================================================

router.get('/errors', async (req: Request, res: Response) => {
  try {
    const { tenantId, limit = '20' } = req.query;
    const optWhere: Record<string, unknown> = { status: 'failed' };
    const evalWhere: Record<string, unknown> = { status: 'failed' };
    if (tenantId) {
      optWhere.tenantId = tenantId;
      evalWhere.workspaceId = tenantId;
    }

    const [failedOptRuns, failedEvalRuns, errorAuditEvents] = await Promise.all([
      prisma.optimizationRun.findMany({
        where: optWhere,
        select: {
          id: true,
          errorMessage: true,
          createdAt: true,
          finishedAt: true,
        },
        orderBy: { finishedAt: 'desc' },
        take: parseInt(limit as string, 10),
      }),
      prisma.advancedEvaluationRun.findMany({
        where: evalWhere,
        select: {
          id: true,
          mode: true,
          errorMessage: true,
          createdAt: true,
          finishedAt: true,
        },
        orderBy: { finishedAt: 'desc' },
        take: parseInt(limit as string, 10),
      }),
      prisma.auditEvent.findMany({
        where: {
          eventType: { in: ['optimization.failed', 'evaluation.failed', 'budget.exceeded', 'system.error'] },
          ...(tenantId ? { workspaceId: tenantId as string } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string, 10),
      }),
    ]);

    res.json({
      optimizationErrors: failedOptRuns.map(r => ({
        id: r.id,
        type: 'optimization',
        error: r.errorMessage,
        timestamp: r.finishedAt || r.createdAt,
      })),
      evaluationErrors: failedEvalRuns.map(r => ({
        id: r.id,
        type: 'evaluation',
        mode: r.mode,
        error: r.errorMessage,
        timestamp: r.finishedAt || r.createdAt,
      })),
      auditErrors: errorAuditEvents.map(e => ({
        id: e.id,
        type: e.eventType,
        entityType: e.entityType,
        entityId: e.entityId,
        payload: e.payloadJson,
        timestamp: e.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error getting error logs:', error);
    res.status(500).json({ error: 'Failed to get error logs' });
  }
});

// ============================================================
// GET /api/observability/cost-tracking - Get cost tracking data
// ============================================================

router.get('/cost-tracking', async (req: Request, res: Response) => {
  try {
    const { tenantId, days = '30' } = req.query;
    const evalWhere: Record<string, unknown> = {};
    if (tenantId) evalWhere.workspaceId = tenantId;

    const startDate = new Date(Date.now() - parseInt(days as string, 10) * 24 * 60 * 60 * 1000);

    // Get evaluation runs with cost data (OptimizationRun doesn't track actual cost)
    const evalRuns = await prisma.advancedEvaluationRun.findMany({
      where: {
        ...evalWhere,
        status: 'completed',
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        cost: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate total costs
    const extractCost = (costJson: unknown): number => {
      if (!costJson) return 0;
      const cost = costJson as { usd?: number; totalUSD?: number };
      return cost.usd || cost.totalUSD || 0;
    };

    const totalEvalCost = evalRuns.reduce((sum, r) => sum + extractCost(r.cost), 0);

    // Group by day
    const dailyCosts: Record<string, { optimization: number; evaluation: number }> = {};

    evalRuns.forEach(r => {
      const day = new Date(r.createdAt).toISOString().split('T')[0];
      if (!dailyCosts[day]) dailyCosts[day] = { optimization: 0, evaluation: 0 };
      dailyCosts[day].evaluation += extractCost(r.cost);
    });

    res.json({
      summary: {
        totalCostUSD: Math.round(totalEvalCost * 100) / 100,
        optimizationCostUSD: 0, // OptimizationRun doesn't track actual cost
        evaluationCostUSD: Math.round(totalEvalCost * 100) / 100,
        periodDays: parseInt(days as string, 10),
        avgDailyCostUSD: Math.round((totalEvalCost / parseInt(days as string, 10)) * 100) / 100,
      },
      dailyBreakdown: Object.entries(dailyCosts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, costs]) => ({
          date,
          optimization: Math.round(costs.optimization * 100) / 100,
          evaluation: Math.round(costs.evaluation * 100) / 100,
          total: Math.round((costs.optimization + costs.evaluation) * 100) / 100,
        })),
    });
  } catch (error) {
    console.error('Error getting cost tracking data:', error);
    res.status(500).json({ error: 'Failed to get cost tracking data' });
  }
});

// ============================================================
// GET /api/observability/prometheus - Prometheus-compatible metrics
// ============================================================

router.get('/prometheus', async (req: Request, res: Response) => {
  try {
    const healthStatus = await healthCheckService.performHealthCheck();

    // Format metrics in Prometheus format
    const metrics: string[] = [
      '# HELP promptstudio_uptime_seconds Server uptime in seconds',
      '# TYPE promptstudio_uptime_seconds gauge',
      `promptstudio_uptime_seconds ${healthStatus.uptime}`,
      '',
      '# HELP promptstudio_memory_used_mb Memory used in MB',
      '# TYPE promptstudio_memory_used_mb gauge',
      `promptstudio_memory_used_mb ${healthStatus.metrics.memory.used}`,
      '',
      '# HELP promptstudio_memory_percentage Memory usage percentage',
      '# TYPE promptstudio_memory_percentage gauge',
      `promptstudio_memory_percentage ${healthStatus.metrics.memory.percentage}`,
      '',
      '# HELP promptstudio_active_connections Active WebSocket connections',
      '# TYPE promptstudio_active_connections gauge',
      `promptstudio_active_connections ${healthStatus.metrics.activeConnections}`,
      '',
      '# HELP promptstudio_total_requests Total HTTP requests',
      '# TYPE promptstudio_total_requests counter',
      `promptstudio_total_requests ${healthStatus.metrics.totalRequests}`,
      '',
      '# HELP promptstudio_error_rate Error rate percentage',
      '# TYPE promptstudio_error_rate gauge',
      `promptstudio_error_rate ${healthStatus.metrics.errorRate}`,
      '',
      '# HELP promptstudio_service_health Service health (1=healthy, 0.5=degraded, 0=unhealthy)',
      '# TYPE promptstudio_service_health gauge',
    ];

    // Add service health metrics
    for (const [service, status] of Object.entries(healthStatus.services)) {
      const value = status.status === 'healthy' ? 1 : status.status === 'degraded' ? 0.5 : 0;
      metrics.push(`promptstudio_service_health{service="${service}"} ${value}`);
    }

    // Get run counts
    const [activeOptRuns, activeEvalRuns] = await Promise.all([
      prisma.optimizationRun.count({ where: { status: { in: ['queued', 'running'] } } }),
      prisma.advancedEvaluationRun.count({ where: { status: { in: ['queued', 'running'] } } }),
    ]);

    metrics.push(
      '',
      '# HELP promptstudio_active_optimization_runs Active optimization runs',
      '# TYPE promptstudio_active_optimization_runs gauge',
      `promptstudio_active_optimization_runs ${activeOptRuns}`,
      '',
      '# HELP promptstudio_active_evaluation_runs Active evaluation runs',
      '# TYPE promptstudio_active_evaluation_runs gauge',
      `promptstudio_active_evaluation_runs ${activeEvalRuns}`,
    );

    res.set('Content-Type', 'text/plain');
    res.send(metrics.join('\n'));
  } catch (error) {
    console.error('Error generating Prometheus metrics:', error);
    res.status(500).send('# Error generating metrics');
  }
});

export default router;
