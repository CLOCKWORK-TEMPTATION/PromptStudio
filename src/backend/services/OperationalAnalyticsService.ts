import { PrismaClient } from '@prisma/client';

export interface UsageMetrics {
    requests: number;
    tokensUsed: number;
    cost: number;
    responseTime: number;
    successRate: number;
}

export interface QualityMetrics {
    accuracy: number;
    relevance: number;
    coherence: number;
    safety: number;
    userSatisfaction: number;
}

export interface ReliabilityMetrics {
    uptime: number;
    errorRate: number;
    latency: number;
    throughput: number;
}

export class OperationalAnalyticsService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Record usage metrics
     */
    async recordUsageMetrics(
        tenantId: string | undefined,
        metrics: Partial<UsageMetrics>,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        const date = new Date();
        date.setHours(0, 0, 0, 0); // Start of day

        await this.prisma.operationalMetrics.upsert({
            where: {
                tenantId_date_metricType_metricName: {
                    tenantId: tenantId || '',
                    date,
                    metricType: 'usage',
                    metricName: 'combined'
                }
            },
            update: {
                value: {
                    increment: metrics.requests || 0
                },
                metadata: {
                    ...metadata,
                    tokensUsed: { increment: metrics.tokensUsed || 0 },
                    cost: { increment: metrics.cost || 0 },
                    responseTime: metrics.responseTime,
                    successRate: metrics.successRate
                }
            },
            create: {
                tenantId,
                date,
                metricType: 'usage',
                metricName: 'combined',
                value: metrics.requests || 0,
                metadata: {
                    ...metadata,
                    tokensUsed: metrics.tokensUsed || 0,
                    cost: metrics.cost || 0,
                    responseTime: metrics.responseTime,
                    successRate: metrics.successRate
                }
            }
        });
    }

    /**
     * Record quality metrics
     */
    async recordQualityMetrics(
        tenantId: string | undefined,
        metrics: Partial<QualityMetrics>,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        const date = new Date();
        date.setHours(0, 0, 0, 0);

        const qualityScore = this.calculateOverallQuality(metrics);

        await this.prisma.operationalMetrics.upsert({
            where: {
                tenantId_date_metricType_metricName: {
                    tenantId: tenantId || '',
                    date,
                    metricType: 'quality',
                    metricName: 'overall'
                }
            },
            update: {
                value: qualityScore,
                metadata: {
                    ...metadata,
                    ...metrics
                }
            },
            create: {
                tenantId,
                date,
                metricType: 'quality',
                metricName: 'overall',
                value: qualityScore,
                metadata: {
                    ...metadata,
                    ...metrics
                }
            }
        });
    }

    /**
     * Record reliability metrics
     */
    async recordReliabilityMetrics(
        tenantId: string | undefined,
        metrics: Partial<ReliabilityMetrics>,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        const date = new Date();
        date.setHours(0, 0, 0, 0);

        await this.prisma.operationalMetrics.upsert({
            where: {
                tenantId_date_metricType_metricName: {
                    tenantId: tenantId || '',
                    date,
                    metricType: 'reliability',
                    metricName: 'uptime'
                }
            },
            update: {
                value: metrics.uptime || 0,
                metadata: {
                    ...metadata,
                    ...metrics
                }
            },
            create: {
                tenantId,
                date,
                metricType: 'reliability',
                metricName: 'uptime',
                value: metrics.uptime || 0,
                metadata: {
                    ...metadata,
                    ...metrics
                }
            }
        });
    }

    /**
     * Get usage analytics for a date range
     */
    async getUsageAnalytics(
        tenantId?: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<{
        totalRequests: number;
        totalTokens: number;
        totalCost: number;
        avgResponseTime: number;
        successRate: number;
        dailyBreakdown: Array<{
            date: Date;
            requests: number;
            tokens: number;
            cost: number;
        }>;
    }> {
        const where: {
            metricType: string;
            tenantId?: string;
            date?: { gte?: Date; lte?: Date };
        } = {
            metricType: 'usage'
        };

        if (tenantId) where.tenantId = tenantId;
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = startDate;
            if (endDate) where.date.lte = endDate;
        }

        const metrics = await this.prisma.operationalMetrics.findMany({
            where,
            orderBy: { date: 'asc' }
        });

        let totalRequests = 0;
        let totalTokens = 0;
        let totalCost = 0;
        let totalResponseTime = 0;
        let successCount = 0;
        let totalCount = 0;

        const dailyBreakdown: Array<{
            date: Date;
            requests: number;
            tokens: number;
            cost: number;
        }> = [];

        for (const metric of metrics) {
            const metadata = metric.metadata as Record<string, unknown>;
            const requests = metric.value;
            const tokens = typeof metadata?.tokensUsed === 'number' ? metadata.tokensUsed : 0;
            const cost = typeof metadata?.cost === 'number' ? metadata.cost : 0;
            const responseTime = typeof metadata?.responseTime === 'number' ? metadata.responseTime : 0;
            const successRate = typeof metadata?.successRate === 'number' ? metadata.successRate : 0;

            totalRequests += requests;
            totalTokens += tokens;
            totalCost += cost;
            totalResponseTime += responseTime * requests; // Weighted average
            successCount += successRate * requests;
            totalCount += requests;

            dailyBreakdown.push({
                date: metric.date,
                requests,
                tokens,
                cost
            });
        }

        return {
            totalRequests,
            totalTokens,
            totalCost,
            avgResponseTime: totalCount > 0 ? totalResponseTime / totalCount : 0,
            successRate: totalCount > 0 ? successCount / totalCount : 0,
            dailyBreakdown
        };
    }

    /**
     * Get quality analytics
     */
    async getQualityAnalytics(
        tenantId?: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<{
        overallScore: number;
        accuracy: number;
        relevance: number;
        coherence: number;
        safety: number;
        userSatisfaction: number;
        trend: Array<{ date: Date; score: number }>;
    }> {
        const where: {
            metricType: string;
            tenantId?: string;
            date?: { gte?: Date; lte?: Date };
        } = {
            metricType: 'quality'
        };

        if (tenantId) where.tenantId = tenantId;
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = startDate;
            if (endDate) where.date.lte = endDate;
        }

        const metrics = await this.prisma.operationalMetrics.findMany({
            where,
            orderBy: { date: 'asc' }
        });

        let totalAccuracy = 0;
        let totalRelevance = 0;
        let totalCoherence = 0;
        let totalSafety = 0;
        let totalSatisfaction = 0;
        let count = 0;

        const trend: Array<{ date: Date; score: number }> = [];

        for (const metric of metrics) {
            const metadata = metric.metadata as Record<string, unknown>;
            totalAccuracy += typeof metadata?.accuracy === 'number' ? metadata.accuracy : 0;
            totalRelevance += typeof metadata?.relevance === 'number' ? metadata.relevance : 0;
            totalCoherence += typeof metadata?.coherence === 'number' ? metadata.coherence : 0;
            totalSafety += typeof metadata?.safety === 'number' ? metadata.safety : 0;
            totalSatisfaction += typeof metadata?.userSatisfaction === 'number' ? metadata.userSatisfaction : 0;
            count++;

            trend.push({
                date: metric.date,
                score: metric.value
            });
        }

        const avgMetrics = count > 0 ? {
            accuracy: totalAccuracy / count,
            relevance: totalRelevance / count,
            coherence: totalCoherence / count,
            safety: totalSafety / count,
            userSatisfaction: totalSatisfaction / count
        } : {
            accuracy: 0,
            relevance: 0,
            coherence: 0,
            safety: 0,
            userSatisfaction: 0
        };

        return {
            overallScore: this.calculateOverallQuality(avgMetrics),
            ...avgMetrics,
            trend
        };
    }

    /**
     * Get reliability analytics
     */
    async getReliabilityAnalytics(
        tenantId?: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<{
        uptime: number;
        errorRate: number;
        avgLatency: number;
        throughput: number;
    }> {
        const where: {
            metricType: string;
            tenantId?: string;
            date?: { gte?: Date; lte?: Date };
        } = {
            metricType: 'reliability'
        };

        if (tenantId) where.tenantId = tenantId;
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = startDate;
            if (endDate) where.date.lte = endDate;
        }

        const metrics = await this.prisma.operationalMetrics.findMany({
            where
        });

        let totalUptime = 0;
        let totalErrorRate = 0;
        let totalLatency = 0;
        let totalThroughput = 0;
        let count = 0;

        for (const metric of metrics) {
            const metadata = metric.metadata as Record<string, unknown>;
            totalUptime += metric.value; // uptime percentage
            totalErrorRate += typeof metadata?.errorRate === 'number' ? metadata.errorRate : 0;
            totalLatency += typeof metadata?.latency === 'number' ? metadata.latency : 0;
            totalThroughput += typeof metadata?.throughput === 'number' ? metadata.throughput : 0;
            count++;
        }

        return count > 0 ? {
            uptime: totalUptime / count,
            errorRate: totalErrorRate / count,
            avgLatency: totalLatency / count,
            throughput: totalThroughput / count
        } : {
            uptime: 0,
            errorRate: 0,
            avgLatency: 0,
            throughput: 0
        };
    }

    /**
     * Calculate overall quality score
     */
    private calculateOverallQuality(metrics: Partial<QualityMetrics>): number {
        const weights = {
            accuracy: 0.25,
            relevance: 0.25,
            coherence: 0.2,
            safety: 0.2,
            userSatisfaction: 0.1
        };

        let totalScore = 0;
        let totalWeight = 0;

        if (metrics.accuracy !== undefined) {
            totalScore += metrics.accuracy * weights.accuracy;
            totalWeight += weights.accuracy;
        }
        if (metrics.relevance !== undefined) {
            totalScore += metrics.relevance * weights.relevance;
            totalWeight += weights.relevance;
        }
        if (metrics.coherence !== undefined) {
            totalScore += metrics.coherence * weights.coherence;
            totalWeight += weights.coherence;
        }
        if (metrics.safety !== undefined) {
            totalScore += metrics.safety * weights.safety;
            totalWeight += weights.safety;
        }
        if (metrics.userSatisfaction !== undefined) {
            totalScore += metrics.userSatisfaction * weights.userSatisfaction;
            totalWeight += weights.userSatisfaction;
        }

        return totalWeight > 0 ? totalScore / totalWeight : 0;
    }

    /**
     * Generate comprehensive analytics report
     */
    async generateAnalyticsReport(
        tenantId?: string,
        days: number = 30
    ): Promise<{
        period: { start: Date; end: Date };
        usage: Awaited<ReturnType<OperationalAnalyticsService['getUsageAnalytics']>>;
        quality: Awaited<ReturnType<OperationalAnalyticsService['getQualityAnalytics']>>;
        reliability: Awaited<ReturnType<OperationalAnalyticsService['getReliabilityAnalytics']>>;
    }> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [usage, quality, reliability] = await Promise.all([
            this.getUsageAnalytics(tenantId, startDate, endDate),
            this.getQualityAnalytics(tenantId, startDate, endDate),
            this.getReliabilityAnalytics(tenantId, startDate, endDate)
        ]);

        return {
            period: { start: startDate, end: endDate },
            usage,
            quality,
            reliability
        };
    }
}