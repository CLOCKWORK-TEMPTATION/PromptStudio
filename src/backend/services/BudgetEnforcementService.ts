// ============================================================
// Budget Enforcement Service - Epic 3.1
// Manages workspace budgets, run limits, and cost tracking
// ============================================================

import { prisma } from '../lib/prisma.js';

// ============================================================
// Types
// ============================================================

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  remainingBudget?: {
    daily: number;
    perRun: number;
  };
  currentUsage?: {
    activeOptimizationRuns: number;
    activeEvaluationRuns: number;
    dailySpent: number;
  };
}

export interface RunCost {
  calls: number;
  tokens: number;
  usd: number;
}

export interface BudgetConfig {
  maxCalls: number;
  maxTokens: number;
  maxUSD: number;
}

// ============================================================
// Budget Enforcement Service
// ============================================================

export class BudgetEnforcementService {
  /**
   * Get or create workspace policy with default values
   */
  async getOrCreatePolicy(workspaceId: string) {
    let policy = await prisma.workspacePolicy.findUnique({
      where: { workspaceId },
    });

    if (!policy) {
      policy = await prisma.workspacePolicy.create({
        data: {
          workspaceId,
          maxActiveOptimizationRuns: 1,
          maxActiveEvaluationRuns: 2,
          maxCallsPerRun: 100,
          maxTokensPerRun: 100000,
          maxUSDPerRun: 10.0,
          dailyBudgetUSD: 50.0,
          dailyBudgetUsed: 0.0,
          dailyBudgetReset: new Date(),
          requestsPerMinute: 60,
          requestsPerHour: 1000,
        },
      });
    }

    // Check if we need to reset daily budget
    const now = new Date();
    const lastReset = new Date(policy.dailyBudgetReset);
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

    if (hoursSinceReset >= 24) {
      policy = await prisma.workspacePolicy.update({
        where: { workspaceId },
        data: {
          dailyBudgetUsed: 0.0,
          dailyBudgetReset: now,
        },
      });
    }

    return policy;
  }

  /**
   * Check if a new optimization run can be started
   */
  async canStartOptimizationRun(workspaceId: string): Promise<BudgetCheckResult> {
    const policy = await this.getOrCreatePolicy(workspaceId);

    // Count active optimization runs (OptimizationRun uses tenantId, not workspaceId)
    const activeRuns = await prisma.optimizationRun.count({
      where: {
        tenantId: workspaceId,
        status: { in: ['queued', 'running'] },
      },
    });

    if (activeRuns >= policy.maxActiveOptimizationRuns) {
      return {
        allowed: false,
        reason: `Maximum active optimization runs (${policy.maxActiveOptimizationRuns}) reached. Wait for current runs to complete.`,
        currentUsage: {
          activeOptimizationRuns: activeRuns,
          activeEvaluationRuns: 0,
          dailySpent: policy.dailyBudgetUsed,
        },
      };
    }

    // Check daily budget
    const remainingDaily = policy.dailyBudgetUSD - policy.dailyBudgetUsed;
    if (remainingDaily <= 0) {
      return {
        allowed: false,
        reason: `Daily budget exhausted ($${policy.dailyBudgetUSD} USD). Resets in ${this.getTimeUntilReset(policy.dailyBudgetReset)}.`,
        currentUsage: {
          activeOptimizationRuns: activeRuns,
          activeEvaluationRuns: 0,
          dailySpent: policy.dailyBudgetUsed,
        },
      };
    }

    return {
      allowed: true,
      remainingBudget: {
        daily: remainingDaily,
        perRun: policy.maxUSDPerRun,
      },
      currentUsage: {
        activeOptimizationRuns: activeRuns,
        activeEvaluationRuns: 0,
        dailySpent: policy.dailyBudgetUsed,
      },
    };
  }

  /**
   * Check if a new evaluation run can be started
   */
  async canStartEvaluationRun(workspaceId: string): Promise<BudgetCheckResult> {
    const policy = await this.getOrCreatePolicy(workspaceId);

    // Count active evaluation runs
    const activeRuns = await prisma.advancedEvaluationRun.count({
      where: {
        workspaceId,
        status: { in: ['queued', 'running'] },
      },
    });

    if (activeRuns >= policy.maxActiveEvaluationRuns) {
      return {
        allowed: false,
        reason: `Maximum active evaluation runs (${policy.maxActiveEvaluationRuns}) reached. Wait for current runs to complete.`,
        currentUsage: {
          activeOptimizationRuns: 0,
          activeEvaluationRuns: activeRuns,
          dailySpent: policy.dailyBudgetUsed,
        },
      };
    }

    // Check daily budget
    const remainingDaily = policy.dailyBudgetUSD - policy.dailyBudgetUsed;
    if (remainingDaily <= 0) {
      return {
        allowed: false,
        reason: `Daily budget exhausted ($${policy.dailyBudgetUSD} USD). Resets in ${this.getTimeUntilReset(policy.dailyBudgetReset)}.`,
        currentUsage: {
          activeOptimizationRuns: 0,
          activeEvaluationRuns: activeRuns,
          dailySpent: policy.dailyBudgetUsed,
        },
      };
    }

    return {
      allowed: true,
      remainingBudget: {
        daily: remainingDaily,
        perRun: policy.maxUSDPerRun,
      },
      currentUsage: {
        activeOptimizationRuns: 0,
        activeEvaluationRuns: activeRuns,
        dailySpent: policy.dailyBudgetUsed,
      },
    };
  }

  /**
   * Get budget configuration for a run
   */
  async getRunBudget(workspaceId: string): Promise<BudgetConfig> {
    const policy = await this.getOrCreatePolicy(workspaceId);

    return {
      maxCalls: policy.maxCallsPerRun,
      maxTokens: policy.maxTokensPerRun,
      maxUSD: Math.min(
        policy.maxUSDPerRun,
        policy.dailyBudgetUSD - policy.dailyBudgetUsed
      ),
    };
  }

  /**
   * Check if run cost is within budget during execution
   */
  async checkRunBudget(
    workspaceId: string,
    currentCost: RunCost
  ): Promise<{ withinBudget: boolean; message?: string }> {
    const policy = await this.getOrCreatePolicy(workspaceId);

    // Check per-run limits
    if (currentCost.calls >= policy.maxCallsPerRun) {
      return {
        withinBudget: false,
        message: `Run exceeded maximum calls (${policy.maxCallsPerRun})`,
      };
    }

    if (currentCost.tokens >= policy.maxTokensPerRun) {
      return {
        withinBudget: false,
        message: `Run exceeded maximum tokens (${policy.maxTokensPerRun})`,
      };
    }

    if (currentCost.usd >= policy.maxUSDPerRun) {
      return {
        withinBudget: false,
        message: `Run exceeded maximum cost ($${policy.maxUSDPerRun} USD)`,
      };
    }

    // Check daily budget
    const projectedDaily = policy.dailyBudgetUsed + currentCost.usd;
    if (projectedDaily >= policy.dailyBudgetUSD) {
      return {
        withinBudget: false,
        message: `Daily budget exhausted ($${policy.dailyBudgetUSD} USD)`,
      };
    }

    return { withinBudget: true };
  }

  /**
   * Record cost from a completed run
   */
  async recordRunCost(workspaceId: string, cost: RunCost): Promise<void> {
    await prisma.workspacePolicy.update({
      where: { workspaceId },
      data: {
        dailyBudgetUsed: {
          increment: cost.usd,
        },
      },
    });
  }

  /**
   * Update workspace policy
   */
  async updatePolicy(
    workspaceId: string,
    updates: Partial<{
      maxActiveOptimizationRuns: number;
      maxActiveEvaluationRuns: number;
      maxCallsPerRun: number;
      maxTokensPerRun: number;
      maxUSDPerRun: number;
      dailyBudgetUSD: number;
      requestsPerMinute: number;
      requestsPerHour: number;
    }>
  ) {
    return prisma.workspacePolicy.update({
      where: { workspaceId },
      data: updates,
    });
  }

  /**
   * Get usage statistics for a workspace
   */
  async getUsageStats(workspaceId: string) {
    const policy = await this.getOrCreatePolicy(workspaceId);

    const [activeOptRuns, activeEvalRuns, recentOptRuns, recentEvalRuns] = await Promise.all([
      prisma.optimizationRun.count({
        where: { tenantId: workspaceId, status: { in: ['queued', 'running'] } },
      }),
      prisma.advancedEvaluationRun.count({
        where: { workspaceId, status: { in: ['queued', 'running'] } },
      }),
      prisma.optimizationRun.findMany({
        where: { tenantId: workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          budget: true,
          createdAt: true,
          finishedAt: true,
        },
      }),
      prisma.advancedEvaluationRun.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          cost: true,
          createdAt: true,
          finishedAt: true,
        },
      }),
    ]);

    return {
      policy: {
        maxActiveOptimizationRuns: policy.maxActiveOptimizationRuns,
        maxActiveEvaluationRuns: policy.maxActiveEvaluationRuns,
        maxCallsPerRun: policy.maxCallsPerRun,
        maxTokensPerRun: policy.maxTokensPerRun,
        maxUSDPerRun: policy.maxUSDPerRun,
        dailyBudgetUSD: policy.dailyBudgetUSD,
        dailyBudgetUsed: policy.dailyBudgetUsed,
        dailyBudgetReset: policy.dailyBudgetReset,
        requestsPerMinute: policy.requestsPerMinute,
        requestsPerHour: policy.requestsPerHour,
      },
      usage: {
        activeOptimizationRuns: activeOptRuns,
        activeEvaluationRuns: activeEvalRuns,
        dailySpent: policy.dailyBudgetUsed,
        dailyRemaining: policy.dailyBudgetUSD - policy.dailyBudgetUsed,
        resetIn: this.getTimeUntilReset(policy.dailyBudgetReset),
      },
      recentRuns: {
        optimization: recentOptRuns,
        evaluation: recentEvalRuns,
      },
    };
  }

  /**
   * Hard stop a run due to budget violation
   */
  async hardStopRun(
    runType: 'optimization' | 'evaluation',
    runId: string,
    reason: string
  ): Promise<void> {
    if (runType === 'optimization') {
      await prisma.optimizationRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          errorMessage: `Budget exceeded: ${reason}`,
          finishedAt: new Date(),
        },
      });
    } else {
      await prisma.advancedEvaluationRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          errorMessage: `Budget exceeded: ${reason}`,
          finishedAt: new Date(),
        },
      });
    }

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        eventType: 'budget.exceeded',
        entityType: runType === 'optimization' ? 'OptimizationRun' : 'AdvancedEvaluationRun',
        entityId: runId,
        payloadJson: { reason },
      },
    });
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private getTimeUntilReset(resetTime: Date): string {
    const now = new Date();
    const resetDate = new Date(resetTime);
    resetDate.setHours(resetDate.getHours() + 24);

    const diffMs = resetDate.getTime() - now.getTime();
    if (diffMs <= 0) return 'now';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const budgetService = new BudgetEnforcementService();
