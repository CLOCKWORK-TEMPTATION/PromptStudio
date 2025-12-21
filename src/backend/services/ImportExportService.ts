// ============================================================
// Import/Export Service - Epic 5.3
// JSON bundle format for templates, datasets, and rubrics
// ============================================================

import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

// ============================================================
// Types
// ============================================================

export interface ExportBundle {
  version: string;
  exportedAt: string;
  exportedBy?: string;
  type: 'template' | 'dataset' | 'rubric' | 'full';
  data: {
    templates?: TemplateExport[];
    datasets?: DatasetExport[];
    rubrics?: RubricExport[];
    techniques?: TechniqueExport[];
  };
  metadata?: Record<string, unknown>;
}

export interface TemplateExport {
  name: string;
  description?: string | null;
  category?: string | null;
  tags: string[];
  versions: {
    versionNumber: number;
    content: Record<string, unknown>;
    isActive: boolean;
    createdAt: string;
  }[];
}

export interface DatasetExport {
  name: string;
  description?: string | null;
  taskType?: string | null;
  format: string;
  examples: {
    inputVariables: Record<string, unknown>;
    expectedOutput?: string | null;
    metadata?: Record<string, unknown>;
  }[];
}

export interface RubricExport {
  name: string;
  description?: string | null;
  rubric: Record<string, unknown>;
  modelConfig: Record<string, unknown>;
}

export interface TechniqueExport {
  name: string;
  descriptionShort: string;
  descriptionFull?: string | null;
  category: string;
  tags: string[];
  whenToUse?: string | null;
  antiPatternExample?: string | null;
  goodExample?: string | null;
  applyPatchJson?: Record<string, unknown>;
}

export interface ImportResult {
  success: boolean;
  imported: {
    templates: number;
    datasets: number;
    rubrics: number;
    techniques: number;
  };
  errors: {
    entity: string;
    name: string;
    error: string;
  }[];
  warnings: string[];
}

// ============================================================
// Validation Schemas
// ============================================================

const templateVersionSchema = z.object({
  versionNumber: z.number(),
  content: z.record(z.unknown()),
  isActive: z.boolean().optional(),
  createdAt: z.string().optional(),
});

const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  versions: z.array(templateVersionSchema).min(1),
});

const datasetExampleSchema = z.object({
  inputVariables: z.record(z.unknown()),
  expectedOutput: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const datasetSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  taskType: z.string().nullable().optional(),
  format: z.string().optional().default('labeled'),
  examples: z.array(datasetExampleSchema),
});

const rubricSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  rubric: z.record(z.unknown()),
  modelConfig: z.record(z.unknown()).optional().default({}),
});

const techniqueSchema = z.object({
  name: z.string().min(1),
  descriptionShort: z.string(),
  descriptionFull: z.string().nullable().optional(),
  category: z.string(),
  tags: z.array(z.string()).optional().default([]),
  whenToUse: z.string().nullable().optional(),
  antiPatternExample: z.string().nullable().optional(),
  goodExample: z.string().nullable().optional(),
  applyPatchJson: z.record(z.unknown()).nullable().optional(),
});

const bundleSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  type: z.enum(['template', 'dataset', 'rubric', 'full', 'technique']),
  data: z.object({
    templates: z.array(templateSchema).optional(),
    datasets: z.array(datasetSchema).optional(),
    rubrics: z.array(rubricSchema).optional(),
    techniques: z.array(techniqueSchema).optional(),
  }),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================
// Import/Export Service
// ============================================================

export class ImportExportService {
  private readonly BUNDLE_VERSION = '1.0.0';

  /**
   * Export a template with all versions
   */
  async exportTemplate(templateId: string): Promise<ExportBundle> {
    const template = await prisma.promptTemplate.findUnique({
      where: { id: templateId },
      include: {
        versions: {
          orderBy: { versionNumber: 'asc' },
        },
      },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    return {
      version: this.BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      type: 'template',
      data: {
        templates: [
          {
            name: template.name,
            description: template.description,
            category: template.category,
            tags: template.tags,
            versions: template.versions.map(v => ({
              versionNumber: v.versionNumber,
              content: v.contentSnapshot as Record<string, unknown>,
              isActive: v.isActive,
              createdAt: v.createdAt.toISOString(),
            })),
          },
        ],
      },
    };
  }

  /**
   * Export a dataset with examples
   */
  async exportDataset(datasetId: string): Promise<ExportBundle> {
    const dataset = await prisma.evaluationDataset.findUnique({
      where: { id: datasetId },
      include: {
        examples: true,
      },
    });

    if (!dataset) {
      throw new Error('Dataset not found');
    }

    return {
      version: this.BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      type: 'dataset',
      data: {
        datasets: [
          {
            name: dataset.name,
            description: dataset.description,
            taskType: dataset.taskType,
            format: dataset.format,
            examples: dataset.examples.map(e => ({
              inputVariables: e.inputVariables as Record<string, unknown>,
              expectedOutput: e.expectedOutput,
              metadata: (e.metadata as Record<string, unknown>) || undefined,
            })),
          },
        ],
      },
    };
  }

  /**
   * Export a rubric
   */
  async exportRubric(rubricId: string): Promise<ExportBundle> {
    const rubric = await prisma.judgeRubric.findUnique({
      where: { id: rubricId },
    });

    if (!rubric) {
      throw new Error('Rubric not found');
    }

    return {
      version: this.BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      type: 'rubric',
      data: {
        rubrics: [
          {
            name: rubric.name,
            description: rubric.description,
            rubric: rubric.rubricJson as Record<string, unknown>,
            modelConfig: rubric.modelConfig as Record<string, unknown>,
          },
        ],
      },
    };
  }

  /**
   * Export multiple entities as a full bundle
   */
  async exportBundle(
    templateIds?: string[],
    datasetIds?: string[],
    rubricIds?: string[],
    exportedBy?: string
  ): Promise<ExportBundle> {
    const bundle: ExportBundle = {
      version: this.BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy,
      type: 'full',
      data: {},
    };

    // Export templates
    if (templateIds && templateIds.length > 0) {
      const templates = await prisma.promptTemplate.findMany({
        where: { id: { in: templateIds } },
        include: { versions: { orderBy: { versionNumber: 'asc' } } },
      });

      bundle.data.templates = templates.map(t => ({
        name: t.name,
        description: t.description,
        category: t.category,
        tags: t.tags,
        versions: t.versions.map(v => ({
          versionNumber: v.versionNumber,
          content: v.contentSnapshot as Record<string, unknown>,
          isActive: v.isActive,
          createdAt: v.createdAt.toISOString(),
        })),
      }));
    }

    // Export datasets
    if (datasetIds && datasetIds.length > 0) {
      const datasets = await prisma.evaluationDataset.findMany({
        where: { id: { in: datasetIds } },
        include: { examples: true },
      });

      bundle.data.datasets = datasets.map(d => ({
        name: d.name,
        description: d.description,
        taskType: d.taskType,
        format: d.format,
        examples: d.examples.map(e => ({
          inputVariables: e.inputVariables as Record<string, unknown>,
          expectedOutput: e.expectedOutput,
          metadata: (e.metadata as Record<string, unknown>) || undefined,
        })),
      }));
    }

    // Export rubrics
    if (rubricIds && rubricIds.length > 0) {
      const rubrics = await prisma.judgeRubric.findMany({
        where: { id: { in: rubricIds } },
      });

      bundle.data.rubrics = rubrics.map(r => ({
        name: r.name,
        description: r.description,
        rubric: r.rubricJson as Record<string, unknown>,
        modelConfig: r.modelConfig as Record<string, unknown>,
      }));
    }

    return bundle;
  }

  /**
   * Import a bundle
   */
  async importBundle(
    bundle: unknown,
    options: {
      workspaceId?: string;
      userId?: string;
      overwriteExisting?: boolean;
      nameSuffix?: string;
    } = {}
  ): Promise<ImportResult> {
    // Validate bundle schema
    const validation = bundleSchema.safeParse(bundle);
    if (!validation.success) {
      return {
        success: false,
        imported: { templates: 0, datasets: 0, rubrics: 0, techniques: 0 },
        errors: [
          {
            entity: 'bundle',
            name: 'root',
            error: `Invalid bundle format: ${validation.error.message}`,
          },
        ],
        warnings: [],
      };
    }

    const validBundle = validation.data;
    const result: ImportResult = {
      success: true,
      imported: { templates: 0, datasets: 0, rubrics: 0, techniques: 0 },
      errors: [],
      warnings: [],
    };

    const suffix = options.nameSuffix || '';

    // Import templates
    if (validBundle.data.templates) {
      for (const templateData of validBundle.data.templates) {
        try {
          const name = templateData.name + suffix;

          // Check for existing
          const existing = await prisma.promptTemplate.findFirst({
            where: {
              name,
              tenantId: options.workspaceId || null,
            },
          });

          if (existing && !options.overwriteExisting) {
            result.warnings.push(`Template "${name}" already exists, skipped`);
            continue;
          }

          // Create or update template
          const template = existing
            ? await prisma.promptTemplate.update({
                where: { id: existing.id },
                data: {
                  description: templateData.description,
                  category: templateData.category,
                  tags: templateData.tags,
                },
              })
            : await prisma.promptTemplate.create({
                data: {
                  name,
                  description: templateData.description,
                  category: templateData.category,
                  tags: templateData.tags,
                  tenantId: options.workspaceId,
                  ownerId: options.userId,
                },
              });

          // Import versions
          for (const versionData of templateData.versions) {
            const existingVersion = await prisma.templateVersion.findFirst({
              where: {
                templateId: template.id,
                versionNumber: versionData.versionNumber,
              },
            });

            if (!existingVersion) {
              await prisma.templateVersion.create({
                data: {
                  templateId: template.id,
                  versionNumber: versionData.versionNumber,
                  contentSnapshot: versionData.content,
                  isActive: versionData.isActive || false,
                  createdById: options.userId,
                },
              });
            }
          }

          result.imported.templates++;
        } catch (error) {
          result.errors.push({
            entity: 'template',
            name: templateData.name,
            error: (error as Error).message,
          });
        }
      }
    }

    // Import datasets
    if (validBundle.data.datasets) {
      for (const datasetData of validBundle.data.datasets) {
        try {
          const name = datasetData.name + suffix;

          const existing = await prisma.evaluationDataset.findFirst({
            where: {
              name,
              tenantId: options.workspaceId || null,
            },
          });

          if (existing && !options.overwriteExisting) {
            result.warnings.push(`Dataset "${name}" already exists, skipped`);
            continue;
          }

          const dataset = existing
            ? await prisma.evaluationDataset.update({
                where: { id: existing.id },
                data: {
                  description: datasetData.description,
                  taskType: datasetData.taskType,
                  format: datasetData.format,
                },
              })
            : await prisma.evaluationDataset.create({
                data: {
                  name,
                  description: datasetData.description,
                  taskType: datasetData.taskType,
                  format: datasetData.format,
                  tenantId: options.workspaceId,
                  createdById: options.userId,
                },
              });

          // Clear existing examples if overwriting
          if (existing && options.overwriteExisting) {
            await prisma.datasetExample.deleteMany({
              where: { datasetId: dataset.id },
            });
          }

          // Import examples
          for (const example of datasetData.examples) {
            await prisma.datasetExample.create({
              data: {
                datasetId: dataset.id,
                inputVariables: example.inputVariables,
                expectedOutput: example.expectedOutput,
                metadata: example.metadata || {},
              },
            });
          }

          result.imported.datasets++;
        } catch (error) {
          result.errors.push({
            entity: 'dataset',
            name: datasetData.name,
            error: (error as Error).message,
          });
        }
      }
    }

    // Import rubrics
    if (validBundle.data.rubrics) {
      for (const rubricData of validBundle.data.rubrics) {
        try {
          const name = rubricData.name + suffix;

          const existing = await prisma.judgeRubric.findFirst({
            where: {
              name,
              workspaceId: options.workspaceId || null,
            },
          });

          if (existing && !options.overwriteExisting) {
            result.warnings.push(`Rubric "${name}" already exists, skipped`);
            continue;
          }

          if (existing) {
            await prisma.judgeRubric.update({
              where: { id: existing.id },
              data: {
                description: rubricData.description,
                rubricJson: rubricData.rubric,
                modelConfig: rubricData.modelConfig,
              },
            });
          } else {
            await prisma.judgeRubric.create({
              data: {
                name,
                description: rubricData.description,
                rubricJson: rubricData.rubric,
                modelConfig: rubricData.modelConfig,
                workspaceId: options.workspaceId,
                createdById: options.userId,
              },
            });
          }

          result.imported.rubrics++;
        } catch (error) {
          result.errors.push({
            entity: 'rubric',
            name: rubricData.name,
            error: (error as Error).message,
          });
        }
      }
    }

    // Import techniques
    if (validBundle.data.techniques) {
      for (const techData of validBundle.data.techniques) {
        try {
          const name = techData.name + suffix;

          const existing = await prisma.technique.findFirst({
            where: {
              name,
              workspaceId: options.workspaceId || null,
            },
          });

          if (existing && !options.overwriteExisting) {
            result.warnings.push(`Technique "${name}" already exists, skipped`);
            continue;
          }

          if (existing) {
            await prisma.technique.update({
              where: { id: existing.id },
              data: {
                descriptionShort: techData.descriptionShort,
                descriptionFull: techData.descriptionFull,
                category: techData.category,
                tags: techData.tags,
                whenToUse: techData.whenToUse,
                antiPatternExample: techData.antiPatternExample,
                goodExample: techData.goodExample,
                applyPatchJson: techData.applyPatchJson,
              },
            });
          } else {
            await prisma.technique.create({
              data: {
                name,
                descriptionShort: techData.descriptionShort,
                descriptionFull: techData.descriptionFull,
                category: techData.category,
                tags: techData.tags,
                whenToUse: techData.whenToUse,
                antiPatternExample: techData.antiPatternExample,
                goodExample: techData.goodExample,
                applyPatchJson: techData.applyPatchJson,
                workspaceId: options.workspaceId,
                createdById: options.userId,
                isBuiltIn: false,
              },
            });
          }

          result.imported.techniques++;
        } catch (error) {
          result.errors.push({
            entity: 'technique',
            name: techData.name,
            error: (error as Error).message,
          });
        }
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Validate a bundle without importing
   */
  validateBundle(bundle: unknown): {
    valid: boolean;
    errors: string[];
    summary: {
      templates: number;
      datasets: number;
      rubrics: number;
      techniques: number;
    };
  } {
    const validation = bundleSchema.safeParse(bundle);

    if (!validation.success) {
      return {
        valid: false,
        errors: validation.error.errors.map(
          e => `${e.path.join('.')}: ${e.message}`
        ),
        summary: { templates: 0, datasets: 0, rubrics: 0, techniques: 0 },
      };
    }

    const data = validation.data;
    return {
      valid: true,
      errors: [],
      summary: {
        templates: data.data.templates?.length || 0,
        datasets: data.data.datasets?.length || 0,
        rubrics: data.data.rubrics?.length || 0,
        techniques: data.data.techniques?.length || 0,
      },
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const importExportService = new ImportExportService();
