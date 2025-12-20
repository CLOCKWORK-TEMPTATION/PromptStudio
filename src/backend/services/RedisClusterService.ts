import { Cluster } from 'ioredis';

export interface ClusterNode {
    host: string;
    port: number;
    password?: string;
}

export interface ClusterConfig {
    nodes: ClusterNode[];
    redisOptions?: {
        password?: string;
        db?: number;
        keyPrefix?: string;
        retryDelayOnFailover?: number;
        maxRetriesPerRequest?: number;
        lazyConnect?: boolean;
    };
    clusterOptions?: {
        enableOfflineQueue?: boolean;
        redisOptions?: Record<string, unknown>;
        clusterRetryDelay?: number;
    };
}

export class RedisClusterService {
    private cluster: Cluster;
    private isConnected: boolean = false;

    constructor(config: ClusterConfig) {
        this.cluster = new Cluster(config.nodes, {
            redisOptions: {
                password: config.redisOptions?.password,
                db: config.redisOptions?.db || 0,
                keyPrefix: config.redisOptions?.keyPrefix,
                retryDelayOnFailover: config.redisOptions?.retryDelayOnFailover || 100,
                maxRetriesPerRequest: config.redisOptions?.maxRetriesPerRequest || 3,
                lazyConnect: config.redisOptions?.lazyConnect || false,
            },
            clusterRetryDelay: config.clusterOptions?.clusterRetryDelay || 100,
            enableOfflineQueue: config.clusterOptions?.enableOfflineQueue ?? true,
            ...config.clusterOptions
        });

        this.setupEventHandlers();
    }

    /**
     * Setup cluster event handlers
     */
    private setupEventHandlers(): void {
        this.cluster.on('connect', () => {
            console.log('RedisClusterService: Connected to cluster');
            this.isConnected = true;
        });

        this.cluster.on('ready', () => {
            console.log('RedisClusterService: Cluster is ready');
        });

        this.cluster.on('error', (err) => {
            console.error('RedisClusterService: Cluster error:', err);
            this.isConnected = false;
        });

        this.cluster.on('close', () => {
            console.log('RedisClusterService: Connection closed');
            this.isConnected = false;
        });

        this.cluster.on('reconnecting', () => {
            console.log('RedisClusterService: Reconnecting to cluster...');
        });

        this.cluster.on('end', () => {
            console.log('RedisClusterService: Connection ended');
            this.isConnected = false;
        });

        // Node-specific events
        this.cluster.on('node error', (err, node) => {
            console.error(`RedisClusterService: Node error on ${node.options.host}:${node.options.port}:`, err);
        });

        this.cluster.on('node connect', (node) => {
            console.log(`RedisClusterService: Connected to node ${node.options.host}:${node.options.port}`);
        });
    }

    /**
     * Get cluster connection status
     */
    getStatus(): {
        isConnected: boolean;
        nodes: Array<{
            host: string;
            port: number;
            status: string;
        }>;
    } {
        const nodes = this.cluster.nodes().map(node => ({
            host: node.options.host || 'unknown',
            port: node.options.port || 6379,
            status: node.status
        }));

        return {
            isConnected: this.isConnected,
            nodes
        };
    }

    /**
     * Execute Redis command with automatic slot routing
     */
    async executeCommand(command: string, ...args: unknown[]): Promise<unknown> {
        try {
            return await this.cluster.call(command, ...(args as (string | number | Buffer)[]));
        } catch (error) {
            console.error(`RedisClusterService: Command failed: ${command}`, error);
            throw error;
        }
    }

    /**
     * Set key-value pair
     */
    async set(key: string, value: string, ttl?: number): Promise<void> {
        if (ttl) {
            await this.cluster.setex(key, ttl, value);
        } else {
            await this.cluster.set(key, value);
        }
    }

    /**
     * Get value by key
     */
    async get(key: string): Promise<string | null> {
        return await this.cluster.get(key);
    }

    /**
     * Delete key
     */
    async del(key: string): Promise<number> {
        return await this.cluster.del(key);
    }

    /**
     * Set multiple key-value pairs
     */
    async mset(keyValues: Record<string, string>): Promise<void> {
        const args: string[] = [];
        for (const [key, value] of Object.entries(keyValues)) {
            args.push(key, value);
        }
        await this.cluster.mset(...args);
    }

    /**
     * Get multiple values
     */
    async mget(keys: string[]): Promise<(string | null)[]> {
        return await this.cluster.mget(...keys);
    }

    /**
     * Check if key exists
     */
    async exists(key: string): Promise<number> {
        return await this.cluster.exists(key);
    }

    /**
     * Set expiration time for key
     */
    async expire(key: string, seconds: number): Promise<number> {
        return await this.cluster.expire(key, seconds);
    }

    /**
     * Get time to live for key
     */
    async ttl(key: string): Promise<number> {
        return await this.cluster.ttl(key);
    }

    /**
     * Increment numeric value
     */
    async incr(key: string): Promise<number> {
        return await this.cluster.incr(key);
    }

    /**
     * Increment by float value
     */
    async incrbyfloat(key: string, increment: number): Promise<string> {
        return await this.cluster.incrbyfloat(key, increment);
    }

    /**
     * Add to sorted set
     */
    async zadd(key: string, score: number, member: string): Promise<number> {
        return await this.cluster.zadd(key, score, member);
    }

    /**
     * Get range from sorted set
     */
    async zrange(key: string, start: number, stop: number): Promise<string[]> {
        return await this.cluster.zrange(key, start, stop);
    }

    /**
     * Get range by score from sorted set
     */
    async zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]> {
        return await this.cluster.zrangebyscore(key, min, max);
    }

    /**
     * Remove from sorted set
     */
    async zrem(key: string, member: string): Promise<number> {
        return await this.cluster.zrem(key, member);
    }

    /**
     * Get sorted set cardinality
     */
    async zcard(key: string): Promise<number> {
        return await this.cluster.zcard(key);
    }

    /**
     * Add to set
     */
    async sadd(key: string, member: string): Promise<number> {
        return await this.cluster.sadd(key, member);
    }

    /**
     * Get set members
     */
    async smembers(key: string): Promise<string[]> {
        return await this.cluster.smembers(key);
    }

    /**
     * Remove from set
     */
    async srem(key: string, member: string): Promise<number> {
        return await this.cluster.srem(key, member);
    }

    /**
     * Get set cardinality
     */
    async scard(key: string): Promise<number> {
        return await this.cluster.scard(key);
    }

    /**
     * Publish message to channel
     */
    async publish(channel: string, message: string): Promise<number> {
        return await this.cluster.publish(channel, message);
    }

    /**
     * Subscribe to channels (not recommended for cluster - use dedicated pub/sub instance)
     */
    async subscribe(channels: string[]): Promise<void> {
        console.warn('RedisClusterService: Subscribe is not recommended for Redis Cluster. Use dedicated pub/sub instance.');
        // This will only work if all channels hash to the same slot
        await this.cluster.subscribe(...channels);
    }

    /**
     * Push to list (left)
     */
    async lpush(key: string, values: string[]): Promise<number> {
        return await this.cluster.lpush(key, ...values);
    }

    /**
     * Pop from list (right)
     */
    async rpop(key: string): Promise<string | null> {
        return await this.cluster.rpop(key);
    }

    /**
     * Get list length
     */
    async llen(key: string): Promise<number> {
        return await this.cluster.llen(key);
    }

    /**
     * Get list range
     */
    async lrange(key: string, start: number, stop: number): Promise<string[]> {
        return await this.cluster.lrange(key, start, stop);
    }

    /**
     * Add to hash
     */
    async hset(key: string, field: string, value: string): Promise<number> {
        return await this.cluster.hset(key, field, value);
    }

    /**
     * Get from hash
     */
    async hget(key: string, field: string): Promise<string | null> {
        return await this.cluster.hget(key, field);
    }

    /**
     * Get all hash fields
     */
    async hgetall(key: string): Promise<Record<string, string>> {
        return await this.cluster.hgetall(key);
    }

    /**
     * Delete hash field
     */
    async hdel(key: string, field: string): Promise<number> {
        return await this.cluster.hdel(key, field);
    }

    /**
     * Get hash field count
     */
    async hlen(key: string): Promise<number> {
        return await this.cluster.hlen(key);
    }

    /**
     * Execute multiple commands atomically
     */
    async multi(commands: Array<{ command: string; args: unknown[] }>): Promise<unknown[]> {
        const pipeline = this.cluster.pipeline();

        for (const cmd of commands) {
            pipeline.call(cmd.command, ...(cmd.args as (string | number | Buffer)[]));
        }

        const result = await pipeline.exec();
        return result || [];
    }

    /**
     * Get cluster information
     */
    async getClusterInfo(): Promise<{
        clusterState: string;
        knownNodes: number;
        slots: Array<{
            start: number;
            end: number;
            master: { host: string; port: number };
            replicas: Array<{ host: string; port: number }>;
        }>;
    }> {
        const info = await this.cluster.call('cluster', 'info') as string;
        const nodes = await this.cluster.call('cluster', 'nodes') as string;

        // Parse cluster info
        const clusterState = info.includes('cluster_state:ok') ? 'ok' : 'fail';
        const knownNodes = parseInt(info.match(/cluster_known_nodes:(\d+)/)?.[1] || '0');

        // Parse nodes (simplified parsing)
        const slots: Array<{
            start: number;
            end: number;
            master: { host: string; port: number };
            replicas: Array<{ host: string; port: number }>;
        }> = [];

        // This is a simplified parsing - in production you'd want more robust parsing
        const nodeLines = nodes.split('\n').filter(line => line.trim());
        for (const line of nodeLines) {
            const parts = line.split(' ');
            if (parts.length >= 8) {
                const hostPort = parts[1].split(':');
                const host = hostPort[0];
                const port = parseInt(hostPort[1]);

                // This is a very simplified slot parsing
                // Real implementation would need proper slot range parsing
                slots.push({
                    start: 0,
                    end: 16383,
                    master: { host, port },
                    replicas: []
                });
            }
        }

        return {
            clusterState,
            knownNodes,
            slots
        };
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        message: string;
        details: Record<string, unknown>;
    }> {
        try {
            const info = await this.getClusterInfo();
            const status = this.getStatus();

            const healthyNodes = status.nodes.filter(node => node.status === 'ready').length;
            const totalNodes = status.nodes.length;

            let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
            let message = 'Cluster is healthy';

            if (!this.isConnected) {
                healthStatus = 'unhealthy';
                message = 'Cluster is not connected';
            } else if (healthyNodes < totalNodes) {
                healthStatus = 'degraded';
                message = `${healthyNodes}/${totalNodes} nodes are healthy`;
            } else if (info.clusterState !== 'ok') {
                healthStatus = 'degraded';
                message = `Cluster state: ${info.clusterState}`;
            }

            return {
                status: healthStatus,
                message,
                details: {
                    clusterState: info.clusterState,
                    knownNodes: info.knownNodes,
                    healthyNodes,
                    totalNodes,
                    isConnected: this.isConnected
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: `Health check failed: ${error}`,
                details: { error: error }
            };
        }
    }

    /**
     * Close cluster connection
     */
    async close(): Promise<void> {
        await this.cluster.quit();
    }
}