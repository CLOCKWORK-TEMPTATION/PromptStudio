// ============================================================
// Baseline Evaluation API Routes - Epic 0.5
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { LLMServiceAdapter } from '../../services/LLMServiceAdapter.js';
import {
  renderPromptParts,
  parseContentSnapshot,
} from '../../../shared/utils/promptRenderer';
import type {
  MetricType,
  ExampleResult,
  FailureCase,
  TemplateContentSnapshot,
} from '../../../shared/types/dspy';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

const baselineEvalSchema = z.object({
  templateVersionId: z.string().uuid(),
  datasetId: z.string().uuid(),
  metricType: z.enum(['exact_match', 'contains', 'json_valid']),
  maxSamples: z.number().positive().optional(),
});

// ============================================================
// Metric Functions
// ============================================================

function evaluateExactMatch(expected: string, actual: string): boolean {
  return expected.trim().toLowerCase() === actual.trim().toLowerCase();
}

function evaluateContains(expected: string, actual: string): boolean {
  return actual.toLowerCase().includes(expected.toLowerCase());
}

function evaluateJsonValid(actual: string): boolean {
  try {
    JSON.parse(actual);
    return true;
  } catch {
    return false;
  }
}

function evaluateMetric(
  metricType: MetricType,
  expected: string | undefined,
  actual: string
): { passed: boolean; score: number } {
  switch (metricType) {
    case 'exact_match':
      if (!expected) return { passed: false, score: 0 };
      const exactMatch = evaluateExactMatch(expected, actual);
      return { passed: exactMatch, score: exactMatch ? 1 : 0 };

    case 'contains':
      if (!expected) return { passed: false, score: 0 };
      const contains = evaluateContains(expected, actual);
      return { passed: contains, score: contains ? 1 : 0 };

    case 'json_valid':
      const jsonValid = evaluateJsonValid(actual);
      return { passed: jsonValid, score: jsonValid ? 1 : 0 };

    default:
      return { passed: false, score: 0 };
  }
}

// ============================================================
// POST /api/evals/baseline - Run baseline evaluation
// ============================================================

router.post('/baseline', async (req: Request, res: Response) => {
  try {
    const validation = baselineEvalSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const { templateVersionId, datasetId, metricType, maxSamples } = validation.data;

    // Load version with template
    const version = await prisma.templateVersion.findUnique({
      where: { id: templateVersionId },
      include: { template: true },
    });

    if (!version) {
      return res.status(404).json({ error: 'Template version not found' });
    }

    // Load dataset examples
    const examples = await prisma.datasetExample.findMany({
      where: { datasetId },
      take: maxSamples,
      orderBy: { createdAt: 'asc' },
    });

    if (examples.length === 0) {
      return res.status(400).json({ error: 'Dataset has no examples' });
    }

    // Create evaluation run record
    const evalRun = await prisma.evaluationRun.create({
      data: {
        templateId: version.templateId,
        templateVersionId,
        datasetId,
        metricType,
        status: 'running',
        startedAt: new Date(),
        totalExamples: examples.length,
        maxSamples,
      },
    });

    // Parse content snapshot
    const contentSnapshot = parseContentSnapshot(version.contentSnapshot);

    // Run evaluation for each example
    const results: ExampleResult[] = [];
    const failureCases: FailureCase[] = [];
    let passedCount = 0;
    let totalScore = 0;

    for (const example of examples) {
      const startTime = Date.now();
      let actualOutput = '';
      let errorMessage: string | undefined;

      try {
        // Render prompt with variables
        const inputVars = example.inputVariables as Record<string, unknown>;
        const rendered = renderPromptParts(contentSnapshot, inputVars);

        // Execute LLM call
        // Use the existing LLM adapter pattern from the project
        actualOutput = await executeLLMCall(rendered, contentSnapshot.modelConfig);
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'LLM call failed';
        actualOutput = '';
      }

      const latencyMs = Date.now() - startTime;

      // Evaluate metric
      const { passed, score } = evaluateMetric(
        metricType as MetricType,
        example.expectedOutput || undefined,
        actualOutput
      );

      if (passed) {
        passedCount++;
      }
      totalScore += score;

      const result: ExampleResult = {
        exampleId: example.id,
        passed,
        score,
        input: example.inputVariables as Record<string, unknown>,
        expectedOutput: example.expectedOutput || undefined,
        actualOutput,
        errorMessage,
        latencyMs,
      };

      results.push(result);

      // Track failure cases (top 10)
      if (!passed && failureCases.length < 10) {
        failureCases.push({
          exampleId: example.id,
          input: example.inputVariables as Record<string, unknown>,
          expectedOutput: example.expectedOutput || undefined,
          actualOutput,
          reason: errorMessage || `Metric '${metricType}' failed`,
        });
      }
    }

    const aggregateScore = examples.length > 0 ? totalScore / examples.length : 0;

    // Update evaluation run with results
    await prisma.evaluationRun.update({
      where: { id: evalRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        aggregateScore,
        passedExamples: passedCount,
        failedExamples: examples.length - passedCount,
        perExampleResults: results as unknown as Prisma.InputJsonValue,
        failureCases: failureCases as unknown as Prisma.InputJsonValue,
      },
    });

    res.json({
      runId: evalRun.id,
      aggregateScore,
      totalExamples: examples.length,
      passedExamples: passedCount,
      failedExamples: examples.length - passedCount,
      perExampleResults: results,
      failureCases,
    });
  } catch (error) {
    console.error('Error running baseline evaluation:', error);
    res.status(500).json({ error: 'Failed to run baseline evaluation' });
  }
});

// ============================================================
// GET /api/evals/:id - Get evaluation run details
// ============================================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const evalRun = await prisma.evaluationRun.findUnique({
      where: { id },
      include: {
        dataset: true,
      },
    });

    if (!evalRun) {
      return res.status(404).json({ error: 'Evaluation run not found' });
    }

    res.json(evalRun);
  } catch (error) {
    console.error('Error getting evaluation run:', error);
    res.status(500).json({ error: 'Failed to get evaluation run' });
  }
});

// ============================================================
// GET /api/evals - List evaluation runs
// ============================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const { datasetId, templateId, status, limit = '20', offset = '0' } = req.query;

    const where: Record<string, unknown> = {};

    if (datasetId) {
      where.datasetId = datasetId as string;
    }

    if (templateId) {
      where.templateId = templateId as string;
    }

    if (status) {
      where.status = status as string;
    }

    const runs = await prisma.evaluationRun.findMany({
      where,
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      orderBy: { createdAt: 'desc' },
      include: {
        dataset: {
          select: { id: true, name: true },
        },
      },
    });

    const total = await prisma.evaluationRun.count({ where });

    res.json({
      runs,
      total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('Error listing evaluation runs:', error);
    res.status(500).json({ error: 'Failed to list evaluation runs' });
  }
});

// ============================================================
// Helper: Execute LLM Call
// ============================================================

async function executeLLMCall(
  rendered: { system: string; user: string; context?: string },
  modelConfig?: TemplateContentSnapshot['modelConfig']
): Promise<string> {
  // Use OpenAI by default, following the project's LLMServiceAdapter pattern
  const config = modelConfig || {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1024,
  };

  // Build messages
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

  if (rendered.system) {
    messages.push({ role: 'system', content: rendered.system });
  }

  let userContent = rendered.user;
  if (rendered.context) {
    userContent = `${rendered.context}\n\n${userContent}`;
  }
  messages.push({ role: 'user', content: userContent });

  // Use OpenAI directly (following the project's pattern)
  const { OpenAI } = await import('openai');
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: config.model || 'gpt-4',
    messages,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 1024,
    top_p: config.topP ?? 1,
    frequency_penalty: config.frequencyPenalty ?? 0,
    presence_penalty: config.presencePenalty ?? 0,
  });

  return response.choices[0]?.message?.content?.trim() || '';
}

export default router;
