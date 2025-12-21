// ============================================================
// Budget & Policy API Routes - Epic 3.1
// Manage workspace budgets and usage policies
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { budgetService } from '../../services/BudgetEnforcementService.js';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

const updatePolicySchema = z.object({
  maxActiveOptimizationRuns: z.number().int().min(1).max(10).optional(),
  maxActiveEvaluationRuns: z.number().int().min(1).max(10).optional(),
  maxCallsPerRun: z.number().int().min(10).max(10000).optional(),
  maxTokensPerRun: z.number().int().min(1000).max(1000000).optional(),
  maxUSDPerRun: z.number().min(0.1).max(100).optional(),
  dailyBudgetUSD: z.number().min(1).max(1000).optional(),
  requestsPerMinute: z.number().int().min(10).max(1000).optional(),
  requestsPerHour: z.number().int().min(100).max(10000).optional(),
});

// ============================================================
// GET /api/budget - Get current budget status and policy
// ============================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    // In a real app, get workspaceId from authenticated user
    const workspaceId = (req.query.workspaceId as string) || 'default-workspace';

    const stats = await budgetService.getUsageStats(workspaceId);

    res.json(stats);
  } catch (error) {
    console.error('Error getting budget status:', error);
    res.status(500).json({ error: 'Failed to get budget status' });
  }
});

// ============================================================
// GET /api/budget/check/optimization - Check if optimization run allowed
// ============================================================

router.get('/check/optimization', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'default-workspace';

    const result = await budgetService.canStartOptimizationRun(workspaceId);

    res.json(result);
  } catch (error) {
    console.error('Error checking optimization budget:', error);
    res.status(500).json({ error: 'Failed to check budget' });
  }
});

// ============================================================
// GET /api/budget/check/evaluation - Check if evaluation run allowed
// ============================================================

router.get('/check/evaluation', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'default-workspace';

    const result = await budgetService.canStartEvaluationRun(workspaceId);

    res.json(result);
  } catch (error) {
    console.error('Error checking evaluation budget:', error);
    res.status(500).json({ error: 'Failed to check budget' });
  }
});

// ============================================================
// GET /api/budget/run-budget - Get budget limits for a new run
// ============================================================

router.get('/run-budget', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'default-workspace';

    const budget = await budgetService.getRunBudget(workspaceId);

    res.json(budget);
  } catch (error) {
    console.error('Error getting run budget:', error);
    res.status(500).json({ error: 'Failed to get run budget' });
  }
});

// ============================================================
// PATCH /api/budget/policy - Update workspace policy
// ============================================================

router.patch('/policy', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'default-workspace';

    const validation = updatePolicySchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const updatedPolicy = await budgetService.updatePolicy(workspaceId, validation.data);

    res.json({
      success: true,
      policy: updatedPolicy,
    });
  } catch (error) {
    console.error('Error updating policy:', error);
    res.status(500).json({ error: 'Failed to update policy' });
  }
});

// ============================================================
// POST /api/budget/reset-daily - Reset daily budget (admin only)
// ============================================================

router.post('/reset-daily', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'default-workspace';

    // In production, verify admin permissions here
    const policy = await budgetService.getOrCreatePolicy(workspaceId);

    const { prisma } = await import('../../lib/prisma.js');
    await prisma.workspacePolicy.update({
      where: { workspaceId },
      data: {
        dailyBudgetUsed: 0,
        dailyBudgetReset: new Date(),
      },
    });

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        eventType: 'budget.reset',
        entityType: 'WorkspacePolicy',
        entityId: policy.id,
        payloadJson: { workspaceId, resetBy: 'admin' },
      },
    });

    res.json({ success: true, message: 'Daily budget reset successfully' });
  } catch (error) {
    console.error('Error resetting daily budget:', error);
    res.status(500).json({ error: 'Failed to reset daily budget' });
  }
});

export default router;
