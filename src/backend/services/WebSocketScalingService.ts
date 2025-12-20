import { Redis } from 'ioredis';
import { WebSocket } from 'ws';

export interface WSSession {
    id: string;
    userId: string;
    tenantId?: string;
    connectionId: string;
    serverId: string;
    connectedAt: Date;
    lastActivity: Date;
    subscriptions: string[];
    metadata?: Record<string, unknown>;
}

export interface WSMessage {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    from: string;
    to?: string;
    tenantId?: string;
    timestamp: Date;
    ttl?: number;
}

export class WebSocketScalingService {
    private redis: Redis;
    private pubSub: Redis;
    private serverId: string;
    private sessions: Map<string, WSSession> = new Map();

    constructor(redisUrl?: string) {
        this.serverId = `ws_server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
        this.pubSub = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');

        this.setupPubSub();
    }

    /**
     * Register a WebSocket connection
     */
    async registerConnection(
        ws: WebSocket,
        userId: string,
        tenantId?: string,
        metadata?: Record<string, unknown>
    ): Promise<string> {
        const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sessionId = `session_${userId}_${Date.now()}`;

        const session: WSSession = {
            id: sessionId,
            userId,
            tenantId,
            connectionId,
            serverId: this.serverId,
            connectedAt: new Date(),
            lastActivity: new Date(),
            subscriptions: [],
            metadata
        };

        this.sessions.set(connectionId, session);

        // Store session in Redis for cross-server communication
        await this.redis.setex(
            `ws:session:${connectionId}`,
            3600, // 1 hour TTL
            JSON.stringify(session)
        );

        // Add to user connections set
        await this.redis.sadd(`ws:user:${userId}`, connectionId);

        // Add to tenant connections if applicable
        if (tenantId) {
            await this.redis.sadd(`ws:tenant:${tenantId}`, connectionId);
        }

        // Publish connection event
        await this.publishMessage({
            id: `msg_${Date.now()}`,
            type: 'connection_established',
            payload: { sessionId, userId, tenantId },
            from: this.serverId,
            tenantId,
            timestamp: new Date()
        });

        return connectionId;
    }

    /**
     * Unregister a WebSocket connection
     */
    async unregisterConnection(connectionId: string): Promise<void> {
        const session = this.sessions.get(connectionId);
        if (!session) return;

        // Remove from local sessions
        this.sessions.delete(connectionId);

        // Remove from Redis
        await Promise.all([
            this.redis.del(`ws:session:${connectionId}`),
            this.redis.srem(`ws:user:${session.userId}`, connectionId),
            session.tenantId ? this.redis.srem(`ws:tenant:${session.tenantId}`, connectionId) : Promise.resolve()
        ]);

        // Publish disconnection event
        await this.publishMessage({
            id: `msg_${Date.now()}`,
            type: 'connection_closed',
            payload: { sessionId: session.id, userId: session.userId, tenantId: session.tenantId },
            from: this.serverId,
            tenantId: session.tenantId,
            timestamp: new Date()
        });
    }

    /**
     * Subscribe to a channel/room
     */
    async subscribe(connectionId: string, channel: string): Promise<void> {
        const session = this.sessions.get(connectionId);
        if (!session) return;

        if (!session.subscriptions.includes(channel)) {
            session.subscriptions.push(channel);
            await this.redis.sadd(`ws:channel:${channel}`, connectionId);
        }

        // Update session in Redis
        await this.redis.setex(
            `ws:session:${connectionId}`,
            3600,
            JSON.stringify(session)
        );
    }

    /**
     * Unsubscribe from a channel/room
     */
    async unsubscribe(connectionId: string, channel: string): Promise<void> {
        const session = this.sessions.get(connectionId);
        if (!session) return;

        const index = session.subscriptions.indexOf(channel);
        if (index > -1) {
            session.subscriptions.splice(index, 1);
            await this.redis.srem(`ws:channel:${channel}`, connectionId);
        }

        // Update session in Redis
        await this.redis.setex(
            `ws:session:${connectionId}`,
            3600,
            JSON.stringify(session)
        );
    }

    /**
     * Send message to specific connection
     */
    async sendToConnection(connectionId: string, message: WSMessage): Promise<void> {
        const session = this.sessions.get(connectionId);

        if (session && session.serverId === this.serverId) {
            // Local connection - handle directly
            // In a real implementation, you'd have a WebSocket reference here
            console.log(`Sending message to local connection ${connectionId}:`, message);
        } else {
            // Remote connection - publish to Redis
            await this.publishMessage({
                ...message,
                to: connectionId
            });
        }
    }

    /**
     * Send message to all connections of a user
     */
    async sendToUser(userId: string, message: WSMessage): Promise<void> {
        const connectionIds = await this.redis.smembers(`ws:user:${userId}`);

        for (const connectionId of connectionIds) {
            await this.sendToConnection(connectionId, { ...message, to: connectionId });
        }
    }

    /**
     * Send message to all connections in a tenant
     */
    async sendToTenant(tenantId: string, message: WSMessage): Promise<void> {
        const connectionIds = await this.redis.smembers(`ws:tenant:${tenantId}`);

        for (const connectionId of connectionIds) {
            await this.sendToConnection(connectionId, { ...message, to: connectionId });
        }
    }

    /**
     * Broadcast message to a channel
     */
    async broadcastToChannel(channel: string, message: WSMessage): Promise<void> {
        const connectionIds = await this.redis.smembers(`ws:channel:${channel}`);

        for (const connectionId of connectionIds) {
            await this.sendToConnection(connectionId, { ...message, to: connectionId });
        }
    }

    /**
     * Publish message to Redis pub/sub for cross-server communication
     */
    private async publishMessage(message: WSMessage): Promise<void> {
        const channel = message.tenantId ? `ws:tenant:${message.tenantId}` : 'ws:global';
        await this.redis.publish(channel, JSON.stringify(message));
    }

    /**
     * Setup Redis pub/sub for cross-server communication
     */
    private setupPubSub(): void {
        this.pubSub.on('message', async (channel, messageData) => {
            try {
                const message: WSMessage = JSON.parse(messageData);

                // Handle message based on type and target
                if (message.to) {
                    // Direct message to specific connection
                    const session = this.sessions.get(message.to);
                    if (session && session.serverId === this.serverId) {
                        // This server handles the target connection
                        console.log(`Handling message for local connection ${message.to}:`, message);
                        // In a real implementation, you'd send to the actual WebSocket here
                    }
                } else if (message.type === 'connection_established' || message.type === 'connection_closed') {
                    // Handle connection events for load balancing awareness
                    console.log(`Connection event: ${message.type}`, message.payload);
                }
            } catch (error) {
                console.error('Error handling pub/sub message:', error);
            }
        });

        // Subscribe to relevant channels
        this.pubSub.subscribe('ws:global');
        // In a real implementation, you'd subscribe to tenant-specific channels as needed
    }

    /**
     * Get connection statistics
     */
    async getConnectionStats(): Promise<{
        localConnections: number;
        totalUsers: number;
        totalTenants: number;
        activeChannels: number;
    }> {
        const [userKeys, tenantKeys, channelKeys] = await Promise.all([
            this.redis.keys('ws:user:*'),
            this.redis.keys('ws:tenant:*'),
            this.redis.keys('ws:channel:*')
        ]);

        return {
            localConnections: this.sessions.size,
            totalUsers: userKeys.length,
            totalTenants: tenantKeys.length,
            activeChannels: channelKeys.length
        };
    }

    /**
     * Health check for WebSocket cluster
     */
    async healthCheck(): Promise<{
        serverId: string;
        status: 'healthy' | 'degraded' | 'unhealthy';
        localConnections: number;
        redisConnected: boolean;
        lastActivity: Date;
    }> {
        const redisConnected = this.redis.status === 'ready';
        const localConnections = this.sessions.size;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

        if (!redisConnected) {
            status = 'unhealthy';
        } else if (localConnections === 0) {
            status = 'degraded';
        }

        return {
            serverId: this.serverId,
            status,
            localConnections,
            redisConnected,
            lastActivity: new Date()
        };
    }

    /**
     * Clean up stale connections
     */
    async cleanupStaleConnections(): Promise<number> {
        const staleThreshold = Date.now() - (5 * 60 * 1000); // 5 minutes
        let cleanedCount = 0;

        for (const [connectionId, session] of this.sessions) {
            if (session.lastActivity.getTime() < staleThreshold) {
                await this.unregisterConnection(connectionId);
                cleanedCount++;
            }
        }

        return cleanedCount;
    }

    /**
     * Update connection activity
     */
    updateActivity(connectionId: string): void {
        const session = this.sessions.get(connectionId);
        if (session) {
            session.lastActivity = new Date();
        }
    }

    /**
     * Close all connections and cleanup
     */
    async close(): Promise<void> {
        // Unregister all local connections
        for (const connectionId of this.sessions.keys()) {
            await this.unregisterConnection(connectionId);
        }

        // Close Redis connections
        await Promise.all([
            this.redis.quit(),
            this.pubSub.quit()
        ]);
    }
}