/**
 * Cost-Aware Orchestrator with Semantic Cache Balancing
 * Optimizes resource allocation and cost efficiency across multi-agent workflows
 */

import { LLMServiceAdapter } from '../LLMServiceAdapter';
import { SemanticCacheService } from '../SemanticCacheService';
import { logger } from '../../lib/logger';
import { z } from 'zod';

// Cost tracking schemas
const CostMetricsSchema = z.object({
    totalTokens: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalCost: z.number(),
    cacheHits: z.number(),
    cacheMisses: z.number(),
    costSavings: z.number()
});

const ResourceLimitsSchema = z.object({
    maxTokensPerHour: z.number().default(100000),
    maxCostPerHour: z.number().default(10.0),
    maxConcurrentRequests: z.number().default(10),
    cacheHitRateThreshold: z.number().min(0).max(1).default(0.7)
});

const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

const TaskRequestSchema = z.object({
    id: z.string(),
    priority: TaskPrioritySchema,
    estimatedTokens: z.number(),
    maxTokens: z.number(),
    model: z.string(),
    cacheKey: z.string().optional(),
    metadata: z.record(z.any()).optional()
});

type CostMetrics = z.infer<typeof CostMetricsSchema>;
type ResourceLimits = z.infer<typeof ResourceLimitsSchema>;
type TaskPriority = z.infer<typeof TaskPrioritySchema>;
type TaskRequest = z.infer<typeof TaskRequestSchema>;

interface QueuedTask extends TaskRequest {
    queuedAt: Date;
    estimatedCost: number;
    retryCount: number;
}

export class CostAwareOrchestrator {
    private llmService: LLMServiceAdapter;
    private cacheService: SemanticCacheService;
    private resourceLimits: ResourceLimits;
    private currentMetrics: CostMetrics;
    private taskQueue: QueuedTask[] = [];
    private activeRequests: Set<string> = new Set();
    private hourlyResetTimer: NodeJS.Timeout;
    
    // Model pricing (tokens per dollar)
    private readonly modelPricing: Record<string, { input: number; output: number }> = {
        'gpt-4-turbo': { input: 0.01, output: 0.03 },
        'gpt-4': { input: 0.03, output: 0.06 },
        'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
        'claude-3-opus': { input: 0.015, output: 0.075 },
        'claude-3-sonnet': { input: 0.003, output: 0.015 }
    };

    constructor(
        llmService: LLMServiceAdapter,
        cacheService: SemanticCacheService,
        limits: Partial<ResourceLimits> = {}
    ) {
        this.llmService = llmService;
        this.cacheService = cacheService;
        this.resourceLimits = ResourceLimitsSchema.parse(limits);
        this.currentMetrics = {
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalCost: 0,
            cacheHits: 0,
            cacheMisses: 0,
            costSavings: 0
        };
        
        // Reset metrics every hour
        this.hourlyResetTimer = setInterval(() => {
            this.resetHourlyMetrics();
        }, 3600000);
        
        // Start task processing loop
        this.processTaskQueue();
    }

    /**
     * Submit task for cost-aware execution
     */
    async submitTask(request: TaskRequest): Promise<{
        taskId: string;
        queuePosition: number;
        estimatedWaitTime: number;
        estimatedCost: number;
    }> {
        const validatedRequest = TaskRequestSchema.parse(request);
        const estimatedCost = this.calculateEstimatedCost(validatedRequest);
        
        // Check if task would exceed limits
        if (this.wouldExceedLimits(validatedRequest, estimatedCost)) {
            throw new Error(`Task would exceed resource limits: tokens=${validatedRequest.estimatedTokens}, cost=${estimatedCost}`);
        }
        
        const queuedTask: QueuedTask = {
            ...validatedRequest,
            queuedAt: new Date(),
            estimatedCost,
            retryCount: 0
        };
        
        // Insert task based on priority
        this.insertTaskByPriority(queuedTask);
        
        const queuePosition = this.taskQueue.findIndex(t => t.id === request.id);
        const estimatedWaitTime = this.calculateWaitTime(queuePosition);
        
        logger.info(`[CostAwareOrchestrator] Queued task ${request.id} at position ${queuePosition} (priority: ${request.priority})`);
        
        return {
            taskId: request.id,
            queuePosition,
            estimatedWaitTime,
            estimatedCost
        };
    }

    /**
     * Execute task with cost optimization
     */
    private async executeTask(task: QueuedTask): Promise<any> {
        this.activeRequests.add(task.id);
        
        try {
            // Check cache first
            let result = null;
            if (task.cacheKey) {
                const cacheResult = await this.cacheService.lookup({
                    prompt: task.cacheKey,
                    model: task.model
                });
                if (cacheResult.hit && cacheResult.entry) {
                    this.currentMetrics.cacheHits++;
                    this.currentMetrics.costSavings += task.estimatedCost;
                    logger.info(`[CostAwareOrchestrator] Cache hit for task ${task.id}, saved $${task.estimatedCost.toFixed(4)}`);
                    return cacheResult.entry.response;
                }
                this.currentMetrics.cacheMisses++;
            }
            
            // Execute with LLM
            const startTime = Date.now();
            const response = await LLMServiceAdapter.executeTreeOfThought(
                'Execute task',
                { maxDepth: 1, branchingFactor: 1 }
            );
            
            const executionTime = Date.now() - startTime;
            
            // Calculate actual cost
            const actualCost = this.calculateActualCost(task.model, {
                inputTokens: task.estimatedTokens * 0.7,
                outputTokens: task.estimatedTokens * 0.3
            });
            
            // Update metrics
            this.updateMetrics({
                inputTokens: task.estimatedTokens * 0.7,
                outputTokens: task.estimatedTokens * 0.3,
                totalTokens: task.estimatedTokens
            }, actualCost);
            
            // Cache result if beneficial
            if (task.cacheKey && this.shouldCacheResult(task, actualCost)) {
                await this.cacheService.store({
                    prompt: task.cacheKey,
                    response: response.finalAnswer,
                    model: task.model,
                    ttlSeconds: this.calculateOptimalTTL(task),
                    tags: [`model:${task.model}`, `priority:${task.priority}`]
                });
            }
            
            logger.info(`[CostAwareOrchestrator] Completed task ${task.id} in ${executionTime}ms, cost: $${actualCost.toFixed(4)}`);
            
            return response.finalAnswer;
            
        } catch (error: any) {
            logger.error(`[CostAwareOrchestrator] Task ${task.id} failed: ${error.message}`);
            
            // Retry logic for high-priority tasks
            if (task.priority === 'critical' && task.retryCount < 3) {
                task.retryCount++;
                this.insertTaskByPriority(task);
                logger.info(`[CostAwareOrchestrator] Retrying critical task ${task.id} (attempt ${task.retryCount})`);
            }
            
            throw error;
        } finally {
            this.activeRequests.delete(task.id);
        }
    }

    /**
     * Process task queue with cost optimization
     */
    private async processTaskQueue(): Promise<void> {
        while (true) {
            try {
                // Check if we can process more tasks
                if (this.activeRequests.size >= this.resourceLimits.maxConcurrentRequests) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                
                // Get next task
                const task = this.taskQueue.shift();
                if (!task) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }
                
                // Check resource limits
                if (this.wouldExceedLimits(task, task.estimatedCost)) {
                    // Requeue task for later
                    this.taskQueue.unshift(task);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }
                
                // Execute task asynchronously
                this.executeTask(task).catch(error => {
                    logger.error(`[CostAwareOrchestrator] Task execution failed: ${error.message}`);
                });
                
            } catch (error: any) {
                logger.error(`[CostAwareOrchestrator] Queue processing error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    /**
     * Calculate estimated cost for a task
     */
    private calculateEstimatedCost(task: TaskRequest): number {
        const pricing = this.modelPricing[task.model];
        if (!pricing) return 0;
        
        const inputTokens = task.estimatedTokens * 0.7;
        const outputTokens = task.estimatedTokens * 0.3;
        
        return (inputTokens * pricing.input + outputTokens * pricing.output) / 1000;
    }

    /**
     * Calculate actual cost from usage
     */
    private calculateActualCost(model: string, usage: { inputTokens: number; outputTokens: number }): number {
        const pricing = this.modelPricing[model];
        if (!pricing) return 0;
        
        return (usage.inputTokens * pricing.input + usage.outputTokens * pricing.output) / 1000;
    }

    /**
     * Check if task would exceed resource limits
     */
    private wouldExceedLimits(task: TaskRequest, estimatedCost: number): boolean {
        return (
            this.currentMetrics.totalTokens + task.estimatedTokens > this.resourceLimits.maxTokensPerHour ||
            this.currentMetrics.totalCost + estimatedCost > this.resourceLimits.maxCostPerHour
        );
    }

    /**
     * Insert task in queue based on priority
     */
    private insertTaskByPriority(task: QueuedTask): void {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const taskPriority = priorityOrder[task.priority];
        
        let insertIndex = this.taskQueue.length;
        for (let i = 0; i < this.taskQueue.length; i++) {
            if (priorityOrder[this.taskQueue[i].priority] > taskPriority) {
                insertIndex = i;
                break;
            }
        }
        
        this.taskQueue.splice(insertIndex, 0, task);
    }

    /**
     * Calculate estimated wait time
     */
    private calculateWaitTime(queuePosition: number): number {
        const avgExecutionTime = 5000; // 5 seconds average
        const concurrentSlots = this.resourceLimits.maxConcurrentRequests;
        return Math.ceil(queuePosition / concurrentSlots) * avgExecutionTime;
    }

    /**
     * Determine if result should be cached
     */
    private shouldCacheResult(task: QueuedTask, actualCost: number): boolean {
        // Cache expensive results or high-priority tasks
        return actualCost > 0.01 || task.priority === 'high' || task.priority === 'critical';
    }

    /**
     * Calculate optimal TTL for cache entry
     */
    private calculateOptimalTTL(task: QueuedTask): number {
        const baseTTL = 3600; // 1 hour
        const priorityMultiplier = {
            low: 0.5,
            medium: 1,
            high: 2,
            critical: 4
        };
        
        return baseTTL * priorityMultiplier[task.priority];
    }

    /**
     * Update cost metrics
     */
    private updateMetrics(usage: { inputTokens: number; outputTokens: number; totalTokens: number }, cost: number): void {
        this.currentMetrics.inputTokens += usage.inputTokens;
        this.currentMetrics.outputTokens += usage.outputTokens;
        this.currentMetrics.totalTokens += usage.totalTokens;
        this.currentMetrics.totalCost += cost;
    }

    /**
     * Reset hourly metrics
     */
    private resetHourlyMetrics(): void {
        logger.info(`[CostAwareOrchestrator] Hourly metrics - Tokens: ${this.currentMetrics.totalTokens}, Cost: $${this.currentMetrics.totalCost.toFixed(4)}, Cache hit rate: ${(this.currentMetrics.cacheHits / (this.currentMetrics.cacheHits + this.currentMetrics.cacheMisses) * 100).toFixed(1)}%`);
        
        this.currentMetrics = {
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalCost: 0,
            cacheHits: 0,
            cacheMisses: 0,
            costSavings: 0
        };
    }

    /**
     * Get current metrics and queue status
     */
    getStatus(): {
        metrics: CostMetrics;
        queueLength: number;
        activeRequests: number;
        resourceUtilization: {
            tokenUsage: number;
            costUsage: number;
            concurrencyUsage: number;
        };
    } {
        return {
            metrics: { ...this.currentMetrics },
            queueLength: this.taskQueue.length,
            activeRequests: this.activeRequests.size,
            resourceUtilization: {
                tokenUsage: this.currentMetrics.totalTokens / this.resourceLimits.maxTokensPerHour,
                costUsage: this.currentMetrics.totalCost / this.resourceLimits.maxCostPerHour,
                concurrencyUsage: this.activeRequests.size / this.resourceLimits.maxConcurrentRequests
            }
        };
    }

    /**
     * Update resource limits
     */
    updateLimits(newLimits: Partial<ResourceLimits>): void {
        this.resourceLimits = { ...this.resourceLimits, ...newLimits };
        logger.info(`[CostAwareOrchestrator] Updated resource limits`);
    }

    /**
     * Cleanup and shutdown
     */
    shutdown(): void {
        if (this.hourlyResetTimer) {
            clearInterval(this.hourlyResetTimer);
        }
        logger.info(`[CostAwareOrchestrator] Shutdown completed`);
    }
}