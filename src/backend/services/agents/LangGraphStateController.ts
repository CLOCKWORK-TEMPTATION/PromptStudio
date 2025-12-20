/**
 * LangGraph State Graph Control Path
 * Implements state-based workflow orchestration for complex multi-agent tasks
 */

import { EventEmitter } from 'events';
import { logger } from '../../lib/logger.js';
import { z } from 'zod';

// State and transition schemas
const StateSchema = z.object({
    id: z.string(),
    name: z.string(),
    data: z.record(z.any()),
    metadata: z.object({
        createdAt: z.date(),
        updatedAt: z.date(),
        version: z.number()
    })
});

// Manual type definitions for transitions since z.function() doesn't infer properly
type State = z.infer<typeof StateSchema>;

export interface ExecutionContext {
    graphId: string;
    currentState: string;
    data: Record<string, unknown>;
    history: Array<{
        from: string;
        to: string;
        timestamp: Date;
        data: Record<string, unknown>;
    }>;
    startTime: Date;
    stepCount: number;
}

interface Transition {
    from: string;
    to: string;
    condition?: (context: ExecutionContext) => boolean;
    action?: (context: ExecutionContext) => Promise<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
}

interface GraphConfig {
    id: string;
    name: string;
    initialState: string;
    states: State[];
    transitions: Transition[];
    maxExecutionTime: number;
    maxSteps: number;
}

export class LangGraphStateController extends EventEmitter {
    private graphs: Map<string, GraphConfig> = new Map();
    private executions: Map<string, ExecutionContext> = new Map();

    constructor() {
        super();
        this.setMaxListeners(100);
    }

    /**
     * Define a new state graph
     */
    defineGraph(config: Omit<GraphConfig, 'states' | 'transitions'> & {
        states: Array<Omit<State, 'metadata'>>;
        transitions: Array<Omit<Transition, 'condition' | 'action'> & {
            condition?: (context: ExecutionContext) => boolean;
            action?: (context: ExecutionContext) => Promise<Record<string, any>>;
        }>;
    }): string {
        const graphConfig: GraphConfig = {
            ...config,
            states: config.states.map(state => ({
                ...state,
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: 1
                }
            })),
            transitions: config.transitions
        };

        this.graphs.set(config.id, graphConfig);
        logger.info(`[LangGraphStateController] Defined graph ${config.id} with ${config.states.length} states`);
        
        return config.id;
    }

    /**
     * Start graph execution
     */
    async startExecution(
        graphId: string,
        initialData: Record<string, any> = {},
        executionId?: string
    ): Promise<string> {
        const graph = this.graphs.get(graphId);
        if (!graph) {
            throw new Error(`Graph ${graphId} not found`);
        }

        const execId = executionId || `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const context: ExecutionContext = {
            graphId,
            currentState: graph.initialState,
            data: { ...initialData },
            history: [],
            startTime: new Date(),
            stepCount: 0
        };

        this.executions.set(execId, context);
        
        logger.info(`[LangGraphStateController] Started execution ${execId} for graph ${graphId}`);
        this.emit('execution:started', { executionId: execId, context });
        
        // Start execution loop
        this.executeGraph(execId).catch(error => {
            logger.error(`[LangGraphStateController] Execution ${execId} failed: ${error.message}`);
            this.emit('execution:failed', { executionId: execId, error });
        });
        
        return execId;
    }

    /**
     * Execute graph state transitions
     */
    private async executeGraph(executionId: string): Promise<void> {
        const context = this.executions.get(executionId);
        if (!context) {
            throw new Error(`Execution ${executionId} not found`);
        }

        const graph = this.graphs.get(context.graphId);
        if (!graph) {
            throw new Error(`Graph ${context.graphId} not found`);
        }

        while (true) {
            // Check execution limits
            if (Date.now() - context.startTime.getTime() > graph.maxExecutionTime) {
                throw new Error(`Execution timeout after ${graph.maxExecutionTime}ms`);
            }
            
            if (context.stepCount >= graph.maxSteps) {
                throw new Error(`Maximum steps (${graph.maxSteps}) exceeded`);
            }

            // Find available transitions from current state
            const availableTransitions = graph.transitions.filter(t => t.from === context.currentState);
            
            if (availableTransitions.length === 0) {
                // No transitions available - execution complete
                logger.info(`[LangGraphStateController] Execution ${executionId} completed at state ${context.currentState}`);
                this.emit('execution:completed', { executionId, context });
                break;
            }

            // Evaluate transition conditions
            let selectedTransition: Transition | null = null;
            
            for (const transition of availableTransitions) {
                if (!transition.condition || transition.condition(context)) {
                    selectedTransition = transition;
                    break;
                }
            }

            if (!selectedTransition) {
                // No valid transition found - execution stuck
                logger.warn(`[LangGraphStateController] Execution ${executionId} stuck at state ${context.currentState}`);
                this.emit('execution:stuck', { executionId, context });
                break;
            }

            // Execute transition action
            let actionResult: Record<string, any> = {};
            if (selectedTransition.action) {
                try {
                    actionResult = await selectedTransition.action(context);
                } catch (error: any) {
                    logger.error(`[LangGraphStateController] Transition action failed: ${error.message}`);
                    this.emit('execution:error', { executionId, error, context });
                    throw error;
                }
            }

            // Update context
            const previousState = context.currentState;
            context.currentState = selectedTransition.to;
            context.data = { ...context.data, ...actionResult };
            context.stepCount++;
            
            context.history.push({
                from: previousState,
                to: selectedTransition.to,
                timestamp: new Date(),
                data: { ...actionResult }
            });

            logger.debug(`[LangGraphStateController] Execution ${executionId}: ${previousState} -> ${selectedTransition.to}`);
            this.emit('state:changed', {
                executionId,
                from: previousState,
                to: selectedTransition.to,
                context
            });

            // Small delay to prevent tight loops
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    /**
     * Get execution status
     */
    getExecutionStatus(executionId: string): ExecutionContext | null {
        return this.executions.get(executionId) || null;
    }

    /**
     * Update execution data
     */
    updateExecutionData(executionId: string, data: Record<string, any>): boolean {
        const context = this.executions.get(executionId);
        if (!context) return false;
        
        context.data = { ...context.data, ...data };
        this.emit('data:updated', { executionId, data: context.data });
        
        return true;
    }

    /**
     * Force state transition
     */
    async forceTransition(executionId: string, targetState: string): Promise<boolean> {
        const context = this.executions.get(executionId);
        if (!context) return false;
        
        const graph = this.graphs.get(context.graphId);
        if (!graph) return false;
        
        // Validate target state exists
        const stateExists = graph.states.some(s => s.id === targetState);
        if (!stateExists) return false;
        
        const previousState = context.currentState;
        context.currentState = targetState;
        context.stepCount++;
        
        context.history.push({
            from: previousState,
            to: targetState,
            timestamp: new Date(),
            data: { forced: true }
        });
        
        logger.info(`[LangGraphStateController] Forced transition ${executionId}: ${previousState} -> ${targetState}`);
        this.emit('state:forced', { executionId, from: previousState, to: targetState, context });
        
        return true;
    }

    /**
     * Stop execution
     */
    stopExecution(executionId: string): boolean {
        const context = this.executions.get(executionId);
        if (!context) return false;
        
        this.executions.delete(executionId);
        logger.info(`[LangGraphStateController] Stopped execution ${executionId}`);
        this.emit('execution:stopped', { executionId, context });
        
        return true;
    }

    /**
     * Get graph definition
     */
    getGraph(graphId: string): GraphConfig | null {
        return this.graphs.get(graphId) || null;
    }

    /**
     * List all active executions
     */
    getActiveExecutions(): Array<{ executionId: string; context: ExecutionContext }> {
        return Array.from(this.executions.entries()).map(([id, context]) => ({
            executionId: id,
            context
        }));
    }

    /**
     * Cleanup completed executions
     */
    cleanup(maxAge: number = 3600000): void { // 1 hour default
        const now = Date.now();
        const expiredExecutions: string[] = [];
        
        for (const [id, context] of this.executions.entries()) {
            if (now - context.startTime.getTime() > maxAge) {
                expiredExecutions.push(id);
            }
        }
        
        expiredExecutions.forEach(id => this.executions.delete(id));
        
        if (expiredExecutions.length > 0) {
            logger.info(`[LangGraphStateController] Cleaned up ${expiredExecutions.length} expired executions`);
        }
    }
}