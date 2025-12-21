// ============================================================
// Judge Rubrics API Routes - Epic 2.4
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

const criterionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().min(0).max(1),
  scoringGuide: z.string().optional(),
});

const rubricJsonSchema = z.object({
  criteria: z.array(criterionSchema).min(1),
  instructions: z.string().optional(),
  outputFormat: z.enum(['json', 'text']).optional(),
});

const modelConfigSchema = z.object({
  model: z.string().default('gpt-4'),
  temperature: z.number().min(0).max(2).default(0.1),
  maxTokens: z.number().positive().default(1024),
});

const createRubricSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  rubricJson: rubricJsonSchema,
  modelConfig: modelConfigSchema.optional(),
});

const updateRubricSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  rubricJson: rubricJsonSchema.optional(),
  modelConfig: modelConfigSchema.optional(),
});

// ============================================================
// GET /api/rubrics - List all rubrics
// ============================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, limit = '50', offset = '0' } = req.query;

    const where: Prisma.JudgeRubricWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const rubrics = await prisma.judgeRubric.findMany({
      where,
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { evaluationRuns: true } },
      },
    });

    const total = await prisma.judgeRubric.count({ where });

    res.json({
      rubrics: rubrics.map(r => ({
        ...r,
        usageCount: r._count.evaluationRuns,
      })),
      total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('Error listing rubrics:', error);
    res.status(500).json({ error: 'Failed to list rubrics' });
  }
});

// ============================================================
// POST /api/rubrics - Create a new rubric
// ============================================================

router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = createRubricSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const { name, description, rubricJson, modelConfig } = validation.data;

    // Validate weights sum to approximately 1.0
    const totalWeight = rubricJson.criteria.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      return res.status(400).json({
        error: 'Validation error',
        details: [{ message: `Criteria weights must sum to 1.0, got ${totalWeight.toFixed(2)}` }],
      });
    }

    const rubric = await prisma.judgeRubric.create({
      data: {
        name,
        description,
        rubricJson: rubricJson as Prisma.InputJsonValue,
        modelConfig: (modelConfig || { model: 'gpt-4', temperature: 0.1, maxTokens: 1024 }) as Prisma.InputJsonValue,
      },
    });

    res.status(201).json(rubric);
  } catch (error) {
    console.error('Error creating rubric:', error);
    res.status(500).json({ error: 'Failed to create rubric' });
  }
});

// ============================================================
// GET /api/rubrics/:id - Get a single rubric
// ============================================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const rubric = await prisma.judgeRubric.findUnique({
      where: { id },
      include: {
        _count: { select: { evaluationRuns: true } },
        evaluationRuns: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            score: true,
            createdAt: true,
          },
        },
      },
    });

    if (!rubric) {
      return res.status(404).json({ error: 'Rubric not found' });
    }

    res.json({
      ...rubric,
      usageCount: rubric._count.evaluationRuns,
      recentRuns: rubric.evaluationRuns,
    });
  } catch (error) {
    console.error('Error getting rubric:', error);
    res.status(500).json({ error: 'Failed to get rubric' });
  }
});

// ============================================================
// PATCH /api/rubrics/:id - Update a rubric
// ============================================================

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateRubricSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const { rubricJson, ...rest } = validation.data;

    // Validate weights if rubricJson is being updated
    if (rubricJson) {
      const totalWeight = rubricJson.criteria.reduce((sum, c) => sum + c.weight, 0);
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        return res.status(400).json({
          error: 'Validation error',
          details: [{ message: `Criteria weights must sum to 1.0, got ${totalWeight.toFixed(2)}` }],
        });
      }
    }

    const updateData: Prisma.JudgeRubricUpdateInput = { ...rest };
    if (rubricJson) {
      updateData.rubricJson = rubricJson as Prisma.InputJsonValue;
    }
    if (validation.data.modelConfig) {
      updateData.modelConfig = validation.data.modelConfig as Prisma.InputJsonValue;
    }

    const rubric = await prisma.judgeRubric.update({
      where: { id },
      data: updateData,
    });

    res.json(rubric);
  } catch (error) {
    console.error('Error updating rubric:', error);
    res.status(500).json({ error: 'Failed to update rubric' });
  }
});

// ============================================================
// DELETE /api/rubrics/:id - Delete a rubric
// ============================================================

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if rubric is in use
    const usageCount = await prisma.advancedEvaluationRun.count({
      where: { judgeRubricId: id },
    });

    if (usageCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete rubric that is in use',
        usageCount,
      });
    }

    await prisma.judgeRubric.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting rubric:', error);
    res.status(500).json({ error: 'Failed to delete rubric' });
  }
});

// ============================================================
// POST /api/rubrics/:id/validate - Validate rubric JSON
// ============================================================

router.post('/validate', async (req: Request, res: Response) => {
  try {
    const validation = rubricJsonSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        valid: false,
        errors: validation.error.errors,
      });
    }

    const totalWeight = validation.data.criteria.reduce((sum, c) => sum + c.weight, 0);

    res.json({
      valid: true,
      criteriaCount: validation.data.criteria.length,
      totalWeight,
      weightsValid: Math.abs(totalWeight - 1.0) <= 0.01,
    });
  } catch (error) {
    console.error('Error validating rubric:', error);
    res.status(500).json({ error: 'Failed to validate rubric' });
  }
});

export default router;
