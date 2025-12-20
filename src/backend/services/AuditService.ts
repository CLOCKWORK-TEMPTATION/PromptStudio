import { PrismaClient } from '@prisma/client';

export interface AuditEvent {
    tenantId?: string;
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    errorMessage?: string;
}

export class AuditService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Log an audit event
     */
    async logEvent(event: AuditEvent): Promise<void> {
        try {
            await this.prisma.auditLog.create({
                data: {
                    tenantId: event.tenantId,
                    userId: event.userId,
                    action: event.action,
                    resource: event.resource,
                    resourceId: event.resourceId,
                    details: event.details ? JSON.stringify(event.details) : undefined,
                    ipAddress: event.ipAddress,
                    userAgent: event.userAgent,
                    success: event.success ?? true,
                    errorMessage: event.errorMessage
                }
            });
        } catch (error) {
            console.error('Failed to log audit event:', error);
            // Don't throw - audit logging should not break the main flow
        }
    }

    /**
     * Log user authentication event
     */
    async logAuthEvent(
        userId: string,
        action: 'LOGIN' | 'LOGOUT' | 'FAILED_LOGIN',
        success: boolean,
        ipAddress?: string,
        userAgent?: string,
        details?: Record<string, unknown>
    ): Promise<void> {
        await this.logEvent({
            userId,
            action,
            resource: 'auth',
            success,
            ipAddress,
            userAgent,
            details
        });
    }

    /**
     * Log resource access event
     */
    async logResourceAccess(
        userId: string,
        tenantId: string | undefined,
        action: string,
        resource: string,
        resourceId: string | undefined,
        success: boolean,
        details?: Record<string, unknown>
    ): Promise<void> {
        await this.logEvent({
            tenantId,
            userId,
            action,
            resource,
            resourceId,
            success,
            details
        });
    }

    /**
     * Log API request
     */
    async logApiRequest(
        userId: string | undefined,
        tenantId: string | undefined,
        method: string,
        path: string,
        statusCode: number,
        duration: number,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        await this.logEvent({
            tenantId,
            userId,
            action: 'API_REQUEST',
            resource: 'api',
            success: statusCode < 400,
            details: {
                method,
                path,
                statusCode,
                duration
            },
            ipAddress,
            userAgent
        });
    }

    /**
     * Get audit logs with filtering
     */
    async getAuditLogs(filters: {
        tenantId?: string;
        userId?: string;
        action?: string;
        resource?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<unknown[]> {
        const where: {
            tenantId?: string;
            userId?: string;
            action?: string;
            resource?: string;
            timestamp?: { gte?: Date; lte?: Date };
        } = {};

        if (filters.tenantId) where.tenantId = filters.tenantId;
        if (filters.userId) where.userId = filters.userId;
        if (filters.action) where.action = filters.action;
        if (filters.resource) where.resource = filters.resource;

        if (filters.startDate || filters.endDate) {
            where.timestamp = {};
            if (filters.startDate) where.timestamp.gte = filters.startDate;
            if (filters.endDate) where.timestamp.lte = filters.endDate;
        }

        const logs = await this.prisma.auditLog.findMany({
            where,
            include: {
                user: {
                    select: { id: true, email: true, name: true }
                },
                tenant: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { timestamp: 'desc' },
            take: filters.limit || 100,
            skip: filters.offset || 0
        });

        return logs;
    }

    /**
     * Get audit statistics
     */
    async getAuditStats(tenantId?: string, days: number = 30): Promise<{
        totalEvents: number;
        successfulEvents: number;
        failedEvents: number;
        topActions: { action: string; count: number }[];
        topResources: { resource: string; count: number }[];
    }> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const where: {
            tenantId?: string;
            timestamp: { gte: Date };
        } = {
            timestamp: { gte: startDate }
        };

        if (tenantId) where.tenantId = tenantId;

        const [totalEvents, successfulEvents, failedEvents] = await Promise.all([
            this.prisma.auditLog.count({ where }),
            this.prisma.auditLog.count({ where: { ...where, success: true } }),
            this.prisma.auditLog.count({ where: { ...where, success: false } })
        ]);

        // Get top actions
        const topActionsResult = await this.prisma.auditLog.groupBy({
            by: ['action'],
            where,
            _count: { action: true },
            orderBy: { _count: { action: 'desc' } },
            take: 10
        });

        const topActions = topActionsResult.map(item => ({
            action: item.action,
            count: item._count.action
        }));

        // Get top resources
        const topResourcesResult = await this.prisma.auditLog.groupBy({
            by: ['resource'],
            where,
            _count: { resource: true },
            orderBy: { _count: { resource: 'desc' } },
            take: 10
        });

        const topResources = topResourcesResult.map(item => ({
            resource: item.resource,
            count: item._count.resource
        }));

        return {
            totalEvents,
            successfulEvents,
            failedEvents,
            topActions,
            topResources
        };
    }

    /**
     * Clean up old audit logs (for data retention)
     */
    async cleanupOldLogs(daysToKeep: number = 365): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await this.prisma.auditLog.deleteMany({
            where: {
                timestamp: { lt: cutoffDate }
            }
        });

        return result.count;
    }
}