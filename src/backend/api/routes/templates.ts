// ============================================================
// Prompt Templates API Routes - Epic 0.4
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';
import type {
  TemplateContentSnapshot,
  PromptTemplate,
  TemplateVersion,
} from '../../../shared/types/dspy';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

const contentSnapshotSchema = z.object({
  system: z.string(),
  developer: z.string().optional(),
  user: z.string(),
  context: z.string().optional(),
  variablesSchema: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    description: z.string().optional(),
    required: z.boolean().optional(),
    defaultValue: z.unknown().optional(),
  })).optional(),
  defaultValues: z.record(z.unknown()).optional(),
  modelConfig: z.object({
    model: z.string(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    topP: z.number().optional(),
    frequencyPenalty: z.number().optional(),
    presencePenalty: z.number().optional(),
  }).optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  contentSnapshot: contentSnapshotSchema,
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const createVersionSchema = z.object({
  contentSnapshot: contentSnapshotSchema,
});

// ============================================================
// GET /api/templates - List all templates
// ============================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, search, limit = '50', offset = '0' } = req.query;

    const where: Record<string, unknown> = {};

    if (category) {
      where.category = category as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const templates = await prisma.promptTemplate.findMany({
      where,
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: {
          where: { isActive: true },
          take: 1,
        },
        _count: {
          select: { versions: true },
        },
      },
    });

    const total = await prisma.promptTemplate.count({ where });

    res.json({
      templates: templates.map(t => ({
        ...t,
        activeVersion: t.versions[0] || null,
        versionCount: t._count.versions,
      })),
      total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

// ============================================================
// POST /api/templates - Create a new template
// ============================================================

router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = createTemplateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const { name, description, category, tags, contentSnapshot } = validation.data;

    // Create template first
    const createdTemplate = await prisma.promptTemplate.create({
      data: {
        name,
        description,
        category,
        tags,
      },
    });

    // Create initial version
    const initialVersion = await prisma.templateVersion.create({
      data: {
        templateId: createdTemplate.id,
        versionNumber: 1,
        contentSnapshot: contentSnapshot as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    // Set active version
    const template = await prisma.promptTemplate.update({
      where: { id: createdTemplate.id },
      data: { activeVersionId: initialVersion.id },
      include: {
        versions: true,
      },
    });

    res.status(201).json({
      ...template,
      activeVersion: initialVersion,
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// ============================================================
// GET /api/templates/:id - Get a single template
// ============================================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const template = await prisma.promptTemplate.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 10,
        },
        _count: {
          select: { versions: true },
        },
      },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const activeVersion = template.versions.find(v => v.isActive) || template.versions[0];

    res.json({
      ...template,
      activeVersion,
      versionCount: template._count.versions,
    });
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

// ============================================================
// PATCH /api/templates/:id - Update a template
// ============================================================

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateTemplateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const template = await prisma.promptTemplate.update({
      where: { id },
      data: validation.data,
      include: {
        versions: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    res.json({
      ...template,
      activeVersion: template.versions[0] || null,
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// ============================================================
// DELETE /api/templates/:id - Delete a template
// ============================================================

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.promptTemplate.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// ============================================================
// GET /api/templates/:id/versions - List all versions
// ============================================================

router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const versions = await prisma.templateVersion.findMany({
      where: { templateId: id },
      orderBy: { versionNumber: 'desc' },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const total = await prisma.templateVersion.count({
      where: { templateId: id },
    });

    res.json({
      versions,
      total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('Error listing versions:', error);
    res.status(500).json({ error: 'Failed to list versions' });
  }
});

// ============================================================
// POST /api/templates/:id/versions - Create a new version
// ============================================================

router.post('/:id/versions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = createVersionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    // Get the latest version number
    const latestVersion = await prisma.templateVersion.findFirst({
      where: { templateId: id },
      orderBy: { versionNumber: 'desc' },
    });

    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    const version = await prisma.templateVersion.create({
      data: {
        templateId: id,
        versionNumber: newVersionNumber,
        contentSnapshot: validation.data.contentSnapshot as unknown as Prisma.InputJsonValue,
        isActive: false,
      },
    });

    res.status(201).json(version);
  } catch (error) {
    console.error('Error creating version:', error);
    res.status(500).json({ error: 'Failed to create version' });
  }
});

// ============================================================
// POST /api/templates/:id/versions/:versionId/activate - Activate a version
// ============================================================

router.post('/:id/versions/:versionId/activate', async (req: Request, res: Response) => {
  try {
    const { id, versionId } = req.params;

    // Deactivate all versions for this template
    await prisma.templateVersion.updateMany({
      where: { templateId: id },
      data: { isActive: false },
    });

    // Activate the specified version
    const version = await prisma.templateVersion.update({
      where: { id: versionId },
      data: { isActive: true },
    });

    // Update template's activeVersionId
    await prisma.promptTemplate.update({
      where: { id },
      data: { activeVersionId: versionId },
    });

    res.json(version);
  } catch (error) {
    console.error('Error activating version:', error);
    res.status(500).json({ error: 'Failed to activate version' });
  }
});

// ============================================================
// GET /api/templates/:id/versions/:versionId - Get a specific version
// ============================================================

router.get('/:id/versions/:versionId', async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;

    const version = await prisma.templateVersion.findUnique({
      where: { id: versionId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json(version);
  } catch (error) {
    console.error('Error getting version:', error);
    res.status(500).json({ error: 'Failed to get version' });
  }
});

export default router;
