import { Redis } from 'ioredis';
import crypto from 'crypto';

export interface ShadowTest {
    id: string;
    name: string;
    description?: string;
    sourceVersion: string;
    shadowVersion: string;
    trafficPercentage: number;
    testDuration: number; // in milliseconds
    metrics: string[]; // metrics to compare
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: Date;
    endTime?: Date;
    results?: ShadowTestResults;
    tenantId?: string;
}

export interface ShadowTestResults {
    totalRequests: number;
    shadowRequests: number;
    successRate: {
        source: number;
        shadow: number;
    };
    responseTime: {
        source: {
            avg: number;
            p50: number;
            p95: number;
            p99: number;
        };
        shadow: {
            avg: number;
            p50: number;
            p95: number;
            p99: number;
        };
    };
    errorRate: {
        source: number;
        shadow: number;
    };
    customMetrics: Record<string, {
        source: number;
        shadow: number;
        difference: number;
    }>;
    recommendations: string[];
}

export interface RequestContext {
    id: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: string;
    userId?: string;
    tenantId?: string;
    timestamp: Date;
}

export class ShadowDeploymentService {
    private redis: Redis;
    private activeTests: Map<string, ShadowTest> = new Map();

    constructor(redisUrl?: string) {
        this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    }

    /**
     * Create a new shadow test
     */
    async createShadowTest(test: Omit<ShadowTest, 'id' | 'status'>): Promise<string> {
        const testId = `shadow_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        const shadowTest: ShadowTest = {
            id: testId,
            ...test,
            status: 'pending'
        };

        // Store test configuration
        await this.redis.setex(
            `shadow:test:${testId}`,
            86400 * 30, // 30 days
            JSON.stringify(shadowTest)
        );

        // Add to active tests if traffic percentage > 0
        if (test.trafficPercentage > 0) {
            this.activeTests.set(testId, shadowTest);
        }

        return testId;
    }

    /**
     * Start a shadow test
     */
    async startShadowTest(testId: string): Promise<void> {
        const testData = await this.redis.get(`shadow:test:${testId}`);
        if (!testData) {
            throw new Error(`Shadow test ${testId} not found`);
        }

        const test: ShadowTest = JSON.parse(testData);
        test.status = 'running';
        test.startTime = new Date();

        await this.redis.setex(
            `shadow:test:${testId}`,
            86400 * 30,
            JSON.stringify(test)
        );

        this.activeTests.set(testId, test);

        // Schedule test end
        setTimeout(() => {
            this.endShadowTest(testId);
        }, test.testDuration);
    }

    /**
     * End a shadow test
     */
    async endShadowTest(testId: string): Promise<ShadowTestResults> {
        const test = this.activeTests.get(testId);
        if (!test) {
            throw new Error(`Shadow test ${testId} not found`);
        }

        test.status = 'completed';
        test.endTime = new Date();

        // Collect results
        const results = await this.collectTestResults(testId);

        test.results = results;

        // Store final results
        await this.redis.setex(
            `shadow:test:${testId}`,
            86400 * 30,
            JSON.stringify(test)
        );

        // Remove from active tests
        this.activeTests.delete(testId);

        return results;
    }

    /**
     * Process incoming request for shadow testing
     */
    async processRequest(context: RequestContext): Promise<{
        shouldShadow: boolean;
        shadowTestId?: string;
    }> {
        // Check if request should be shadowed
        for (const [testId, test] of this.activeTests) {
            if (test.status === 'running' && this.shouldShadowRequest(context, test)) {
                // Record the request for both source and shadow
                await this.recordRequest(testId, context, 'source');

                return {
                    shouldShadow: true,
                    shadowTestId: testId
                };
            }
        }

        return { shouldShadow: false };
    }

    /**
     * Record response from source or shadow deployment
     */
    async recordResponse(
        testId: string,
        requestId: string,
        deployment: 'source' | 'shadow',
        response: {
            statusCode: number;
            responseTime: number;
            success: boolean;
            error?: string;
            customMetrics?: Record<string, number>;
        }
    ): Promise<void> {
        const key = `shadow:response:${testId}:${requestId}:${deployment}`;

        await this.redis.setex(key, 3600, JSON.stringify({
            ...response,
            timestamp: new Date()
        }));

        // Update real-time metrics
        await this.updateRealtimeMetrics(testId, deployment, response);
    }

    /**
     * Get shadow test results
     */
    async getTestResults(testId: string): Promise<ShadowTestResults | null> {
        const testData = await this.redis.get(`shadow:test:${testId}`);
        if (!testData) return null;

        const test: ShadowTest = JSON.parse(testData);
        return test.results || null;
    }

    /**
     * Get active shadow tests
     */
    async getActiveTests(tenantId?: string): Promise<ShadowTest[]> {
        const tests: ShadowTest[] = [];

        for (const test of this.activeTests.values()) {
            if (!tenantId || test.tenantId === tenantId) {
                tests.push(test);
            }
        }

        return tests;
    }

    /**
     * Determine if request should be shadowed based on traffic percentage
     */
    private shouldShadowRequest(context: RequestContext, test: ShadowTest): boolean {
        // Use consistent hashing based on request ID for deterministic shadowing
        const hash = crypto.createHash('md5').update(context.id).digest('hex');
        const hashValue = parseInt(hash.substring(0, 8), 16);
        const percentage = (hashValue % 100) / 100;

        return percentage < (test.trafficPercentage / 100);
    }

    /**
     * Record request for analysis
     */
    private async recordRequest(
        testId: string,
        context: RequestContext,
        type: 'source' | 'shadow'
    ): Promise<void> {
        const key = `shadow:request:${testId}:${context.id}:${type}`;

        await this.redis.setex(key, 3600, JSON.stringify({
            ...context,
            recordedAt: new Date()
        }));
    }

    /**
     * Update real-time metrics for a test
     */
    private async updateRealtimeMetrics(
        testId: string,
        deployment: 'source' | 'shadow',
        response: {
            statusCode: number;
            responseTime: number;
            success: boolean;
            customMetrics?: Record<string, number>;
        }
    ): Promise<void> {
        const metricsKey = `shadow:metrics:${testId}:${deployment}`;

        // Use Redis transactions for atomic updates
        const pipeline = this.redis.pipeline();

        // Increment counters
        pipeline.hincrby(metricsKey, 'total_requests', 1);
        if (response.success) {
            pipeline.hincrby(metricsKey, 'successful_requests', 1);
        } else {
            pipeline.hincrby(metricsKey, 'failed_requests', 1);
        }

        // Update response time statistics
        pipeline.hget(metricsKey, 'response_times');
        pipeline.hget(metricsKey, 'response_time_count');

        const result = await pipeline.exec();

        if (result) {
            const [, responseTimesData] = result[result.length - 2] as [Error, string];
            const [, countData] = result[result.length - 1] as [Error, string];

            let responseTimes: number[] = [];
            let count = 0;

            if (responseTimesData) {
                responseTimes = JSON.parse(responseTimesData);
            }
            if (countData) {
                count = parseInt(countData);
            }

            // Keep only last 1000 response times for memory efficiency
            responseTimes.push(response.responseTime);
            if (responseTimes.length > 1000) {
                responseTimes = responseTimes.slice(-1000);
            }

            await this.redis.pipeline()
                .hset(metricsKey, 'response_times', JSON.stringify(responseTimes))
                .hset(metricsKey, 'response_time_count', count + 1)
                .pexpire(metricsKey, 86400000) // 24 hours
                .exec();
        }
    }

    /**
     * Collect final test results
     */
    private async collectTestResults(testId: string): Promise<ShadowTestResults> {
        const sourceMetrics = await this.getMetricsForDeployment(testId, 'source');
        const shadowMetrics = await this.getMetricsForDeployment(testId, 'shadow');

        const totalRequests = sourceMetrics.totalRequests;
        const shadowRequests = shadowMetrics.totalRequests;

        // Calculate percentiles
        const sourcePercentiles = this.calculatePercentiles(sourceMetrics.responseTimes);
        const shadowPercentiles = this.calculatePercentiles(shadowMetrics.responseTimes);

        // Generate recommendations
        const recommendations = this.generateRecommendations(sourceMetrics, shadowMetrics);

        return {
            totalRequests,
            shadowRequests,
            successRate: {
                source: sourceMetrics.successRate,
                shadow: shadowMetrics.successRate
            },
            responseTime: {
                source: {
                    avg: sourceMetrics.avgResponseTime,
                    ...sourcePercentiles
                },
                shadow: {
                    avg: shadowMetrics.avgResponseTime,
                    ...shadowPercentiles
                }
            },
            errorRate: {
                source: sourceMetrics.errorRate,
                shadow: shadowMetrics.errorRate
            },
            customMetrics: {}, // Would be populated based on test configuration
            recommendations
        };
    }

    /**
     * Get metrics for a specific deployment
     */
    private async getMetricsForDeployment(testId: string, deployment: 'source' | 'shadow'): Promise<{
        totalRequests: number;
        successRate: number;
        errorRate: number;
        avgResponseTime: number;
        responseTimes: number[];
    }> {
        const metricsKey = `shadow:metrics:${testId}:${deployment}`;
        const metrics = await this.redis.hgetall(metricsKey);

        const totalRequests = parseInt(metrics.total_requests || '0');
        const successfulRequests = parseInt(metrics.successful_requests || '0');
        const failedRequests = parseInt(metrics.failed_requests || '0');

        const responseTimes: number[] = metrics.response_times ? JSON.parse(metrics.response_times) : [];
        const avgResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0;

        return {
            totalRequests,
            successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
            errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
            avgResponseTime,
            responseTimes
        };
    }

    /**
     * Calculate response time percentiles
     */
    private calculatePercentiles(responseTimes: number[]): { p50: number; p95: number; p99: number } {
        if (responseTimes.length === 0) {
            return { p50: 0, p95: 0, p99: 0 };
        }

        const sorted = responseTimes.sort((a, b) => a - b);

        return {
            p50: sorted[Math.floor(sorted.length * 0.5)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)]
        };
    }

    /**
     * Generate recommendations based on test results
     */
    private generateRecommendations(
        source: { successRate: number; errorRate: number; avgResponseTime: number },
        shadow: { successRate: number; errorRate: number; avgResponseTime: number }
    ): string[] {
        const recommendations: string[] = [];

        const successRateDiff = shadow.successRate - source.successRate;
        const errorRateDiff = shadow.errorRate - source.errorRate;
        const responseTimeDiff = ((shadow.avgResponseTime - source.avgResponseTime) / source.avgResponseTime) * 100;

        if (successRateDiff > 5) {
            recommendations.push(`Shadow deployment shows ${successRateDiff.toFixed(1)}% higher success rate. Consider promoting.`);
        } else if (successRateDiff < -5) {
            recommendations.push(`Shadow deployment has ${Math.abs(successRateDiff).toFixed(1)}% lower success rate. Investigate issues.`);
        }

        if (errorRateDiff < -2) {
            recommendations.push(`Shadow deployment reduces error rate by ${Math.abs(errorRateDiff).toFixed(1)}%. Good improvement.`);
        } else if (errorRateDiff > 2) {
            recommendations.push(`Shadow deployment increases error rate by ${errorRateDiff.toFixed(1)}%. Needs investigation.`);
        }

        if (responseTimeDiff < -10) {
            recommendations.push(`Shadow deployment is ${Math.abs(responseTimeDiff).toFixed(1)}% faster. Performance improvement detected.`);
        } else if (responseTimeDiff > 10) {
            recommendations.push(`Shadow deployment is ${responseTimeDiff.toFixed(1)}% slower. Performance regression detected.`);
        }

        if (recommendations.length === 0) {
            recommendations.push('No significant differences detected between source and shadow deployments.');
        }

        return recommendations;
    }

    /**
     * Clean up old test data
     */
    async cleanupOldTests(daysToKeep: number = 30): Promise<number> {
        const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        let cleanedCount = 0;

        // Get all test keys
        const testKeys = await this.redis.keys('shadow:test:*');

        for (const key of testKeys) {
            const testData = await this.redis.get(key);
            if (testData) {
                const test: ShadowTest = JSON.parse(testData);
                if (test.endTime && test.endTime.getTime() < cutoffTime) {
                    // Clean up test and related data
                    const testId = key.replace('shadow:test:', '');
                    await this.cleanupTestData(testId);
                    cleanedCount++;
                }
            }
        }

        return cleanedCount;
    }

    /**
     * Clean up test data
     */
    private async cleanupTestData(testId: string): Promise<void> {
        const keys = await this.redis.keys(`shadow:*${testId}*`);
        if (keys.length > 0) {
            await this.redis.del(...keys);
        }
    }

    /**
     * Close Redis connection
     */
    async close(): Promise<void> {
        await this.redis.quit();
    }
}