// ============================================================
// Techniques API Routes - Epic 4.2
// CRUD operations for prompt engineering techniques
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { techniquesService, TechniqueCategory } from '../../services/TechniquesService.js';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

const categoryEnum = z.enum([
  'output_structuring',
  'role_instruction',
  'few_shot_demos',
  'evaluation_robustness',
]);

const createTechniqueSchema = z.object({
  name: z.string().min(1).max(100),
  descriptionShort: z.string().min(1).max(500),
  descriptionFull: z.string().optional(),
  category: categoryEnum,
  tags: z.array(z.string()).optional(),
  whenToUse: z.string().optional(),
  antiPatternExample: z.string().optional(),
  goodExample: z.string().optional(),
  applyPatchJson: z.object({
    operations: z.array(z.object({
      path: z.string(),
      value: z.string(),
      insertPosition: z.enum(['before', 'after', 'replace']).optional(),
    })),
  }).optional(),
});

const updateTechniqueSchema = createTechniqueSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ============================================================
// GET /api/techniques - List all techniques
// ============================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, tags, isBuiltIn, isActive, workspaceId, search } = req.query;

    const filters = {
      category: category as TechniqueCategory | undefined,
      tags: tags ? (tags as string).split(',') : undefined,
      isBuiltIn: isBuiltIn === 'true' ? true : isBuiltIn === 'false' ? false : undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      workspaceId: workspaceId as string | undefined,
      search: search as string | undefined,
    };

    const techniques = await techniquesService.listTechniques(filters);

    res.json({
      techniques,
      count: techniques.length,
    });
  } catch (error) {
    console.error('Error listing techniques:', error);
    res.status(500).json({ error: 'Failed to list techniques' });
  }
});

// ============================================================
// GET /api/techniques/grouped - Get techniques grouped by category
// ============================================================

router.get('/grouped', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.query;

    const grouped = await techniquesService.getTechniquesGrouped(workspaceId as string);

    res.json({
      categories: [
        {
          id: 'output_structuring',
          name: 'Output Structuring',
          description: 'Techniques for controlling the format and structure of model outputs',
          techniques: grouped.output_structuring,
        },
        {
          id: 'role_instruction',
          name: 'Role & Instruction Hygiene',
          description: 'Techniques for setting up effective personas and clear instructions',
          techniques: grouped.role_instruction,
        },
        {
          id: 'few_shot_demos',
          name: 'Few-Shot & Demonstrations',
          description: 'Techniques for teaching by example and demonstration',
          techniques: grouped.few_shot_demos,
        },
        {
          id: 'evaluation_robustness',
          name: 'Evaluation & Robustness',
          description: 'Techniques for improving accuracy and handling edge cases',
          techniques: grouped.evaluation_robustness,
        },
      ],
    });
  } catch (error) {
    console.error('Error getting grouped techniques:', error);
    res.status(500).json({ error: 'Failed to get techniques' });
  }
});

// ============================================================
// GET /api/techniques/:id - Get a single technique
// ============================================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const technique = await techniquesService.getTechniqueById(id);

    if (!technique) {
      return res.status(404).json({ error: 'Technique not found' });
    }

    res.json({ technique });
  } catch (error) {
    console.error('Error getting technique:', error);
    res.status(500).json({ error: 'Failed to get technique' });
  }
});

// ============================================================
// POST /api/techniques - Create a new technique
// ============================================================

router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = createTechniqueSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const { workspaceId, createdById } = req.body;

    const technique = await techniquesService.createTechnique({
      ...validation.data,
      workspaceId,
      createdById,
    });

    res.status(201).json({ technique });
  } catch (error) {
    console.error('Error creating technique:', error);
    if ((error as Error).message.includes('Unique constraint')) {
      return res.status(409).json({ error: 'A technique with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create technique' });
  }
});

// ============================================================
// PATCH /api/techniques/:id - Update a technique
// ============================================================

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const validation = updateTechniqueSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const technique = await techniquesService.updateTechnique(id, validation.data);

    res.json({ technique });
  } catch (error) {
    console.error('Error updating technique:', error);
    if ((error as Error).message.includes('Cannot modify built-in')) {
      return res.status(403).json({ error: 'Cannot modify built-in techniques' });
    }
    res.status(500).json({ error: 'Failed to update technique' });
  }
});

// ============================================================
// DELETE /api/techniques/:id - Delete a technique (soft delete)
// ============================================================

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await techniquesService.deleteTechnique(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting technique:', error);
    if ((error as Error).message.includes('Cannot delete built-in')) {
      return res.status(403).json({ error: 'Cannot delete built-in techniques' });
    }
    res.status(500).json({ error: 'Failed to delete technique' });
  }
});

// ============================================================
// POST /api/techniques/apply - Apply technique to prompt
// ============================================================

router.post('/apply', async (req: Request, res: Response) => {
  try {
    const { techniqueId, prompt } = req.body;

    if (!techniqueId) {
      return res.status(400).json({ error: 'techniqueId is required' });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const technique = await techniquesService.getTechniqueById(techniqueId);

    if (!technique) {
      return res.status(404).json({ error: 'Technique not found' });
    }

    const result = techniquesService.applyTechniqueToPrompt(prompt, technique);

    res.json({
      original: prompt,
      applied: result,
      technique: {
        id: technique.id,
        name: technique.name,
      },
    });
  } catch (error) {
    console.error('Error applying technique:', error);
    res.status(500).json({ error: 'Failed to apply technique' });
  }
});

// ============================================================
// POST /api/techniques/apply-multiple - Apply multiple techniques
// ============================================================

router.post('/apply-multiple', async (req: Request, res: Response) => {
  try {
    const { techniqueIds, prompt } = req.body;

    if (!techniqueIds || !Array.isArray(techniqueIds) || techniqueIds.length === 0) {
      return res.status(400).json({ error: 'techniqueIds array is required' });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    let result = { ...prompt };
    const appliedTechniques: Array<{ id: string; name: string }> = [];

    for (const techniqueId of techniqueIds) {
      const technique = await techniquesService.getTechniqueById(techniqueId);
      if (technique && technique.isActive) {
        result = techniquesService.applyTechniqueToPrompt(result, technique);
        appliedTechniques.push({
          id: technique.id,
          name: technique.name,
        });
      }
    }

    res.json({
      original: prompt,
      applied: result,
      appliedTechniques,
    });
  } catch (error) {
    console.error('Error applying techniques:', error);
    res.status(500).json({ error: 'Failed to apply techniques' });
  }
});

// ============================================================
// POST /api/techniques/seed - Seed built-in techniques
// ============================================================

router.post('/seed', async (req: Request, res: Response) => {
  try {
    const result = await techniquesService.seedBuiltInTechniques();

    res.json({
      success: true,
      message: `Seeded ${result.seeded} built-in techniques`,
      ...result,
    });
  } catch (error) {
    console.error('Error seeding techniques:', error);
    res.status(500).json({ error: 'Failed to seed techniques' });
  }
});

export default router;
