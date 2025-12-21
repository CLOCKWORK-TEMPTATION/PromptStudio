// ============================================================
// Import/Export API Routes - Epic 5.3
// Bundle import and export endpoints
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { importExportService } from '../../services/ImportExportService.js';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

const exportBundleSchema = z.object({
  templateIds: z.array(z.string().uuid()).optional(),
  datasetIds: z.array(z.string().uuid()).optional(),
  rubricIds: z.array(z.string().uuid()).optional(),
});

const importOptionsSchema = z.object({
  overwriteExisting: z.boolean().optional(),
  nameSuffix: z.string().optional(),
  workspaceId: z.string().uuid().optional(),
});

// ============================================================
// GET /api/export/template/:id - Export a single template
// ============================================================

router.get('/export/template/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const bundle = await importExportService.exportTemplate(id);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="template-${id}.json"`
    );
    res.json(bundle);
  } catch (error) {
    console.error('Error exporting template:', error);
    if ((error as Error).message === 'Template not found') {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.status(500).json({ error: 'Failed to export template' });
  }
});

// ============================================================
// GET /api/export/dataset/:id - Export a single dataset
// ============================================================

router.get('/export/dataset/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const bundle = await importExportService.exportDataset(id);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="dataset-${id}.json"`
    );
    res.json(bundle);
  } catch (error) {
    console.error('Error exporting dataset:', error);
    if ((error as Error).message === 'Dataset not found') {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    res.status(500).json({ error: 'Failed to export dataset' });
  }
});

// ============================================================
// GET /api/export/rubric/:id - Export a single rubric
// ============================================================

router.get('/export/rubric/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const bundle = await importExportService.exportRubric(id);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rubric-${id}.json"`
    );
    res.json(bundle);
  } catch (error) {
    console.error('Error exporting rubric:', error);
    if ((error as Error).message === 'Rubric not found') {
      return res.status(404).json({ error: 'Rubric not found' });
    }
    res.status(500).json({ error: 'Failed to export rubric' });
  }
});

// ============================================================
// POST /api/export/bundle - Export multiple entities
// ============================================================

router.post('/export/bundle', async (req: Request, res: Response) => {
  try {
    const validation = exportBundleSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const { templateIds, datasetIds, rubricIds } = validation.data;
    const userId = (req as any).userId;

    const bundle = await importExportService.exportBundle(
      templateIds,
      datasetIds,
      rubricIds,
      userId
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="promptstudio-bundle-${Date.now()}.json"`
    );
    res.json(bundle);
  } catch (error) {
    console.error('Error exporting bundle:', error);
    res.status(500).json({ error: 'Failed to export bundle' });
  }
});

// ============================================================
// POST /api/import/validate - Validate a bundle without importing
// ============================================================

router.post('/import/validate', async (req: Request, res: Response) => {
  try {
    const { bundle } = req.body;

    if (!bundle) {
      return res.status(400).json({ error: 'bundle is required' });
    }

    const result = importExportService.validateBundle(bundle);

    res.json(result);
  } catch (error) {
    console.error('Error validating bundle:', error);
    res.status(500).json({ error: 'Failed to validate bundle' });
  }
});

// ============================================================
// POST /api/import/bundle - Import a bundle
// ============================================================

router.post('/import/bundle', async (req: Request, res: Response) => {
  try {
    const { bundle, options } = req.body;

    if (!bundle) {
      return res.status(400).json({ error: 'bundle is required' });
    }

    // Validate options if provided
    let importOptions: z.infer<typeof importOptionsSchema> = {};
    if (options) {
      const optionsValidation = importOptionsSchema.safeParse(options);
      if (!optionsValidation.success) {
        return res.status(400).json({
          error: 'Invalid options',
          details: optionsValidation.error.errors,
        });
      }
      importOptions = optionsValidation.data;
    }

    const userId = (req as any).userId;

    const result = await importExportService.importBundle(bundle, {
      workspaceId: importOptions.workspaceId,
      userId,
      overwriteExisting: importOptions.overwriteExisting,
      nameSuffix: importOptions.nameSuffix,
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error importing bundle:', error);
    res.status(500).json({ error: 'Failed to import bundle' });
  }
});

// ============================================================
// GET /api/import/template/:id - Get template structure (for preview)
// ============================================================

router.get('/import/preview/template/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const bundle = await importExportService.exportTemplate(id);

    // Return just the template data for preview
    res.json({
      template: bundle.data.templates?.[0],
      versionCount: bundle.data.templates?.[0]?.versions.length || 0,
    });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

export default router;
