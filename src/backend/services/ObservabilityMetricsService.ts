// ============================================================
// Observability Metrics Service
// Tracks success rate, P95 duration, avg cost, optimizer distribution
// ============================================================

import { prisma } from '../lib/prisma.js';
import { metricsLogger } from './StructuredLogger.js';

// ============================================================
// Types
// ============================================================

export interface RunMetrics {
  successRate: number;
  failureRate: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  canceledRuns: number;
  runningRuns: number;
  queuedRuns: number;
}

export interface DurationMetrics {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
}

export interface CostMetrics {
  totalUSD: number;
  avgPerRun: number;
  totalCalls: number;
  avgCallsPerRun: number;
  totalTokens: number;
  avgTokensPerRun: number;
}

export interface OptimizerDistribution {
  optimizerType: string;
  count: number;
  percentage: number;
  avgScore: number;
  avgDuration: number;
  successRate: number;
}

export interface MetricDistribution {
  metricType: string;
  count: number;
  percentage: number;
  avgScore: number;
}

export interface ObservabilityDashboard {
  runs: RunMetrics;
  duration: DurationMetrics;
  cost: CostMetrics;
  optimizerDistribution: OptimizerDistribution[];
  metricDistribution: MetricDistribution[];
  recentActivity: RecentActivity[];
  timeSeriesData: TimeSeriesPoint[];
}

export interface RecentActivity {
  runId: string;
  type: 'optimization' | 'evaluation';
  status: string;
  templateName?: string;
  datasetName?: string;
  score?: number;
  cost?: number;
  duration?: number;
  createdAt: Date;
  finishedAt?: Date;
}

export interface TimeSeriesPoint {
  timestamp: string;
  successCount: number;
  failureCount: number;
  totalCost: number;
  avgDuration: number;
}

// ============================================================
// Observability Metrics Service
// ============================================================

export class ObservabilityMetricsService {
  private logger = metricsLogger;

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(options: {
    workspaceId?: string;
    tenantId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    type?: 'optimization' | 'evaluation' | 'all';
  } = {}): Promise<ObservabilityDashboard> {
    const { workspaceId, tenantId, dateFrom, dateTo, type = 'all' } = options;

    this.logger.info('Fetching dashboard metrics', { workspaceId, tenantId });

    const [
      runMetrics,
      durationMetrics,
      costMetrics,
      optimizerDist,
      metricDist,
      recentActivity,
      timeSeries,
    ] = await Promise.all([
      this.getRunMetrics({ workspaceId, tenantId, dateFrom, dateTo, type }),
      this.getDurationMetrics({ workspaceId, tenantId, dateFrom, dateTo, type }),
      this.getCostMetrics({ workspaceId, tenantId, dateFrom, dateTo, type }),
      this.getOptimizerDistribution({ workspaceId, tenantId, dateFrom, dateTo }),
      this.getMetricDistribution({ workspaceId, tenantId, dateFrom, dateTo }),
      this.getRecentActivity({ workspaceId, tenantId, limit: 10 }),
      this.getTimeSeriesData({ workspaceId, tenantId, dateFrom, dateTo, granularity: 'day' }),
    ]);

    return {
      runs: runMetrics,
      duration: durationMetrics,
      cost: costMetrics,
      optimizerDistribution: optimizerDist,
      metricDistribution: metricDist,
      recentActivity,
      timeSeriesData: timeSeries,
    };
  }

  /**
   * Get run success/failure metrics
   */
  async getRunMetrics(options: {
    workspaceId?: string;
    tenantId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    type?: 'optimization' | 'evaluation' | 'all';
  }): Promise<RunMetrics> {
    const { tenantId, dateFrom, dateTo, type = 'all' } = options;

    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    let optimizationStats: Record<string, number> = {};
    let evaluationStats: Record<string, number> = {};

    if (type === 'all' || type === 'optimization') {
      const optWhere: Record<string, unknown> = { ...dateFilter };
      if (tenantId) optWhere.tenantId = tenantId;

      const stats = await prisma.optimizationRun.groupBy({
        by: ['status'],
        where: optWhere,
        _count: true,
      });

      stats.forEach(s => {
        optimizationStats[s.status] = s._count;
      });
    }

    if (type === 'all' || type === 'evaluation') {
      const evalWhere: Record<string, unknown> = { ...dateFilter };
      if (options.workspaceId) evalWhere.workspaceId = options.workspaceId;

      const stats = await prisma.advancedEvaluationRun.groupBy({
        by: ['status'],
        where: evalWhere,
        _count: true,
      });

      stats.forEach(s => {
        evaluationStats[s.status] = s._count;
      });
    }

    const getCount = (status: string) =>
      (optimizationStats[status] || 0) + (evaluationStats[status] || 0);

    const successfulRuns = getCount('succeeded');
    const failedRuns = getCount('failed');
    const canceledRuns = getCount('canceled');
    const runningRuns = getCount('running');
    const queuedRuns = getCount('queued');
    const totalRuns = successfulRuns + failedRuns + canceledRuns + runningRuns + queuedRuns;

    const completedRuns = successfulRuns + failedRuns;
    const successRate = completedRuns > 0 ? (successfulRuns / completedRuns) * 100 : 0;
    const failureRate = completedRuns > 0 ? (failedRuns / completedRuns) * 100 : 0;

    return {
      successRate,
      failureRate,
      totalRuns,
      successfulRuns,
      failedRuns,
      canceledRuns,
      runningRuns,
      queuedRuns,
    };
  }

  /**
   * Get duration percentile metrics (P50, P75, P90, P95, P99)
   */
  async getDurationMetrics(options: {
    workspaceId?: string;
    tenantId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    type?: 'optimization' | 'evaluation' | 'all';
  }): Promise<DurationMetrics> {
    const { tenantId, dateFrom, dateTo, type = 'all' } = options;

    const dateFilter = this.buildDateFilter(dateFrom, dateTo);
    const durations: number[] = [];

    if (type === 'all' || type === 'optimization') {
      const optWhere: Record<string, unknown> = {
        ...dateFilter,
        status: 'succeeded',
        startedAt: { not: null },
        finishedAt: { not: null },
      };
      if (tenantId) optWhere.tenantId = tenantId;

      const runs = await prisma.optimizationRun.findMany({
        where: optWhere,
        select: { startedAt: true, finishedAt: true },
      });

      runs.forEach(r => {
        if (r.startedAt && r.finishedAt) {
          durations.push(new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime());
        }
      });
    }

    if (type === 'all' || type === 'evaluation') {
      const evalWhere: Record<string, unknown> = {
        ...dateFilter,
        status: 'succeeded',
        startedAt: { not: null },
        finishedAt: { not: null },
      };
      if (options.workspaceId) evalWhere.workspaceId = options.workspaceId;

      const runs = await prisma.advancedEvaluationRun.findMany({
        where: evalWhere,
        select: { startedAt: true, finishedAt: true },
      });

      runs.forEach(r => {
        if (r.startedAt && r.finishedAt) {
          durations.push(new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime());
        }
      });
    }

    if (durations.length === 0) {
      return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
    }

    durations.sort((a, b) => a - b);

    const percentile = (arr: number[], p: number): number => {
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };

    return {
      p50: percentile(durations, 50),
      p75: percentile(durations, 75),
      p90: percentile(durations, 90),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
    };
  }

  /**
   * Get cost metrics
   */
  async getCostMetrics(options: {
    workspaceId?: string;
    tenantId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    type?: 'optimization' | 'evaluation' | 'all';
  }): Promise<CostMetrics> {
    const { tenantId, dateFrom, dateTo, type = 'all' } = options;

    const dateFilter = this.buildDateFilter(dateFrom, dateTo);
    let totalUSD = 0;
    let totalCalls = 0;
    let totalTokens = 0;
    let runCount = 0;

    if (type === 'all' || type === 'optimization') {
      const optWhere: Record<string, unknown> = { ...dateFilter };
      if (tenantId) optWhere.tenantId = tenantId;

      const results = await prisma.optimizationResult.findMany({
        where: {
          run: optWhere,
        },
        select: { cost: true },
      });

      results.forEach(r => {
        const cost = r.cost as { calls?: number; tokens?: number; usd?: number; usdEstimate?: number } | null;
        if (cost) {
          totalUSD += cost.usd || cost.usdEstimate || 0;
          totalCalls += cost.calls || 0;
          totalTokens += cost.tokens || 0;
          runCount++;
        }
      });
    }

    if (type === 'all' || type === 'evaluation') {
      const evalWhere: Record<string, unknown> = { ...dateFilter };
      if (options.workspaceId) evalWhere.workspaceId = options.workspaceId;

      const runs = await prisma.advancedEvaluationRun.findMany({
        where: evalWhere,
        select: { cost: true },
      });

      runs.forEach(r => {
        const cost = r.cost as { calls?: number; tokens?: number; usd?: number; usdEstimate?: number; totalUSD?: number } | null;
        if (cost) {
          totalUSD += cost.usd || cost.usdEstimate || cost.totalUSD || 0;
          totalCalls += cost.calls || 0;
          totalTokens += cost.tokens || 0;
          runCount++;
        }
      });
    }

    return {
      totalUSD,
      avgPerRun: runCount > 0 ? totalUSD / runCount : 0,
      totalCalls,
      avgCallsPerRun: runCount > 0 ? totalCalls / runCount : 0,
      totalTokens,
      avgTokensPerRun: runCount > 0 ? totalTokens / runCount : 0,
    };
  }

  /**
   * Get optimizer type distribution
   */
  async getOptimizerDistribution(options: {
    workspaceId?: string;
    tenantId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<OptimizerDistribution[]> {
    const { tenantId, dateFrom, dateTo } = options;

    const dateFilter = this.buildDateFilter(dateFrom, dateTo);
    const where: Record<string, unknown> = { ...dateFilter };
    if (tenantId) where.tenantId = tenantId;

    const stats = await prisma.optimizationRun.groupBy({
      by: ['optimizerType'],
      where,
      _count: true,
    });

    const total = stats.reduce((sum, s) => sum + s._count, 0);

    const distribution: OptimizerDistribution[] = [];

    for (const stat of stats) {
      // Get additional metrics per optimizer
      const runs = await prisma.optimizationRun.findMany({
        where: { ...where, optimizerType: stat.optimizerType },
        select: {
          status: true,
          startedAt: true,
          finishedAt: true,
          result: { select: { optimizedScore: true } },
        },
      });

      const successfulRuns = runs.filter(r => r.status === 'succeeded');
      const scores = successfulRuns
        .filter(r => r.result?.optimizedScore !== null)
        .map(r => r.result!.optimizedScore!);

      const durations = successfulRuns
        .filter(r => r.startedAt && r.finishedAt)
        .map(r => new Date(r.finishedAt!).getTime() - new Date(r.startedAt!).getTime());

      distribution.push({
        optimizerType: stat.optimizerType,
        count: stat._count,
        percentage: total > 0 ? (stat._count / total) * 100 : 0,
        avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        successRate: runs.length > 0 ? (successfulRuns.length / runs.length) * 100 : 0,
      });
    }

    return distribution;
  }

  /**
   * Get metric type distribution
   */
  async getMetricDistribution(options: {
    workspaceId?: string;
    tenantId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<MetricDistribution[]> {
    const { tenantId, dateFrom, dateTo } = options;

    const dateFilter = this.buildDateFilter(dateFrom, dateTo);
    const where: Record<string, unknown> = { ...dateFilter };
    if (tenantId) where.tenantId = tenantId;

    const stats = await prisma.optimizationRun.groupBy({
      by: ['metricType'],
      where,
      _count: true,
    });

    const total = stats.reduce((sum, s) => sum + s._count, 0);

    const distribution: MetricDistribution[] = [];

    for (const stat of stats) {
      const runs = await prisma.optimizationRun.findMany({
        where: { ...where, metricType: stat.metricType, status: 'succeeded' },
        include: { result: { select: { optimizedScore: true } } },
      });

      const scores = runs
        .filter(r => r.result?.optimizedScore !== null)
        .map(r => r.result!.optimizedScore!);

      distribution.push({
        metricType: stat.metricType,
        count: stat._count,
        percentage: total > 0 ? (stat._count / total) * 100 : 0,
        avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      });
    }

    return distribution;
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(options: {
    workspaceId?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<RecentActivity[]> {
    const { tenantId, workspaceId, limit = 10 } = options;

    const optWhere: Record<string, unknown> = {};
    if (tenantId) optWhere.tenantId = tenantId;

    const evalWhere: Record<string, unknown> = {};
    if (workspaceId) evalWhere.workspaceId = workspaceId;

    const [optRuns, evalRuns] = await Promise.all([
      prisma.optimizationRun.findMany({
        where: optWhere,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          template: { select: { name: true } },
          dataset: { select: { name: true } },
          result: { select: { optimizedScore: true, cost: true } },
        },
      }),
      prisma.advancedEvaluationRun.findMany({
        where: evalWhere,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const activity: RecentActivity[] = [];

    for (const run of optRuns) {
      const cost = run.result?.cost as { usd?: number } | null;
      activity.push({
        runId: run.id,
        type: 'optimization',
        status: run.status,
        templateName: run.template?.name,
        datasetName: run.dataset?.name,
        score: run.result?.optimizedScore ?? undefined,
        cost: cost?.usd,
        duration: run.startedAt && run.finishedAt
          ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
          : undefined,
        createdAt: run.createdAt,
        finishedAt: run.finishedAt ?? undefined,
      });
    }

    for (const run of evalRuns) {
      const cost = run.cost as { usd?: number; totalUSD?: number } | null;
      activity.push({
        runId: run.id,
        type: 'evaluation',
        status: run.status,
        score: run.score ?? undefined,
        cost: cost?.usd || cost?.totalUSD,
        duration: run.startedAt && run.finishedAt
          ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
          : undefined,
        createdAt: run.createdAt,
        finishedAt: run.finishedAt ?? undefined,
      });
    }

    // Sort by createdAt descending and limit
    return activity
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get time series data for charts
   */
  async getTimeSeriesData(options: {
    workspaceId?: string;
    tenantId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    granularity?: 'hour' | 'day' | 'week';
  }): Promise<TimeSeriesPoint[]> {
    const { tenantId, dateFrom, dateTo, granularity = 'day' } = options;

    const now = new Date();
    const from = dateFrom || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
    const to = dateTo || now;

    const dateFilter = { createdAt: { gte: from, lte: to } };
    const optWhere: Record<string, unknown> = { ...dateFilter };
    if (tenantId) optWhere.tenantId = tenantId;

    const runs = await prisma.optimizationRun.findMany({
      where: optWhere,
      select: {
        status: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        result: { select: { cost: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by time bucket
    const buckets = new Map<string, {
      successCount: number;
      failureCount: number;
      totalCost: number;
      durations: number[];
    }>();

    for (const run of runs) {
      const bucketKey = this.getBucketKey(run.createdAt, granularity);

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, { successCount: 0, failureCount: 0, totalCost: 0, durations: [] });
      }

      const bucket = buckets.get(bucketKey)!;

      if (run.status === 'succeeded') {
        bucket.successCount++;
      } else if (run.status === 'failed') {
        bucket.failureCount++;
      }

      const cost = run.result?.cost as { usd?: number } | null;
      if (cost?.usd) {
        bucket.totalCost += cost.usd;
      }

      if (run.startedAt && run.finishedAt) {
        bucket.durations.push(
          new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
        );
      }
    }

    return Array.from(buckets.entries()).map(([timestamp, data]) => ({
      timestamp,
      successCount: data.successCount,
      failureCount: data.failureCount,
      totalCost: data.totalCost,
      avgDuration: data.durations.length > 0
        ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
        : 0,
    }));
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private buildDateFilter(dateFrom?: Date, dateTo?: Date): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) (filter.createdAt as Record<string, Date>).gte = dateFrom;
      if (dateTo) (filter.createdAt as Record<string, Date>).lte = dateTo;
    }
    return filter;
  }

  private getBucketKey(date: Date, granularity: 'hour' | 'day' | 'week'): string {
    const d = new Date(date);
    switch (granularity) {
      case 'hour':
        d.setMinutes(0, 0, 0);
        return d.toISOString();
      case 'day':
        d.setHours(0, 0, 0, 0);
        return d.toISOString().split('T')[0];
      case 'week':
        const day = d.getDay();
        d.setDate(d.getDate() - day);
        d.setHours(0, 0, 0, 0);
        return d.toISOString().split('T')[0];
      default:
        return d.toISOString().split('T')[0];
    }
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const observabilityService = new ObservabilityMetricsService();
