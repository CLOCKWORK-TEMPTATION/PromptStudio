// ============================================================
// Audit Trail API Routes - Epic 3.3
// Query and manage audit events
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const router = Router();

// ============================================================
// Types
// ============================================================

type AuditEventType =
  | 'optimization.started'
  | 'optimization.completed'
  | 'optimization.failed'
  | 'optimization.cancelled'
  | 'evaluation.started'
  | 'evaluation.completed'
  | 'evaluation.failed'
  | 'evaluation.cancelled'
  | 'budget.exceeded'
  | 'budget.reset'
  | 'budget.warning'
  | 'policy.updated'
  | 'ratelimit.exceeded'
  | 'template.created'
  | 'template.updated'
  | 'template.deleted'
  | 'version.created'
  | 'version.activated'
  | 'dataset.created'
  | 'dataset.updated'
  | 'dataset.deleted'
  | 'dataset.examples_added'
  | 'rubric.created'
  | 'rubric.updated'
  | 'rubric.deleted'
  | 'system.startup'
  | 'system.shutdown'
  | 'system.error';

// ============================================================
// Validation Schemas
// ============================================================

const querySchema = z.object({
  workspaceId: z.string().optional(),
  actorId: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  eventTypes: z.string().optional(), // comma-separated
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

// ============================================================
// Helper: Log audit event
// ============================================================

export async function logAuditEvent(
  eventType: AuditEventType,
  entityType: string,
  entityId?: string,
  payload?: Record<string, unknown>,
  req?: Request
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        eventType,
        entityType,
        entityId,
        actorId: req ? (req as any).userId : undefined,
        workspaceId: req?.query.workspaceId as string || (req?.body?.workspaceId as string),
        payloadJson: (payload || {}) as any,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.get?.('User-Agent'),
      },
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

// ============================================================
// GET /api/audit - Query audit events
// ============================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const validation = querySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const {
      workspaceId,
      actorId,
      entityType,
      entityId,
      eventTypes,
      startDate,
      endDate,
      limit = '50',
      offset = '0',
    } = validation.data;

    const where: Record<string, unknown> = {};

    if (workspaceId) where.workspaceId = workspaceId;
    if (actorId) where.actorId = actorId;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    if (eventTypes) {
      where.eventType = { in: eventTypes.split(',') };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.createdAt as Record<string, Date>).lte = new Date(endDate);
      }
    }

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit, 10),
        skip: parseInt(offset, 10),
      }),
      prisma.auditEvent.count({ where }),
    ]);

    res.json({
      events,
      total,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (error) {
    console.error('Error querying audit events:', error);
    res.status(500).json({ error: 'Failed to query audit events' });
  }
});

// ============================================================
// GET /api/audit/entity/:type/:id - Get audit history for entity
// ============================================================

router.get('/entity/:type/:id', async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const { limit = '20' } = req.query;

    const events = await prisma.auditEvent.findMany({
      where: {
        entityType: type,
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    res.json({ events });
  } catch (error) {
    console.error('Error getting entity audit history:', error);
    res.status(500).json({ error: 'Failed to get audit history' });
  }
});

// ============================================================
// GET /api/audit/stats - Get audit statistics
// ============================================================

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.query;
    const where: Record<string, unknown> = {};
    if (workspaceId) where.workspaceId = workspaceId;

    // Get counts for last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalEvents,
      eventsLast24h,
      eventsLastWeek,
      eventsByType,
      eventsByEntity,
      recentErrors,
    ] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.count({
        where: { ...where, createdAt: { gte: oneDayAgo } },
      }),
      prisma.auditEvent.count({
        where: { ...where, createdAt: { gte: oneWeekAgo } },
      }),
      prisma.auditEvent.groupBy({
        by: ['eventType'],
        where: { ...where, createdAt: { gte: oneDayAgo } },
        _count: true,
        orderBy: { _count: { eventType: 'desc' } },
        take: 10,
      }),
      prisma.auditEvent.groupBy({
        by: ['entityType'],
        where: { ...where, createdAt: { gte: oneDayAgo } },
        _count: true,
        orderBy: { _count: { entityType: 'desc' } },
      }),
      prisma.auditEvent.findMany({
        where: {
          ...where,
          eventType: { in: ['optimization.failed', 'evaluation.failed', 'budget.exceeded', 'ratelimit.exceeded', 'system.error'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    res.json({
      totalEvents,
      eventsLast24Hours: eventsLast24h,
      eventsLastWeek,
      topEventTypes: eventsByType.map(e => ({
        type: e.eventType,
        count: e._count,
      })),
      eventsByEntity: eventsByEntity.map(e => ({
        entity: e.entityType,
        count: e._count,
      })),
      recentErrors,
    });
  } catch (error) {
    console.error('Error getting audit stats:', error);
    res.status(500).json({ error: 'Failed to get audit statistics' });
  }
});

// ============================================================
// GET /api/audit/activity - Get recent activity feed
// ============================================================

router.get('/activity', async (req: Request, res: Response) => {
  try {
    const { workspaceId, limit = '50' } = req.query;

    const where: Record<string, unknown> = {};
    if (workspaceId) where.workspaceId = workspaceId;

    // Get recent non-system events
    const events = await prisma.auditEvent.findMany({
      where: {
        ...where,
        eventType: {
          notIn: ['system.startup', 'system.shutdown'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    // Format as activity feed
    const activity = events.map(event => ({
      id: event.id,
      type: event.eventType,
      entity: event.entityType,
      entityId: event.entityId,
      actorId: event.actorId,
      timestamp: event.createdAt,
      summary: formatActivitySummary(event),
    }));

    res.json({ activity });
  } catch (error) {
    console.error('Error getting activity feed:', error);
    res.status(500).json({ error: 'Failed to get activity feed' });
  }
});

// ============================================================
// DELETE /api/audit/cleanup - Clean up old audit events
// ============================================================

router.delete('/cleanup', async (req: Request, res: Response) => {
  try {
    const { retentionDays = '90' } = req.query;
    const days = parseInt(retentionDays as string, 10);

    if (days < 30) {
      return res.status(400).json({
        error: 'Minimum retention period is 30 days',
      });
    }

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await prisma.auditEvent.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    // Log the cleanup action
    await logAuditEvent(
      'system.startup',
      'System',
      undefined,
      {
        action: 'audit_cleanup',
        deletedCount: result.count,
        retentionDays: days,
        cutoffDate: cutoffDate.toISOString(),
      },
      req
    );

    res.json({
      success: true,
      deletedCount: result.count,
      retentionDays: days,
    });
  } catch (error) {
    console.error('Error cleaning up audit events:', error);
    res.status(500).json({ error: 'Failed to clean up audit events' });
  }
});

// ============================================================
// Helper Functions
// ============================================================

function formatActivitySummary(event: {
  eventType: string;
  entityType: string;
  entityId: string | null;
  payloadJson: unknown;
}): string {
  const payload = event.payloadJson as Record<string, unknown> || {};

  switch (event.eventType) {
    case 'optimization.started':
      return `Started optimization run ${event.entityId}`;
    case 'optimization.completed':
      return `Completed optimization run ${event.entityId}`;
    case 'optimization.failed':
      return `Optimization run ${event.entityId} failed`;
    case 'evaluation.started':
      return `Started evaluation run ${event.entityId}`;
    case 'evaluation.completed':
      return `Completed evaluation run ${event.entityId}`;
    case 'evaluation.failed':
      return `Evaluation run ${event.entityId} failed`;
    case 'budget.exceeded':
      return `Budget exceeded: ${payload.reason || 'Unknown'}`;
    case 'budget.reset':
      return `Daily budget reset`;
    case 'ratelimit.exceeded':
      return `Rate limit exceeded for ${payload.endpoint || 'endpoint'}`;
    case 'template.created':
      return `Created template ${payload.name || event.entityId}`;
    case 'template.updated':
      return `Updated template ${event.entityId}`;
    case 'template.deleted':
      return `Deleted template ${event.entityId}`;
    case 'version.created':
      return `Created version ${payload.versionNumber || ''} for template`;
    case 'version.activated':
      return `Activated version ${payload.versionNumber || ''}`;
    case 'dataset.created':
      return `Created dataset ${payload.name || event.entityId}`;
    case 'dataset.deleted':
      return `Deleted dataset ${event.entityId}`;
    case 'rubric.created':
      return `Created rubric ${payload.name || event.entityId}`;
    case 'rubric.deleted':
      return `Deleted rubric ${event.entityId}`;
    default:
      return `${event.eventType} on ${event.entityType}`;
  }
}

export default router;
