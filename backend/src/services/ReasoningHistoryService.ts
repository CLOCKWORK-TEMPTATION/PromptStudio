import { ReasoningPath } from './LLMServiceAdapter.js';
import { BestPathSelection } from './analysisService.js';

export interface ReasoningSession {
  id: string;
  prompt: string;
  type: 'tree-of-thought' | 'graph-of-thought' | 'multi-path';
  createdAt: string;
  completedAt: string | null;
  status: 'running' | 'completed' | 'failed';
  config: {
    maxDepth?: number;
    branchingFactor?: number;
    maxNodes?: number;
    connectionThreshold?: number;
    numPaths?: number;
  };
  result?: any;
  error?: string;
}

export interface PathComparison {
  id: string;
  sessionId: string;
  paths: ReasoningPath[];
  selection?: BestPathSelection;
  metrics: {
    timestamp: string;
    executionTime: number;
    totalTokensUsed?: number;
    averageQualityScore: number;
  };
}

/**
 * Service for tracking and storing reasoning history
 */
export class ReasoningHistoryService {
  // In-memory storage (would be replaced with database in production)
  private static sessions: Map<string, ReasoningSession> = new Map();
  private static comparisons: Map<string, PathComparison> = new Map();
  private static pathsByPrompt: Map<string, string[]> = new Map(); // prompt -> session IDs

  /**
   * Create a new reasoning session
   */
  static createSession(
    prompt: string,
    type: 'tree-of-thought' | 'graph-of-thought' | 'multi-path',
    config: ReasoningSession['config']
  ): ReasoningSession {
    const session: ReasoningSession = {
      id: this.generateId(),
      prompt,
      type,
      createdAt: new Date().toISOString(),
      completedAt: null,
      status: 'running',
      config,
    };

    this.sessions.set(session.id, session);

    // Track sessions by prompt for easy retrieval
    const promptSessions = this.pathsByPrompt.get(prompt) || [];
    promptSessions.push(session.id);
    this.pathsByPrompt.set(prompt, promptSessions);

    return session;
  }

  /**
   * Update a session with results
   */
  static completeSession(
    sessionId: string,
    result: any,
    status: 'completed' | 'failed' = 'completed',
    error?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.completedAt = new Date().toISOString();
    session.status = status;
    session.result = result;
    if (error) {
      session.error = error;
    }

    this.sessions.set(sessionId, session);
  }

  /**
   * Get a session by ID
   */
  static getSession(sessionId: string): ReasoningSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions for a specific prompt
   */
  static getSessionsByPrompt(prompt: string): ReasoningSession[] {
    const sessionIds = this.pathsByPrompt.get(prompt) || [];
    return sessionIds
      .map(id => this.sessions.get(id))
      .filter((session): session is ReasoningSession => session !== undefined);
  }

  /**
   * Get recent sessions (up to limit)
   */
  static getRecentSessions(limit: number = 10): ReasoningSession[] {
    const allSessions = Array.from(this.sessions.values());
    return allSessions
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Store a path comparison
   */
  static storeComparison(
    sessionId: string,
    paths: ReasoningPath[],
    selection: BestPathSelection | undefined,
    executionTime: number
  ): PathComparison {
    const comparison: PathComparison = {
      id: this.generateId(),
      sessionId,
      paths,
      selection,
      metrics: {
        timestamp: new Date().toISOString(),
        executionTime,
        averageQualityScore: selection
          ? selection.confidenceScore
          : paths.reduce((sum, p) => sum + p.totalScore, 0) / paths.length,
      },
    };

    this.comparisons.set(comparison.id, comparison);
    return comparison;
  }

  /**
   * Get a comparison by ID
   */
  static getComparison(comparisonId: string): PathComparison | undefined {
    return this.comparisons.get(comparisonId);
  }

  /**
   * Get all comparisons for a session
   */
  static getComparisonsBySession(sessionId: string): PathComparison[] {
    return Array.from(this.comparisons.values())
      .filter(comp => comp.sessionId === sessionId);
  }

  /**
   * Get statistics for a prompt across all sessions
   */
  static getPromptStatistics(prompt: string): {
    totalSessions: number;
    successfulSessions: number;
    failedSessions: number;
    averageExecutionTime: number;
    averageQualityScore: number;
    bestSession?: ReasoningSession;
  } {
    const sessions = this.getSessionsByPrompt(prompt);
    const completedSessions = sessions.filter(s => s.status === 'completed');

    if (completedSessions.length === 0) {
      return {
        totalSessions: sessions.length,
        successfulSessions: 0,
        failedSessions: sessions.filter(s => s.status === 'failed').length,
        averageExecutionTime: 0,
        averageQualityScore: 0,
      };
    }

    const executionTimes = completedSessions
      .map(s => {
        if (s.completedAt && s.createdAt) {
          return new Date(s.completedAt).getTime() - new Date(s.createdAt).getTime();
        }
        return 0;
      })
      .filter(t => t > 0);

    const qualityScores = completedSessions
      .map(s => {
        if (s.result?.selection?.confidenceScore) {
          return s.result.selection.confidenceScore;
        }
        if (s.result?.qualityMetrics?.overallQuality) {
          return s.result.qualityMetrics.overallQuality;
        }
        return 0;
      })
      .filter(q => q > 0);

    const bestSession = completedSessions.reduce((best, current) => {
      const currentScore = current.result?.selection?.confidenceScore ||
                          current.result?.qualityMetrics?.overallQuality || 0;
      const bestScore = best.result?.selection?.confidenceScore ||
                       best.result?.qualityMetrics?.overallQuality || 0;
      return currentScore > bestScore ? current : best;
    }, completedSessions[0]);

    return {
      totalSessions: sessions.length,
      successfulSessions: completedSessions.length,
      failedSessions: sessions.filter(s => s.status === 'failed').length,
      averageExecutionTime: executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length,
      averageQualityScore: qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length,
      bestSession,
    };
  }

  /**
   * Clear old sessions (older than X days)
   */
  static clearOldSessions(daysToKeep: number = 7): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let deletedCount = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (new Date(session.createdAt) < cutoffDate) {
        this.sessions.delete(id);
        deletedCount++;
      }
    }

    // Clean up comparisons too
    for (const [id, comparison] of this.comparisons.entries()) {
      if (!this.sessions.has(comparison.sessionId)) {
        this.comparisons.delete(id);
      }
    }

    // Rebuild pathsByPrompt map
    this.pathsByPrompt.clear();
    for (const [id, session] of this.sessions.entries()) {
      const promptSessions = this.pathsByPrompt.get(session.prompt) || [];
      promptSessions.push(id);
      this.pathsByPrompt.set(session.prompt, promptSessions);
    }

    return deletedCount;
  }

  /**
   * Export session data for analysis
   */
  static exportSessionData(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const comparisons = this.getComparisonsBySession(sessionId);

    return JSON.stringify(
      {
        session,
        comparisons,
      },
      null,
      2
    );
  }

  /**
   * Get overall statistics across all sessions
   */
  static getOverallStatistics(): {
    totalSessions: number;
    totalComparisons: number;
    sessionsByType: Record<string, number>;
    averageQualityScore: number;
    topPrompts: Array<{ prompt: string; count: number }>;
  } {
    const allSessions = Array.from(this.sessions.values());
    const completedSessions = allSessions.filter(s => s.status === 'completed');

    const sessionsByType = allSessions.reduce((acc, session) => {
      acc[session.type] = (acc[session.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const qualityScores = completedSessions
      .map(s => {
        if (s.result?.selection?.confidenceScore) {
          return s.result.selection.confidenceScore;
        }
        if (s.result?.qualityMetrics?.overallQuality) {
          return s.result.qualityMetrics.overallQuality;
        }
        return 0;
      })
      .filter(q => q > 0);

    const promptCounts = Array.from(this.pathsByPrompt.entries())
      .map(([prompt, sessions]) => ({ prompt, count: sessions.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalSessions: allSessions.length,
      totalComparisons: this.comparisons.size,
      sessionsByType,
      averageQualityScore: qualityScores.length > 0
        ? qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length
        : 0,
      topPrompts: promptCounts,
    };
  }

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
