// ============================================================
// Evaluation Datasets API Routes - Epic 0.4
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

const datasetConfigSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  taskType: z.string().max(255).optional(),
  format: z.enum(['labeled', 'unlabeled']).default('labeled'),
  judgeRubricId: z.string().uuid().optional(),
}).strict();

const datasetUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  taskType: z.string().max(255).optional(),
  format: z.enum(['labeled', 'unlabeled']).optional(),
  judgeRubricId: z.string().uuid().nullable().optional(),
}).strict();

const labeledExampleSchema = z.object({
  inputVariables: z.record(z.unknown()),
  expectedOutput: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
}).strict();

const unlabeledExampleSchema = z.object({
  inputVariables: z.record(z.unknown()),
  expectedOutput: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

// ============================================================
// GET /api/datasets - List all datasets
// ============================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const { format, taskType, search, limit = '50', offset = '0' } = req.query;

    const where: Record<string, unknown> = {};

    if (format) {
      where.format = format as string;
    }

    if (taskType) {
      where.taskType = taskType as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const datasets = await prisma.evaluationDataset.findMany({
      where,
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { examples: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const total = await prisma.evaluationDataset.count({ where });

    res.json({
      datasets: datasets.map(d => ({
        ...d,
        exampleCount: d._count.examples,
      })),
      total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('Error listing datasets:', error);
    res.status(500).json({ error: 'Failed to list datasets' });
  }
});

// ============================================================
// POST /api/datasets - Create a new dataset
// ============================================================

router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = datasetConfigSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    if (validation.data.judgeRubricId) {
      const rubric = await prisma.judgeRubric.findUnique({
        where: { id: validation.data.judgeRubricId },
      });
      if (!rubric) {
        return res.status(400).json({ error: 'Judge rubric not found' });
      }
    }

    const dataset = await prisma.evaluationDataset.create({
      data: validation.data,
    });

    res.status(201).json(dataset);
  } catch (error) {
    console.error('Error creating dataset:', error);
    res.status(500).json({ error: 'Failed to create dataset' });
  }
});

// ============================================================
// GET /api/datasets/:id - Get a single dataset
// ============================================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const dataset = await prisma.evaluationDataset.findUnique({
      where: { id },
      include: {
        _count: {
          select: { examples: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    if (dataset.format === 'labeled' && !expectedOutputColumn) {
      return res.status(400).json({ error: 'Expected output column is required for labeled datasets' });
    }

    res.json({
      ...dataset,
      exampleCount: dataset._count.examples,
    });
  } catch (error) {
    console.error('Error getting dataset:', error);
    res.status(500).json({ error: 'Failed to get dataset' });
  }
});

// ============================================================
// PATCH /api/datasets/:id - Update a dataset
// ============================================================

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = datasetUpdateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    if (validation.data.judgeRubricId) {
      const rubric = await prisma.judgeRubric.findUnique({
        where: { id: validation.data.judgeRubricId },
      });
      if (!rubric) {
        return res.status(400).json({ error: 'Judge rubric not found' });
      }
    }

    const dataset = await prisma.evaluationDataset.update({
      where: { id },
      data: validation.data,
    });

    res.json(dataset);
  } catch (error) {
    console.error('Error updating dataset:', error);
    res.status(500).json({ error: 'Failed to update dataset' });
  }
});

// ============================================================
// DELETE /api/datasets/:id - Delete a dataset
// ============================================================

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.evaluationDataset.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting dataset:', error);
    res.status(500).json({ error: 'Failed to delete dataset' });
  }
});

// ============================================================
// POST /api/datasets/:id/examples/import - Import examples
// ============================================================

router.post('/:id/examples/import', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Verify dataset exists
    const dataset = await prisma.evaluationDataset.findUnique({
      where: { id },
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const exampleSchema = dataset.format === 'labeled' ? labeledExampleSchema : unlabeledExampleSchema;
    const importExamplesSchema = z.object({
      examples: z.array(exampleSchema),
    }).strict();

    const validation = importExamplesSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    // Create all examples
    const createData = validation.data.examples.map(example => ({
      datasetId: id,
      inputVariables: example.inputVariables as Prisma.InputJsonValue,
      expectedOutput: example.expectedOutput,
      metadata: example.metadata as Prisma.InputJsonValue | undefined,
    }));

    const result = await prisma.datasetExample.createMany({
      data: createData,
    });

    res.status(201).json({
      imported: result.count,
      total: await prisma.datasetExample.count({ where: { datasetId: id } }),
    });
  } catch (error) {
    console.error('Error importing examples:', error);
    res.status(500).json({ error: 'Failed to import examples' });
  }
});

// ============================================================
// GET /api/datasets/:id/examples - List examples with pagination
// ============================================================

router.get('/:id/examples', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const examples = await prisma.datasetExample.findMany({
      where: { datasetId: id },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.datasetExample.count({
      where: { datasetId: id },
    });

    res.json({
      examples,
      total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('Error listing examples:', error);
    res.status(500).json({ error: 'Failed to list examples' });
  }
});

// ============================================================
// POST /api/datasets/:id/examples - Add a single example
// ============================================================

router.post('/:id/examples', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dataset = await prisma.evaluationDataset.findUnique({
      where: { id },
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const exampleSchema = dataset.format === 'labeled' ? labeledExampleSchema : unlabeledExampleSchema;
    const validation = exampleSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const example = await prisma.datasetExample.create({
      data: {
        datasetId: id,
        inputVariables: validation.data.inputVariables as Prisma.InputJsonValue,
        expectedOutput: validation.data.expectedOutput,
        metadata: validation.data.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    res.status(201).json(example);
  } catch (error) {
    console.error('Error creating example:', error);
    res.status(500).json({ error: 'Failed to create example' });
  }
});

// ============================================================
// DELETE /api/datasets/:id/examples/:exampleId - Delete an example
// ============================================================

router.delete('/:id/examples/:exampleId', async (req: Request, res: Response) => {
  try {
    const { exampleId } = req.params;

    await prisma.datasetExample.delete({
      where: { id: exampleId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting example:', error);
    res.status(500).json({ error: 'Failed to delete example' });
  }
});

// ============================================================
// POST /api/datasets/:id/examples/import-csv - Import from CSV
// ============================================================

router.post('/:id/examples/import-csv', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { csvData, variableColumns, expectedOutputColumn } = req.body;

    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({ error: 'Invalid CSV data format' });
    }

    // Verify dataset exists
    const dataset = await prisma.evaluationDataset.findUnique({
      where: { id },
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    // Transform CSV rows to examples
    const examples = csvData.map((row: Record<string, string>) => {
      const inputVariables: Record<string, unknown> = {};

      // Map specified columns to input variables
      if (variableColumns && Array.isArray(variableColumns)) {
        for (const col of variableColumns) {
          if (col in row) {
            inputVariables[col] = row[col];
          }
        }
      } else {
        // Use all columns except expected output
        for (const [key, value] of Object.entries(row)) {
          if (key !== expectedOutputColumn) {
            inputVariables[key] = value;
          }
        }
      }

      return {
        datasetId: id,
        inputVariables: inputVariables as Prisma.InputJsonValue,
        expectedOutput: expectedOutputColumn ? row[expectedOutputColumn] : undefined,
      };
    });

    const result = await prisma.datasetExample.createMany({
      data: examples,
    });

    res.status(201).json({
      imported: result.count,
      total: await prisma.datasetExample.count({ where: { datasetId: id } }),
    });
  } catch (error) {
    console.error('Error importing CSV:', error);
    res.status(500).json({ error: 'Failed to import CSV data' });
  }
});

export default router;
