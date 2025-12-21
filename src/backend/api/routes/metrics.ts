// ============================================================
// Observability Metrics API Routes
// Dashboard metrics, run analytics, and performance data
// ============================================================

import { Router, Request, Response } from 'express';
import { observabilityService } from '../../services/ObservabilityMetricsService.js';
import { metricsLogger } from '../../services/StructuredLogger.js';

const router = Router();

// ============================================================
// GET /api/metrics/dashboard - Get full dashboard metrics
// ============================================================

router.get('/dashboard', async (req: Request, res: Response) => {
  const logger = metricsLogger.child({});

  try {
    const {
      workspaceId,
      tenantId,
      dateFrom,
      dateTo,
      type,
    } = req.query;

    const options = {
      workspaceId: workspaceId as string | undefined,
      tenantId: tenantId as string | undefined,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      type: type as 'optimization' | 'evaluation' | 'all' | undefined,
    };

    logger.info('Fetching dashboard metrics', {
      workspaceId: workspaceId as string | undefined,
      tenantId: tenantId as string | undefined
    });

    const dashboard = await observabilityService.getDashboardMetrics(options);

    res.json(dashboard);
  } catch (error) {
    logger.errorWithStack('Error fetching dashboard metrics', error as Error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

// ============================================================
// GET /api/metrics/runs - Get run success/failure metrics
// ============================================================

router.get('/runs', async (req: Request, res: Response) => {
  try {
    const { workspaceId, tenantId, dateFrom, dateTo, type } = req.query;

    const metrics = await observabilityService.getRunMetrics({
      workspaceId: workspaceId as string | undefined,
      tenantId: tenantId as string | undefined,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      type: type as 'optimization' | 'evaluation' | 'all' | undefined,
    });

    res.json(metrics);
  } catch (error) {
    metricsLogger.errorWithStack('Error fetching run metrics', error as Error);
    res.status(500).json({ error: 'Failed to fetch run metrics' });
  }
});

// ============================================================
// GET /api/metrics/duration - Get duration percentile metrics
// ============================================================

router.get('/duration', async (req: Request, res: Response) => {
  try {
    const { workspaceId, tenantId, dateFrom, dateTo, type } = req.query;

    const metrics = await observabilityService.getDurationMetrics({
      workspaceId: workspaceId as string | undefined,
      tenantId: tenantId as string | undefined,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      type: type as 'optimization' | 'evaluation' | 'all' | undefined,
    });

    res.json(metrics);
  } catch (error) {
    metricsLogger.errorWithStack('Error fetching duration metrics', error as Error);
    res.status(500).json({ error: 'Failed to fetch duration metrics' });
  }
});

// ============================================================
// GET /api/metrics/cost - Get cost metrics
// ============================================================

router.get('/cost', async (req: Request, res: Response) => {
  try {
    const { workspaceId, tenantId, dateFrom, dateTo, type } = req.query;

    const metrics = await observabilityService.getCostMetrics({
      workspaceId: workspaceId as string | undefined,
      tenantId: tenantId as string | undefined,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      type: type as 'optimization' | 'evaluation' | 'all' | undefined,
    });

    res.json(metrics);
  } catch (error) {
    metricsLogger.errorWithStack('Error fetching cost metrics', error as Error);
    res.status(500).json({ error: 'Failed to fetch cost metrics' });
  }
});

// ============================================================
// GET /api/metrics/optimizer-distribution - Get optimizer type distribution
// ============================================================

router.get('/optimizer-distribution', async (req: Request, res: Response) => {
  try {
    const { workspaceId, tenantId, dateFrom, dateTo } = req.query;

    const distribution = await observabilityService.getOptimizerDistribution({
      workspaceId: workspaceId as string | undefined,
      tenantId: tenantId as string | undefined,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
    });

    res.json(distribution);
  } catch (error) {
    metricsLogger.errorWithStack('Error fetching optimizer distribution', error as Error);
    res.status(500).json({ error: 'Failed to fetch optimizer distribution' });
  }
});

// ============================================================
// GET /api/metrics/metric-distribution - Get metric type distribution
// ============================================================

router.get('/metric-distribution', async (req: Request, res: Response) => {
  try {
    const { workspaceId, tenantId, dateFrom, dateTo } = req.query;

    const distribution = await observabilityService.getMetricDistribution({
      workspaceId: workspaceId as string | undefined,
      tenantId: tenantId as string | undefined,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
    });

    res.json(distribution);
  } catch (error) {
    metricsLogger.errorWithStack('Error fetching metric distribution', error as Error);
    res.status(500).json({ error: 'Failed to fetch metric distribution' });
  }
});

// ============================================================
// GET /api/metrics/activity - Get recent activity
// ============================================================

router.get('/activity', async (req: Request, res: Response) => {
  try {
    const { workspaceId, tenantId, limit = '10' } = req.query;

    const activity = await observabilityService.getRecentActivity({
      workspaceId: workspaceId as string | undefined,
      tenantId: tenantId as string | undefined,
      limit: parseInt(limit as string, 10),
    });

    res.json(activity);
  } catch (error) {
    metricsLogger.errorWithStack('Error fetching recent activity', error as Error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// ============================================================
// GET /api/metrics/timeseries - Get time series data
// ============================================================

router.get('/timeseries', async (req: Request, res: Response) => {
  try {
    const { workspaceId, tenantId, dateFrom, dateTo, granularity = 'day' } = req.query;

    const timeSeries = await observabilityService.getTimeSeriesData({
      workspaceId: workspaceId as string | undefined,
      tenantId: tenantId as string | undefined,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      granularity: granularity as 'hour' | 'day' | 'week',
    });

    res.json(timeSeries);
  } catch (error) {
    metricsLogger.errorWithStack('Error fetching time series data', error as Error);
    res.status(500).json({ error: 'Failed to fetch time series data' });
  }
});

export default router;
