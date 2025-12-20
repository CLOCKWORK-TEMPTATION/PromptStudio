/**
 * Model Context Protocol (MCP) Client
 * Provides shared context coordination for multi-agent systems
 */

import { EventEmitter } from 'events';
import { logger } from './logger';
import { z } from 'zod';

const MCPContextSchema = z.object({
    id: z.string(),
    stepId: z.string(),
    description: z.string(),
    requiredTools: z.array(z.string()),
    context: z.record(z.any()),
    createdAt: z.date(),
    status: z.enum(['active', 'completed', 'failed', 'cancelled'])
});

type MCPContext = z.infer<typeof MCPContextSchema>;

export class MCPClient extends EventEmitter {
    private contexts: Map<string, MCPContext> = new Map();
    private sharedMemory: Map<string, any> = new Map();

    constructor() {
        super();
        this.setMaxListeners(100);
    }

    /**
     * Create a new MCP context for agent coordination
     */
    async createContext(params: {
        stepId: string;
        description: string;
        requiredTools: string[];
        context: Record<string, any>;
    }): Promise<MCPContext> {
        const contextId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const mcpContext: MCPContext = {
            id: contextId,
            stepId: params.stepId,
            description: params.description,
            requiredTools: params.requiredTools,
            context: params.context,
            createdAt: new Date(),
            status: 'active'
        };

        this.contexts.set(contextId, mcpContext);
        
        // Store context in shared memory
        this.sharedMemory.set(`context:${contextId}`, mcpContext);
        
        logger.debug(`[MCPClient] Created context ${contextId} for step ${params.stepId}`);
        this.emit('context:created', mcpContext);
        
        return mcpContext;
    }

    /**
     * Update context status and data
     */
    async updateContext(contextId: string, updates: Partial<MCPContext>): Promise<MCPContext | null> {
        const context = this.contexts.get(contextId);
        if (!context) {
            logger.warn(`[MCPClient] Context ${contextId} not found for update`);
            return null;
        }

        const updatedContext = { ...context, ...updates };
        this.contexts.set(contextId, updatedContext);
        this.sharedMemory.set(`context:${contextId}`, updatedContext);
        
        logger.debug(`[MCPClient] Updated context ${contextId}`);
        this.emit('context:updated', updatedContext);
        
        return updatedContext;
    }

    /**
     * Get context by ID
     */
    async getContext(contextId: string): Promise<MCPContext | null> {
        return this.contexts.get(contextId) || null;
    }

    /**
     * Close and cleanup context
     */
    async closeContext(contextId: string): Promise<void> {
        const context = this.contexts.get(contextId);
        if (context) {
            context.status = 'completed';
            this.contexts.delete(contextId);
            this.sharedMemory.delete(`context:${contextId}`);
            
            logger.debug(`[MCPClient] Closed context ${contextId}`);
            this.emit('context:closed', context);
        }
    }

    /**
     * Share data across contexts
     */
    async shareData(key: string, data: any, ttl?: number): Promise<void> {
        this.sharedMemory.set(`shared:${key}`, {
            data,
            timestamp: Date.now(),
            ttl: ttl ? Date.now() + (ttl * 1000) : null
        });
        
        logger.debug(`[MCPClient] Shared data with key ${key}`);
        this.emit('data:shared', { key, data });
    }

    /**
     * Retrieve shared data
     */
    async getSharedData(key: string): Promise<any> {
        const entry = this.sharedMemory.get(`shared:${key}`);
        if (!entry) return null;
        
        // Check TTL expiration
        if (entry.ttl && Date.now() > entry.ttl) {
            this.sharedMemory.delete(`shared:${key}`);
            return null;
        }
        
        return entry.data;
    }

    /**
     * Get all active contexts
     */
    async getActiveContexts(): Promise<MCPContext[]> {
        return Array.from(this.contexts.values()).filter(ctx => ctx.status === 'active');
    }

    /**
     * Cleanup expired contexts and data
     */
    async cleanup(): Promise<void> {
        const now = Date.now();
        const expiredKeys: string[] = [];
        
        // Cleanup expired shared data
        for (const [key, entry] of this.sharedMemory.entries()) {
            if (key.startsWith('shared:') && entry.ttl && now > entry.ttl) {
                expiredKeys.push(key);
            }
        }
        
        expiredKeys.forEach(key => this.sharedMemory.delete(key));
        
        // Cleanup old contexts (older than 1 hour)
        const oneHourAgo = now - (60 * 60 * 1000);
        const expiredContexts: string[] = [];
        
        for (const [id, context] of this.contexts.entries()) {
            if (context.createdAt.getTime() < oneHourAgo) {
                expiredContexts.push(id);
            }
        }
        
        expiredContexts.forEach(id => {
            this.contexts.delete(id);
            this.sharedMemory.delete(`context:${id}`);
        });
        
        if (expiredKeys.length > 0 || expiredContexts.length > 0) {
            logger.info(`[MCPClient] Cleaned up ${expiredKeys.length} expired data entries and ${expiredContexts.length} expired contexts`);
        }
    }
}