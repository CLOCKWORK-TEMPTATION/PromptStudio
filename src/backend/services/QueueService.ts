import { Redis } from 'ioredis';

export interface QueueMessage {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    priority?: number;
    tenantId?: string;
    retryCount?: number;
    maxRetries?: number;
    delayUntil?: Date;
    createdAt: Date;
}

export interface QueueConfig {
    name: string;
    maxConcurrency?: number;
    retryAttempts?: number;
    timeout?: number;
    deadLetterQueue?: string;
}

export class QueueService {
    private redis: Redis;
    private queues: Map<string, QueueConfig> = new Map();

    constructor(redisUrl?: string) {
        this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');

        // Handle connection events
        this.redis.on('connect', () => console.log('QueueService: Connected to Redis'));
        this.redis.on('error', (err) => console.error('QueueService: Redis error:', err));
    }

    /**
     * Register a queue with configuration
     */
    registerQueue(config: QueueConfig): void {
        this.queues.set(config.name, {
            maxConcurrency: 5,
            retryAttempts: 3,
            timeout: 30000,
            ...config
        });
    }

    /**
     * Add message to queue
     */
    async enqueue(queueName: string, message: Omit<QueueMessage, 'id' | 'createdAt'>): Promise<string> {
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const fullMessage: QueueMessage = {
            id: messageId,
            createdAt: new Date(),
            retryCount: 0,
            maxRetries: 3,
            ...message
        };

        const queueKey = `queue:${queueName}`;
        const messageKey = `message:${messageId}`;

        // Store message data
        await this.redis.setex(messageKey, 86400, JSON.stringify(fullMessage)); // 24 hours TTL

        // Add to queue with priority support
        const priority = message.priority || 0;
        const score = message.delayUntil ? message.delayUntil.getTime() : Date.now();

        if (message.delayUntil) {
            // Delayed message - use sorted set with timestamp
            await this.redis.zadd(`delayed:${queueName}`, score, messageId);
        } else {
            // Regular message - use sorted set with priority
            await this.redis.zadd(queueKey, priority, messageId);
        }

        return messageId;
    }

    /**
     * Dequeue message from queue
     */
    async dequeue(queueName: string): Promise<QueueMessage | null> {
        const queueKey = `queue:${queueName}`;
        const processingKey = `processing:${queueName}`;

        // Check for delayed messages that are now ready
        await this.moveDelayedMessages(queueName);

        // Get next message
        const result = await this.redis.zpopmin(queueKey, 1);
        if (!result || result.length === 0) {
            return null;
        }

        const [, messageId] = result;
        const messageKey = `message:${messageId}`;

        const messageData = await this.redis.get(messageKey);
        if (!messageData) {
            return null; // Message expired or doesn't exist
        }

        const message: QueueMessage = JSON.parse(messageData);

        // Move to processing queue
        await this.redis.zadd(processingKey, Date.now() + (this.queues.get(queueName)?.timeout || 30000), messageId);

        return message;
    }

    /**
     * Mark message as completed
     */
    async complete(queueName: string, messageId: string): Promise<void> {
        const processingKey = `processing:${queueName}`;
        const messageKey = `message:${messageId}`;

        await Promise.all([
            this.redis.zrem(processingKey, messageId),
            this.redis.del(messageKey)
        ]);
    }

    /**
     * Mark message as failed and retry or move to dead letter queue
     */
    async fail(queueName: string, messageId: string, error?: string): Promise<void> {
        const processingKey = `processing:${queueName}`;
        const messageKey = `message:${messageId}`;

        const messageData = await this.redis.get(messageKey);
        if (!messageData) return;

        const message: QueueMessage = JSON.parse(messageData);
        message.retryCount = (message.retryCount || 0) + 1;

        const maxRetries = message.maxRetries || this.queues.get(queueName)?.retryAttempts || 3;

        if (message.retryCount < maxRetries) {
            // Retry - add back to queue with lower priority
            const queueKey = `queue:${queueName}`;
            await this.redis.zadd(queueKey, -1, messageId); // Lower priority for retries

            // Update message data
            await this.redis.setex(messageKey, 86400, JSON.stringify(message));
        } else {
            // Move to dead letter queue
            const dlqName = this.queues.get(queueName)?.deadLetterQueue || `${queueName}_dlq`;
            const dlqKey = `queue:${dlqName}`;

            await this.redis.zadd(dlqKey, Date.now(), messageId);

            // Add error information
            message.payload.error = error;
            message.payload.failedAt = new Date().toISOString();
            await this.redis.setex(messageKey, 86400 * 7, JSON.stringify(message)); // Keep failed messages longer
        }

        // Remove from processing
        await this.redis.zrem(processingKey, messageId);
    }

    /**
     * Get queue statistics
     */
    async getQueueStats(queueName: string): Promise<{
        pending: number;
        processing: number;
        delayed: number;
        deadLetter: number;
    }> {
        const [pending, processing, delayed, deadLetter] = await Promise.all([
            this.redis.zcard(`queue:${queueName}`),
            this.redis.zcard(`processing:${queueName}`),
            this.redis.zcard(`delayed:${queueName}`),
            this.redis.zcard(`queue:${queueName}_dlq`)
        ]);

        return { pending, processing, delayed, deadLetter };
    }

    /**
     * Move delayed messages that are ready to main queue
     */
    private async moveDelayedMessages(queueName: string): Promise<void> {
        const delayedKey = `delayed:${queueName}`;
        const queueKey = `queue:${queueName}`;

        const now = Date.now();

        // Get messages that are ready (score <= now)
        const readyMessages = await this.redis.zrangebyscore(delayedKey, '-inf', now, 'WITHSCORES', 'LIMIT', 0, 100);

        if (readyMessages.length === 0) return;

        const pipeline = this.redis.pipeline();

        for (let i = 0; i < readyMessages.length; i += 2) {
            const messageId = readyMessages[i];
            pipeline.zrem(delayedKey, messageId);
            pipeline.zadd(queueKey, 0, messageId); // Add to main queue with normal priority
        }

        await pipeline.exec();
    }

    /**
     * Process dead letter queue messages
     */
    async replayDeadLetterQueue(queueName: string, limit: number = 10): Promise<string[]> {
        const dlqKey = `queue:${queueName}_dlq`;
        const queueKey = `queue:${queueName}`;

        const messages = await this.redis.zpopmin(dlqKey, limit);

        if (messages.length === 0) return [];

        const replayedIds: string[] = [];

        for (let i = 0; i < messages.length; i += 2) {
            const messageId = messages[i];
            await this.redis.zadd(queueKey, -2, messageId); // Very low priority for replayed messages
            replayedIds.push(messageId);
        }

        return replayedIds;
    }

    /**
     * Clean up expired processing messages (failed to complete within timeout)
     */
    async cleanupStaleMessages(queueName: string): Promise<number> {
        const processingKey = `processing:${queueName}`;
        const queueKey = `queue:${queueName}`;

        const now = Date.now();
        const staleMessages = await this.redis.zrangebyscore(processingKey, '-inf', now, 'WITHSCORES');

        if (staleMessages.length === 0) return 0;

        const pipeline = this.redis.pipeline();

        for (let i = 0; i < staleMessages.length; i += 2) {
            const messageId = staleMessages[i];
            pipeline.zrem(processingKey, messageId);
            pipeline.zadd(queueKey, -1, messageId); // Re-queue with lower priority
        }

        await pipeline.exec();

        return staleMessages.length / 2;
    }

    /**
     * Close Redis connection
     */
    async close(): Promise<void> {
        await this.redis.quit();
    }
}