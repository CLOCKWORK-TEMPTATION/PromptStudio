/**
 * Reasoning History Service
 * Tracks and manages execution history for multi-agent workflows
 */

import { logger } from '../lib/logger';
import { z } from 'zod';

// Session schemas
const SessionSchema = z.object({
    sessionId: z.string(),
    objective: z.string(),
    executionPlan: z.any(),
    stepResults: z.array(z.any()),
    finalAnswer: z.string(),
    status: z.enum(['pending', 'in_progress', 'completed', 'partial', 'failed', 'cancelled']),
    metadata: z.object({
        totalSteps: z.number(),
        completedSteps: z.number(),
        totalTokens: z.number(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        duration: z.number().optional(),
        reasoningType: z.string().optional(),
        config: z.any().optional()
    }),
    createdAt: z.date().default(() => new Date()),
    updatedAt: z.date().default(() => new Date())
});

const ComparisonSchema = z.object({
    id: z.string(),
    sessionId: z.string(),
    paths: z.array(z.any()),
    selection: z.any(),
    executionTime: z.number(),
    createdAt: z.date().default(() => new Date())
});

// We need to use ComparisonSchema for validation when storing comparisons
type Comparison = z.infer<typeof ComparisonSchema>;

type Session = z.infer<typeof SessionSchema>;

class ReasoningHistoryServiceClass {
    private sessions: Map<string, Session> = new Map();
    private comparisons: Map<string, Comparison> = new Map();
    private maxSessions: number = 1000;
    private maxAge: number = 7 * 24 * 60 * 60 * 1000; // 7 days

    constructor(config: { maxSessions?: number; maxAge?: number } = {}) {
        this.maxSessions = config.maxSessions || 1000;
        this.maxAge = config.maxAge || 7 * 24 * 60 * 60 * 1000;

        // Cleanup old sessions periodically
        setInterval(() => {
            this.cleanup();
        }, 60 * 60 * 1000); // Every hour
    }

    /**
     * Save a new session
     */
    async saveSession(sessionData: Omit<Session, 'createdAt' | 'updatedAt'>): Promise<void> {
        try {
            const session: Session = {
                ...sessionData,
                metadata: {
                    ...sessionData.metadata,
                    startTime: sessionData.metadata.startTime || new Date(),
                    endTime: sessionData.status === 'completed' || sessionData.status === 'failed'
                        ? new Date()
                        : sessionData.metadata.endTime,
                    duration: sessionData.metadata.duration ||
                        (sessionData.metadata.startTime
                            ? Date.now() - sessionData.metadata.startTime.getTime()
                            : 0)
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const validatedSession = SessionSchema.parse(session);
            this.sessions.set(sessionData.sessionId, validatedSession);

            logger.info(`[ReasoningHistoryService] Saved session ${sessionData.sessionId} with status ${sessionData.status}`);

            // Cleanup if we exceed max sessions
            if (this.sessions.size > this.maxSessions) {
                this.cleanup();
            }

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`[ReasoningHistoryService] Failed to save session ${sessionData.sessionId}: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Get session by ID
     */
    async getSession(sessionId: string): Promise<Session | null> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            logger.debug(`[ReasoningHistoryService] Session ${sessionId} not found`);
            return null;
        }

        return session;
    }

    /**
     * Update session status
     */
    async updateSessionStatus(
        sessionId: string,
        status: Session['status'],
        metadata?: Partial<Session['metadata']>
    ): Promise<boolean> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            logger.warn(`[ReasoningHistoryService] Cannot update status for non-existent session ${sessionId}`);
            return false;
        }

        session.status = status;
        session.updatedAt = new Date();

        if (metadata) {
            session.metadata = { ...session.metadata, ...metadata };
        }

        // Set end time for terminal states
        if (['completed', 'failed', 'cancelled'].includes(status)) {
            session.metadata.endTime = new Date();
            if (session.metadata.startTime) {
                session.metadata.duration = session.metadata.endTime.getTime() - session.metadata.startTime.getTime();
            }
        }

        this.sessions.set(sessionId, session);
        logger.info(`[ReasoningHistoryService] Updated session ${sessionId} status to ${status}`);

        return true;
    }

    /**
     * Get sessions by status
     */
    async getSessionsByStatus(status: Session['status']): Promise<Session[]> {
        const sessions = Array.from(this.sessions.values())
            .filter(session => session.status === status)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        return sessions;
    }

    /**
     * Get recent sessions
     */
    async getRecentSessions(limit: number = 50): Promise<Session[]> {
        const sessions = Array.from(this.sessions.values())
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);

        return sessions;
    }

    /**
     * Search sessions by objective
     */
    async searchSessions(query: string, limit: number = 20): Promise<Session[]> {
        const lowerQuery = query.toLowerCase();
        const sessions = Array.from(this.sessions.values())
            .filter(session =>
                session.objective.toLowerCase().includes(lowerQuery) ||
                session.finalAnswer.toLowerCase().includes(lowerQuery)
            )
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);

        return sessions;
    }

    /**
     * Get session statistics
     */
    async getStatistics(): Promise<{
        totalSessions: number;
        sessionsByStatus: Record<Session['status'], number>;
        averageDuration: number;
        averageSteps: number;
        totalTokensUsed: number;
        successRate: number;
    }> {
        const sessions = Array.from(this.sessions.values());
        const totalSessions = sessions.length;

        if (totalSessions === 0) {
            return {
                totalSessions: 0,
                sessionsByStatus: {
                    pending: 0,
                    in_progress: 0,
                    completed: 0,
                    partial: 0,
                    failed: 0,
                    cancelled: 0
                },
                averageDuration: 0,
                averageSteps: 0,
                totalTokensUsed: 0,
                successRate: 0
            };
        }

        // Count sessions by status
        const sessionsByStatus = sessions.reduce((acc, session) => {
            acc[session.status] = (acc[session.status] || 0) + 1;
            return acc;
        }, {} as Record<Session['status'], number>);

        // Fill in missing statuses with 0
        const allStatuses: Session['status'][] = ['pending', 'in_progress', 'completed', 'partial', 'failed', 'cancelled'];
        allStatuses.forEach(status => {
            if (!(status in sessionsByStatus)) {
                sessionsByStatus[status] = 0;
            }
        });

        // Calculate averages
        const completedSessions = sessions.filter(s => s.metadata.duration);
        const averageDuration = completedSessions.length > 0
            ? completedSessions.reduce((sum, s) => sum + (s.metadata.duration || 0), 0) / completedSessions.length
            : 0;

        const averageSteps = sessions.reduce((sum, s) => sum + s.metadata.totalSteps, 0) / totalSessions;
        const totalTokensUsed = sessions.reduce((sum, s) => sum + s.metadata.totalTokens, 0);

        const successfulSessions = sessionsByStatus.completed + sessionsByStatus.partial;
        const successRate = successfulSessions / totalSessions;

        return {
            totalSessions,
            sessionsByStatus,
            averageDuration,
            averageSteps,
            totalTokensUsed,
            successRate
        };
    }

    /**
     * Create a new reasoning session
     * Compatibility method for reasoning.ts routes
     */
    async createSession(
        prompt: string,
        reasoningType: string,
        config?: Record<string, unknown>
    ): Promise<{ id: string }> {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await this.saveSession({
            sessionId,
            objective: prompt,
            executionPlan: {},
            stepResults: [],
            finalAnswer: '',
            status: 'in_progress',
            metadata: {
                totalSteps: 0,
                completedSteps: 0,
                totalTokens: 0,
                startTime: new Date(),
                reasoningType,
                config
            }
        });

        return { id: sessionId };
    }

    /**
     * Complete a reasoning session
     * Compatibility method for reasoning.ts routes
     */
    async completeSession(
        sessionId: string,
        result?: unknown,
        status: 'completed' | 'failed' = 'completed',
        errorMessage?: string
    ): Promise<void> {
        const session = await this.getSession(sessionId);
        if (!session) {
            logger.warn(`[ReasoningHistoryService] Cannot complete non-existent session ${sessionId}`);
            return;
        }

        const metadata: Partial<Session['metadata']> = {
            endTime: new Date()
        };

        if (session.metadata.startTime) {
            metadata.duration = Date.now() - session.metadata.startTime.getTime();
        }

        // Update final answer if result is provided
        if (result) {
            session.finalAnswer = typeof result === 'string'
                ? result
                : JSON.stringify(result);
            this.sessions.set(sessionId, session);
        }

        await this.updateSessionStatus(
            sessionId,
            status === 'failed' ? 'failed' : 'completed',
            metadata
        );

        if (errorMessage) {
            logger.error(`[ReasoningHistoryService] Session ${sessionId} failed: ${errorMessage}`);
        }
    }

    /**
     * Store a comparison between reasoning paths
     * Compatibility method for reasoning.ts routes
     */
    async storeComparison(
        sessionId: string,
        paths: unknown[],
        selection: unknown,
        executionTime: number
    ): Promise<{ id: string }> {
        const comparisonId = `comparison_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const comparison: Comparison = {
            id: comparisonId,
            sessionId,
            paths,
            selection,
            executionTime,
            createdAt: new Date()
        };

        this.comparisons.set(comparisonId, comparison);
        logger.info(`[ReasoningHistoryService] Stored comparison ${comparisonId} for session ${sessionId}`);

        return { id: comparisonId };
    }

    /**
     * Get overall statistics
     * Alias for getStatistics() for compatibility
     */
    async getOverallStatistics() {
        return this.getStatistics();
    }

    /**
     * Get statistics for a specific prompt
     * Compatibility method for reasoning.ts routes
     */
    async getPromptStatistics(prompt: string): Promise<{
        totalExecutions: number;
        successRate: number;
        averageDuration: number;
        recentSessions: Session[];
    }> {
        const matchingSessions = Array.from(this.sessions.values())
            .filter(session => session.objective === prompt)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        const totalExecutions = matchingSessions.length;

        if (totalExecutions === 0) {
            return {
                totalExecutions: 0,
                successRate: 0,
                averageDuration: 0,
                recentSessions: []
            };
        }

        const successfulSessions = matchingSessions.filter(
            s => s.status === 'completed' || s.status === 'partial'
        );
        const successRate = successfulSessions.length / totalExecutions;

        const completedSessions = matchingSessions.filter(s => s.metadata.duration);
        const averageDuration = completedSessions.length > 0
            ? completedSessions.reduce((sum, s) => sum + (s.metadata.duration || 0), 0) / completedSessions.length
            : 0;

        return {
            totalExecutions,
            successRate,
            averageDuration,
            recentSessions: matchingSessions.slice(0, 10)
        };
    }

    /**
     * Delete session
     */
    async deleteSession(sessionId: string): Promise<boolean> {
        const deleted = this.sessions.delete(sessionId);
        if (deleted) {
            logger.info(`[ReasoningHistoryService] Deleted session ${sessionId}`);
        } else {
            logger.warn(`[ReasoningHistoryService] Session ${sessionId} not found for deletion`);
        }
        return deleted;
    }

    /**
     * Export sessions to JSON
     */
    async exportSessions(sessionIds?: string[]): Promise<Session[]> {
        if (sessionIds) {
            return sessionIds
                .map(id => this.sessions.get(id))
                .filter((session): session is Session => session !== undefined);
        }

        return Array.from(this.sessions.values());
    }

    /**
     * Import sessions from JSON
     */
    async importSessions(sessions: Session[]): Promise<{ imported: number; errors: number }> {
        let imported = 0;
        let errors = 0;

        for (const sessionData of sessions) {
            try {
                const validatedSession = SessionSchema.parse(sessionData);
                this.sessions.set(validatedSession.sessionId, validatedSession);
                imported++;
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error(`[ReasoningHistoryService] Failed to import session ${sessionData.sessionId}: ${errorMessage}`);
                errors++;
            }
        }

        logger.info(`[ReasoningHistoryService] Import completed: ${imported} imported, ${errors} errors`);
        return { imported, errors };
    }

    /**
     * Cleanup old sessions
     */
    private cleanup(): void {
        const now = Date.now();
        const sessionsToDelete: string[] = [];

        // Find sessions to delete (old or excess)
        const sessionEntries = Array.from(this.sessions.entries())
            .sort((a, b) => b[1].createdAt.getTime() - a[1].createdAt.getTime());

        for (let i = 0; i < sessionEntries.length; i++) {
            const [sessionId, session] = sessionEntries[i];

            // Delete if too old
            if (now - session.createdAt.getTime() > this.maxAge) {
                sessionsToDelete.push(sessionId);
            }
            // Delete if exceeding max sessions (keep most recent)
            else if (i >= this.maxSessions) {
                sessionsToDelete.push(sessionId);
            }
        }

        // Delete sessions
        sessionsToDelete.forEach(sessionId => {
            this.sessions.delete(sessionId);
        });

        if (sessionsToDelete.length > 0) {
            logger.info(`[ReasoningHistoryService] Cleaned up ${sessionsToDelete.length} old sessions`);
        }
    }

    /**
     * Get memory usage info
     */
    getMemoryInfo(): {
        sessionCount: number;
        estimatedMemoryMB: number;
        oldestSession: Date | null;
        newestSession: Date | null;
    } {
        const sessions = Array.from(this.sessions.values());
        const sessionCount = sessions.length;

        // Rough estimate: ~1KB per session
        const estimatedMemoryMB = (sessionCount * 1024) / (1024 * 1024);

        const dates = sessions.map(s => s.createdAt).sort((a, b) => a.getTime() - b.getTime());
        const oldestSession = dates.length > 0 ? dates[0] : null;
        const newestSession = dates.length > 0 ? dates[dates.length - 1] : null;

        return {
            sessionCount,
            estimatedMemoryMB,
            oldestSession,
            newestSession
        };
    }
}

// Type export for use in other files
export type ReasoningHistoryServiceType = ReasoningHistoryServiceClass;

// Singleton instance for use across the application
export const ReasoningHistoryService = new ReasoningHistoryServiceClass();

// Static wrapper for backward compatibility with routes that use static-like syntax
export const ReasoningHistoryServiceStatic = {
    createSession: ReasoningHistoryService.createSession.bind(ReasoningHistoryService),
    completeSession: ReasoningHistoryService.completeSession.bind(ReasoningHistoryService),
    storeComparison: ReasoningHistoryService.storeComparison.bind(ReasoningHistoryService),
    getSession: ReasoningHistoryService.getSession.bind(ReasoningHistoryService),
    getRecentSessions: ReasoningHistoryService.getRecentSessions.bind(ReasoningHistoryService),
    getOverallStatistics: ReasoningHistoryService.getOverallStatistics.bind(ReasoningHistoryService),
    getPromptStatistics: ReasoningHistoryService.getPromptStatistics.bind(ReasoningHistoryService),
};
