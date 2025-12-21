// ============================================================
// Baseline Evaluation API Routes - Epic 0.5
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';
import {
  renderPromptParts,
  parseContentSnapshot,
} from '../../../shared/utils/promptRenderer';
import { logAuditEvent } from './audit.js';
import { budgetService } from '../../services/BudgetEnforcementService.js';
import { DEFAULT_JUDGE_MODEL_CONFIG, DEFAULT_JUDGE_RUBRIC } from '../../lib/metrics/defaultRubric.js';
import {
  getMetric,
  setLLMJudgeClient,
  type JudgeModelConfig,
  type JudgeRubricConfig,
} from '../../lib/metrics/index.js';
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
  metricType: z.enum(['exact_match', 'contains', 'json_valid', 'judge_rubric']).optional(),
  maxSamples: z.number().positive().optional(),
}).strict();

const METRICS_REQUIRING_LABELS = new Set(['exact_match', 'contains']);

class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

// ============================================================
// Metric Functions
// ============================================================

function resolveMetricType(datasetFormat: string, requested?: MetricType): MetricType {
  if (datasetFormat === 'unlabeled') {
    return 'judge_rubric';
  }

  const selected = requested ?? 'exact_match';
  if (!['exact_match', 'contains', 'json_valid'].includes(selected)) {
    throw new Error(`Metric '${selected}' is not allowed for labeled datasets`);
  }

  return selected;
}

function calculateUsdEstimate(tokens: number): number {
  return (tokens / 1000) * 0.03;
}

// ============================================================
// POST /api/evals/baseline - Run baseline evaluation
// ============================================================

router.post('/baseline', async (req: Request, res: Response) => {
  let evalRunId: string | null = null;

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

    const dataset = await prisma.evaluationDataset.findUnique({
      where: { id: datasetId },
      include: { judgeRubric: true },
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    let selectedMetricType: MetricType;
    try {
      selectedMetricType = resolveMetricType(dataset.format, metricType);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid metric type',
        details: { metricType, datasetFormat: dataset.format },
      });
    }

    if (METRICS_REQUIRING_LABELS.has(selectedMetricType)) {
      const missingExpectedOutput = await prisma.datasetExample.count({
        where: {
          datasetId,
          OR: [{ expectedOutput: null }, { expectedOutput: '' }],
        },
      });

      if (missingExpectedOutput > 0) {
        return res.status(400).json({
          error: 'Dataset examples missing expected output for labeled metric',
          details: { missingExpectedOutput },
        });
      }
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
        metricType: selectedMetricType,
        status: 'running',
        startedAt: new Date(),
        totalExamples: examples.length,
        maxSamples,
      },
    });
    evalRunId = evalRun.id;

    await logAuditEvent(
      'evaluation.started',
      'EvaluationRun',
      evalRun.id,
      {
        jobId: evalRun.id,
        datasetId,
        metricType: selectedMetricType,
        templateVersionId,
      },
      req
    );

    // Parse content snapshot
    const contentSnapshot = parseContentSnapshot(version.contentSnapshot);

    // Run evaluation for each example
    const results: ExampleResult[] = [];
    const failureCases: FailureCase[] = [];
    const judgeArtifacts: Array<Record<string, unknown>> = [];
    let passedCount = 0;
    let totalScore = 0;
    let totalCalls = 0;
    let totalTokens = 0;
    let judgeCalls = 0;
    let judgeTokens = 0;

    const metric = getMetric(selectedMetricType);
    if (!metric) {
      throw new Error(`Unknown metric type: ${selectedMetricType}`);
    }

    const rubric = dataset.judgeRubric?.rubricJson as JudgeRubricConfig | undefined;
    const modelConfig = dataset.judgeRubric?.modelConfig as JudgeModelConfig | undefined;

    const budgetLimits = dataset.tenantId
      ? await budgetService.getRunBudget(dataset.tenantId)
      : { maxCalls: 100, maxTokens: 100000, maxUSD: 10 };

    if (selectedMetricType === 'judge_rubric') {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      setLLMJudgeClient({
        async call(prompt: string, config?: JudgeModelConfig): Promise<string> {
          if (judgeCalls >= budgetLimits.maxCalls) {
            throw new BudgetExceededError(`Judge calls exceeded ${budgetLimits.maxCalls}`);
          }
          if (judgeTokens >= budgetLimits.maxTokens) {
            throw new BudgetExceededError(`Judge tokens exceeded ${budgetLimits.maxTokens}`);
          }
          if (calculateUsdEstimate(judgeTokens) >= budgetLimits.maxUSD) {
            throw new BudgetExceededError(`Judge cost exceeded $${budgetLimits.maxUSD}`);
          }

          const judgeConfig = config ?? DEFAULT_JUDGE_MODEL_CONFIG;
          const response = await openai.chat.completions.create({
            model: judgeConfig.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: judgeConfig.temperature,
            max_tokens: judgeConfig.maxTokens,
            response_format: { type: 'json_object' },
          });

          judgeCalls += 1;
          judgeTokens += response.usage?.total_tokens ?? 0;
          totalCalls += 1;
          totalTokens += response.usage?.total_tokens ?? 0;

          if (judgeCalls >= budgetLimits.maxCalls) {
            throw new BudgetExceededError(`Judge calls exceeded ${budgetLimits.maxCalls}`);
          }
          if (judgeTokens >= budgetLimits.maxTokens) {
            throw new BudgetExceededError(`Judge tokens exceeded ${budgetLimits.maxTokens}`);
          }
          if (calculateUsdEstimate(judgeTokens) >= budgetLimits.maxUSD) {
            throw new BudgetExceededError(`Judge cost exceeded $${budgetLimits.maxUSD}`);
          }

          return response.choices[0]?.message?.content || '{}';
        },
      });
    }

    for (const example of examples) {
      const startTime = Date.now();
      let actualOutput = '';
      let errorMessage: string | undefined;
      let judgeDetails: Record<string, unknown> | undefined;

      try {
        // Render prompt with variables
        const inputVars = example.inputVariables as Record<string, unknown>;
        const rendered = renderPromptParts(contentSnapshot, inputVars);

        // Execute LLM call
        // Use the existing LLM adapter pattern from the project
        const llmResult = await executeLLMCall(rendered, contentSnapshot.modelConfig);
        actualOutput = llmResult.output;
        totalCalls += 1;
        totalTokens += llmResult.tokens;
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'LLM call failed';
        actualOutput = '';
      }

      const latencyMs = Date.now() - startTime;

      // Evaluate metric
      let passed = false;
      let score = 0;

      try {
        const metricResult = await metric(actualOutput, {
          example: {
            id: example.id,
            inputVariables: example.inputVariables as Record<string, unknown>,
            expectedOutput: example.expectedOutput || undefined,
            metadata: example.metadata as Record<string, unknown> | undefined,
          },
          rubric: rubric ?? DEFAULT_JUDGE_RUBRIC,
          modelConfig: modelConfig ?? DEFAULT_JUDGE_MODEL_CONFIG,
        });

        passed = metricResult.passed;
        score = metricResult.score;
        judgeDetails = metricResult.details;
      } catch (error) {
        if (error instanceof BudgetExceededError) {
          throw error;
        }
        passed = false;
        score = 0;
        errorMessage = error instanceof Error ? error.message : 'Metric evaluation failed';
      }

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
          reason: errorMessage || `Metric '${selectedMetricType}' failed`,
        });
      }

      if (selectedMetricType === 'judge_rubric') {
        judgeArtifacts.push({
          exampleId: example.id,
          passed,
          score,
          details: judgeDetails,
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
        artifacts: selectedMetricType === 'judge_rubric'
          ? ({
            judge: {
              rubric: rubric ?? DEFAULT_JUDGE_RUBRIC,
              modelConfig: modelConfig ?? DEFAULT_JUDGE_MODEL_CONFIG,
              results: judgeArtifacts,
            },
          } as Prisma.InputJsonValue)
          : undefined,
        calls: totalCalls,
        tokens: totalTokens,
        usdEstimate: calculateUsdEstimate(totalTokens),
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
    if (error instanceof BudgetExceededError) {
      console.error('Evaluation budget exceeded:', error);
      if (typeof evalRunId === 'string') {
        await prisma.evaluationRun.update({
          where: { id: evalRunId },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: error.message,
          },
        });
      }
      return res.status(429).json({ error: error.message });
    }

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
): Promise<{ output: string; tokens: number }> {
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

  return {
    output: response.choices[0]?.message?.content?.trim() || '',
    tokens: response.usage?.total_tokens ?? 0,
  };
}

export default router;
