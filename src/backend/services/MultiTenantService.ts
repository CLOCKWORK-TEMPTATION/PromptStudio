import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface TenantConfig {
    name: string;
    domain?: string;
    config?: Record<string, unknown>;
    apiKey?: string;
}

export class MultiTenantService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Create a new tenant
     */
    async createTenant(config: TenantConfig): Promise<string> {
        const apiKey = config.apiKey || crypto.randomBytes(32).toString('hex');

        const tenant = await this.prisma.tenant.create({
            data: {
                name: config.name,
                domain: config.domain,
                apiKey,
                config: config.config ? JSON.stringify(config.config) : undefined
            }
        });

        return tenant.id;
    }

    /**
     * Get tenant by ID
     */
    async getTenant(tenantId: string): Promise<unknown | null> {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            include: {
                _count: {
                    select: {
                        users: true,
                        collaborationSessions: true,
                        marketplacePrompts: true
                    }
                }
            }
        });

        if (!tenant) return null;

        return {
            ...tenant,
            config: tenant.config ? tenant.config : {}
        };
    }

    /**
     * Get tenant by domain
     */
    async getTenantByDomain(domain: string): Promise<unknown | null> {
        const tenant = await this.prisma.tenant.findUnique({
            where: { domain }
        });

        if (!tenant) return null;

        return {
            ...tenant,
            config: tenant.config ? tenant.config : {}
        };
    }

    /**
     * Get tenant by API key
     */
    async getTenantByApiKey(apiKey: string): Promise<unknown | null> {
        const tenant = await this.prisma.tenant.findUnique({
            where: { apiKey }
        });

        if (!tenant) return null;

        return {
            ...tenant,
            config: tenant.config ? tenant.config : {}
        };
    }

    /**
     * Update tenant configuration
     */
    async updateTenant(
        tenantId: string,
        updates: {
            name?: string;
            domain?: string;
            config?: Record<string, unknown>;
            isActive?: boolean;
        }
    ): Promise<void> {
        const data: Record<string, unknown> = {};

        if (updates.name) data.name = updates.name;
        if (updates.domain !== undefined) data.domain = updates.domain;
        if (updates.config) data.config = JSON.stringify(updates.config);
        if (updates.isActive !== undefined) data.isActive = updates.isActive;

        await this.prisma.tenant.update({
            where: { id: tenantId },
            data
        });
    }

    /**
     * Delete tenant (soft delete by deactivating)
     */
    async deactivateTenant(tenantId: string): Promise<void> {
        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { isActive: false }
        });
    }

    /**
     * Get tenant statistics
     */
    async getTenantStats(tenantId: string): Promise<{
        userCount: number;
        sessionCount: number;
        promptCount: number;
        activeUsers: number;
        storageUsed: number;
        apiCalls: number;
    }> {
        const [userCount, sessionCount, promptCount, activeUsersResult, apiCallsResult] = await Promise.all([
            this.prisma.user.count({ where: { tenantId } }),
            this.prisma.collaborationSession.count({ where: { tenantId } }),
            this.prisma.marketplacePrompt.count({ where: { tenantId } }),
            this.prisma.user.count({
                where: {
                    tenantId,
                    updatedAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                    }
                }
            }),
            this.prisma.auditLog.count({
                where: {
                    tenantId,
                    action: 'API_REQUEST',
                    timestamp: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                }
            })
        ]);

        // Calculate storage used (simplified - in real implementation, you'd track actual storage)
        const storageUsed = await this.calculateStorageUsed(tenantId);

        return {
            userCount,
            sessionCount,
            promptCount,
            activeUsers: activeUsersResult,
            storageUsed,
            apiCalls: apiCallsResult
        };
    }

    /**
     * Assign user to tenant
     */
    async assignUserToTenant(userId: string, tenantId: string): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: { tenantId }
        });
    }

    /**
     * Remove user from tenant
     */
    async removeUserFromTenant(userId: string): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: { tenantId: null }
        });
    }

    /**
     * Get tenant users
     */
    async getTenantUsers(tenantId: string, limit: number = 50, offset: number = 0): Promise<unknown[]> {
        return await this.prisma.user.findMany({
            where: { tenantId },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                color: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        ownedSessions: true,
                        marketplacePrompts: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        });
    }

    /**
     * Check if user belongs to tenant
     */
    async userBelongsToTenant(userId: string, tenantId: string): Promise<boolean> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { tenantId: true }
        });

        return user?.tenantId === tenantId;
    }

    /**
     * Get tenant resource usage limits
     */
    async getTenantLimits(tenantId: string): Promise<{
        maxUsers: number;
        maxSessions: number;
        maxPrompts: number;
        maxStorage: number;
        maxApiCalls: number;
    }> {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { config: true }
        });

        const config = (tenant?.config && typeof tenant.config === 'object') ? tenant.config as Record<string, number> : {};

        return {
            maxUsers: Number(config.maxUsers) || 100,
            maxSessions: Number(config.maxSessions) || 50,
            maxPrompts: Number(config.maxPrompts) || 200,
            maxStorage: Number(config.maxStorage) || 1024 * 1024 * 1024, // 1GB
            maxApiCalls: Number(config.maxApiCalls) || 10000
        };
    }

    /**
     * Check if tenant is within limits
     */
    async checkTenantLimits(tenantId: string): Promise<{
        withinLimits: boolean;
        violations: string[];
    }> {
        const [stats, limits] = await Promise.all([
            this.getTenantStats(tenantId),
            this.getTenantLimits(tenantId)
        ]);

        const violations: string[] = [];

        if (stats.userCount >= limits.maxUsers) {
            violations.push(`User limit exceeded: ${stats.userCount}/${limits.maxUsers}`);
        }
        if (stats.sessionCount >= limits.maxSessions) {
            violations.push(`Session limit exceeded: ${stats.sessionCount}/${limits.maxSessions}`);
        }
        if (stats.promptCount >= limits.maxPrompts) {
            violations.push(`Prompt limit exceeded: ${stats.promptCount}/${limits.maxPrompts}`);
        }
        if (stats.storageUsed >= limits.maxStorage) {
            violations.push(`Storage limit exceeded: ${stats.storageUsed}/${limits.maxStorage}`);
        }

        return {
            withinLimits: violations.length === 0,
            violations
        };
    }

    /**
     * Calculate storage used by tenant (simplified implementation)
     */
    private async calculateStorageUsed(tenantId: string): Promise<number> {
        // In a real implementation, you'd calculate actual storage used
        // by summing up file sizes, database sizes, etc.
        // For now, return a mock value based on entity counts
        const [userCount, sessionCount, promptCount] = await Promise.all([
            this.prisma.user.count({ where: { tenantId } }),
            this.prisma.collaborationSession.count({ where: { tenantId } }),
            this.prisma.marketplacePrompt.count({ where: { tenantId } })
        ]);

        // Rough estimation: 1KB per user, 10KB per session, 5KB per prompt
        return (userCount * 1024) + (sessionCount * 10240) + (promptCount * 5120);
    }

    /**
     * Migrate data between tenants (for tenant mergers/splits)
     */
    async migrateTenantData(fromTenantId: string, toTenantId: string): Promise<void> {
        // This is a complex operation that would need careful planning
        // For now, just update user associations
        await this.prisma.user.updateMany({
            where: { tenantId: fromTenantId },
            data: { tenantId: toTenantId }
        });

        // Update sessions
        await this.prisma.collaborationSession.updateMany({
            where: { tenantId: fromTenantId },
            data: { tenantId: toTenantId }
        });

        // Update marketplace prompts
        await this.prisma.marketplacePrompt.updateMany({
            where: { tenantId: fromTenantId },
            data: { tenantId: toTenantId }
        });

        // Note: This is a simplified migration. In production, you'd need
        // to handle conflicts, validate data integrity, and possibly
        // run this as a database transaction
    }
}