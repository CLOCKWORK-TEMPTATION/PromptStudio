// ============================================================
// Advanced Evaluation API Routes - Epic 2.3
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';
import {
  getMetric,
  setLLMJudgeClient,
  type MetricContext,
  type JudgeRubricConfig,
  type JudgeModelConfig,
} from '../../lib/metrics/index.js';
import {
  renderPromptParts,
  parseContentSnapshot,
} from '../../../shared/utils/promptRenderer.js';
import { logAuditEvent } from './audit.js';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

const budgetSchema = z.object({
  maxCalls: z.number().int().min(1).max(10000).optional(),
  maxTokens: z.number().int().min(1).max(1000000).optional(),
  maxUSD: z.number().min(0.01).max(1000).optional(),
}).strict();

const createEvalRunSchema = z.object({
  versionId: z.string().uuid(),
  datasetId: z.string().uuid(),
  metricType: z.enum(['exact_match', 'contains', 'json_valid', 'judge_rubric', 'pairwise_judge']),
  judgeRubricId: z.string().uuid().optional(),
  maxSamples: z.number().positive().optional(),
  budget: budgetSchema.optional(),
}).strict();

const createCompareSchema = z.object({
  versionAId: z.string().uuid(),
  versionBId: z.string().uuid(),
  datasetId: z.string().uuid(),
  metricType: z.enum(['judge_rubric', 'pairwise_judge']).default('pairwise_judge'),
  judgeRubricId: z.string().uuid().optional(),
  maxSamples: z.number().positive().optional(),
}).strict();

const METRICS_REQUIRING_LABELS = new Set(['exact_match', 'contains']);

// ============================================================
// POST /api/evals/run - Create evaluation run
// ============================================================

router.post('/run', async (req: Request, res: Response) => {
  try {
    const validation = createEvalRunSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const {
      versionId,
      datasetId,
      metricType,
      judgeRubricId,
      maxSamples,
      budget,
    } = validation.data;

    // Verify version exists
    const version = await prisma.templateVersion.findUnique({
      where: { id: versionId },
      include: { template: true },
    });

    if (!version) {
      return res.status(404).json({ error: 'Template version not found' });
    }

    // Verify dataset exists and has examples
    const dataset = await prisma.evaluationDataset.findUnique({
      where: { id: datasetId },
      include: { _count: { select: { examples: true } } },
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    if (dataset._count.examples === 0) {
      return res.status(400).json({ error: 'Dataset has no examples' });
    }

    if (METRICS_REQUIRING_LABELS.has(metricType) && dataset.format === 'unlabeled') {
      return res.status(400).json({
        error: 'Metric requires labeled dataset',
        details: { metricType, datasetFormat: dataset.format },
      });
    }

    if (METRICS_REQUIRING_LABELS.has(metricType)) {
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

    // Verify rubric if judge metric
    if ((metricType === 'judge_rubric' || metricType === 'pairwise_judge') && judgeRubricId) {
      const rubric = await prisma.judgeRubric.findUnique({
        where: { id: judgeRubricId },
      });

      if (!rubric) {
        return res.status(404).json({ error: 'Judge rubric not found' });
      }
    }

    // Create evaluation run
    const run = await prisma.advancedEvaluationRun.create({
      data: {
        templateId: version.templateId,
        versionId,
        datasetId,
        mode: 'baseline',
        metricType,
        judgeRubricId,
        budget: (budget || {}) as Prisma.InputJsonValue,
        status: 'queued',
        progress: 0,
        stage: 'Waiting to start',
      },
    });

    // Trigger async evaluation
    triggerEvaluationJob(run.id, maxSamples).catch(err => {
      console.error('Failed to trigger evaluation job:', err);
    });

    await logAuditEvent(
      'evaluation.started',
      'AdvancedEvaluationRun',
      run.id,
      {
        jobId: run.id,
        datasetId,
        metricType,
        mode: 'baseline',
      },
      req
    );

    res.status(201).json({
      id: run.id,
      jobId: run.id,
      status: run.status,
      progress: run.progress,
      stage: run.stage,
      createdAt: run.createdAt,
    });
  } catch (error) {
    console.error('Error creating evaluation run:', error);
    res.status(500).json({ error: 'Failed to create evaluation run' });
  }
});

// ============================================================
// GET /api/evals/run/:id - Get evaluation run status
// ============================================================

router.get('/run/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const run = await prisma.advancedEvaluationRun.findUnique({
      where: { id },
      include: {
        judgeRubric: {
          select: { id: true, name: true },
        },
      },
    });

    if (!run) {
      return res.status(404).json({ error: 'Evaluation run not found' });
    }

    // Get top failures summary
    const failedResults = await prisma.advancedEvalResult.findMany({
      where: { runId: id, passed: false },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      id: run.id,
      status: run.status,
      progress: run.progress,
      stage: run.stage,
      mode: run.mode,
      metricType: run.metricType,
      score: run.score,
      scoreA: run.scoreA,
      scoreB: run.scoreB,
      winsA: run.winsA,
      winsB: run.winsB,
      ties: run.ties,
      cost: run.cost,
      topFailures: failedResults.map(r => ({
        exampleId: r.exampleId,
        reason: r.failureReason,
        output: r.outputText?.slice(0, 100),
      })),
      judgeRubric: run.judgeRubric,
      errorMessage: run.errorMessage,
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    });
  } catch (error) {
    console.error('Error getting evaluation run:', error);
    res.status(500).json({ error: 'Failed to get evaluation run' });
  }
});

// ============================================================
// GET /api/evals/run/:id/results - Get evaluation results with pagination
// ============================================================

router.get('/run/:id/results', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50', offset = '0', passed } = req.query;

    const where: Prisma.AdvancedEvalResultWhereInput = { runId: id };

    if (passed !== undefined) {
      where.passed = passed === 'true';
    }

    const results = await prisma.advancedEvalResult.findMany({
      where,
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      orderBy: { createdAt: 'asc' },
    });

    const total = await prisma.advancedEvalResult.count({ where });

    res.json({
      results,
      total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('Error getting evaluation results:', error);
    res.status(500).json({ error: 'Failed to get evaluation results' });
  }
});

// ============================================================
// POST /api/evals/compare - Create comparison evaluation
// ============================================================

router.post('/compare', async (req: Request, res: Response) => {
  try {
    const validation = createCompareSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const {
      versionAId,
      versionBId,
      datasetId,
      metricType,
      judgeRubricId,
      maxSamples,
    } = validation.data;

    // Verify both versions exist
    const [versionA, versionB] = await Promise.all([
      prisma.templateVersion.findUnique({ where: { id: versionAId } }),
      prisma.templateVersion.findUnique({ where: { id: versionBId } }),
    ]);

    if (!versionA || !versionB) {
      return res.status(404).json({ error: 'One or both versions not found' });
    }

    // Verify dataset exists
    const dataset = await prisma.evaluationDataset.findUnique({
      where: { id: datasetId },
      include: { _count: { select: { examples: true } } },
    });

    if (!dataset || dataset._count.examples === 0) {
      return res.status(400).json({ error: 'Dataset not found or empty' });
    }

    // Create comparison run
    const run = await prisma.advancedEvaluationRun.create({
      data: {
        datasetId,
        mode: 'compare',
        versionAId,
        versionBId,
        metricType,
        judgeRubricId,
        status: 'queued',
        progress: 0,
        stage: 'Waiting to start',
        winsA: 0,
        winsB: 0,
        ties: 0,
      },
    });

    // Trigger async comparison
    triggerComparisonJob(run.id, maxSamples).catch(err => {
      console.error('Failed to trigger comparison job:', err);
    });

    await logAuditEvent(
      'evaluation.started',
      'AdvancedEvaluationRun',
      run.id,
      {
        jobId: run.id,
        datasetId,
        metricType,
        mode: 'compare',
        versionAId,
        versionBId,
      },
      req
    );

    res.status(201).json({
      id: run.id,
      jobId: run.id,
      status: run.status,
      mode: 'compare',
      createdAt: run.createdAt,
    });
  } catch (error) {
    console.error('Error creating comparison run:', error);
    res.status(500).json({ error: 'Failed to create comparison run' });
  }
});

// ============================================================
// GET /api/evals/runs - List evaluation runs
// ============================================================

router.get('/runs', async (req: Request, res: Response) => {
  try {
    const { status, metricType, mode, limit = '20', offset = '0' } = req.query;

    const where: Prisma.AdvancedEvaluationRunWhereInput = {};

    if (status) where.status = status as string;
    if (metricType) where.metricType = metricType as string;
    if (mode) where.mode = mode as string;

    const runs = await prisma.advancedEvaluationRun.findMany({
      where,
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      orderBy: { createdAt: 'desc' },
      include: {
        judgeRubric: { select: { id: true, name: true } },
        _count: { select: { results: true } },
      },
    });

    const total = await prisma.advancedEvaluationRun.count({ where });

    res.json({
      runs: runs.map(r => ({
        ...r,
        resultCount: r._count.results,
      })),
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
// Background Job: Evaluation Execution
// ============================================================

async function triggerEvaluationJob(runId: string, maxSamples?: number): Promise<void> {
  try {
    // Update status to running
    await prisma.advancedEvaluationRun.update({
      where: { id: runId },
      data: {
        status: 'running',
        startedAt: new Date(),
        stage: 'Loading data',
        progress: 5,
      },
    });

    // Load run data
    const run = await prisma.advancedEvaluationRun.findUnique({
      where: { id: runId },
      include: {
        judgeRubric: true,
      },
    });

    if (!run || !run.versionId) {
      throw new Error('Run or version not found');
    }

    // Load version
    const version = await prisma.templateVersion.findUnique({
      where: { id: run.versionId },
    });

    if (!version) {
      throw new Error('Version not found');
    }

    // Load dataset examples
    const examples = await prisma.datasetExample.findMany({
      where: { datasetId: run.datasetId },
      take: maxSamples,
      orderBy: { createdAt: 'asc' },
    });

    await prisma.advancedEvaluationRun.update({
      where: { id: runId },
      data: { stage: 'Running evaluation', progress: 10 },
    });

    // Get metric function
    const metric = getMetric(run.metricType as any);
    if (!metric) {
      throw new Error(`Unknown metric type: ${run.metricType}`);
    }

    // Parse content snapshot
    const contentSnapshot = parseContentSnapshot(version.contentSnapshot);

    // Configure LLM client for judge metrics
    if (run.metricType === 'judge_rubric' || run.metricType === 'pairwise_judge') {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      setLLMJudgeClient({
        async call(prompt: string, config?: JudgeModelConfig): Promise<string> {
          const modelConfig = config || {
            model: 'gpt-4',
            temperature: 0.1,
            maxTokens: 1024,
          };

          const response = await openai.chat.completions.create({
            model: modelConfig.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: modelConfig.temperature,
            max_tokens: modelConfig.maxTokens,
            response_format: { type: 'json_object' },
          });

          return response.choices[0]?.message?.content || '{}';
        },
      });
    }

    // Run evaluation for each example
    let passedCount = 0;
    let totalScore = 0;
    let totalCalls = 0;
    let totalTokens = 0;

    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];

      // Update progress
      const progress = 10 + Math.floor((i / examples.length) * 80);
      await prisma.advancedEvaluationRun.update({
        where: { id: runId },
        data: { progress, stage: `Evaluating example ${i + 1}/${examples.length}` },
      });

      const startTime = Date.now();
      let outputText = '';
      let metricResult;

      try {
        // Render prompt and call LLM
        const inputVars = example.inputVariables as Record<string, unknown>;
        const rendered = renderPromptParts(contentSnapshot, inputVars);

        // Call LLM to get output
        const { OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
        if (rendered.system) messages.push({ role: 'system', content: rendered.system });

        let userContent = rendered.user;
        if (rendered.context) userContent = `${rendered.context}\n\n${userContent}`;
        messages.push({ role: 'user', content: userContent });

        const response = await openai.chat.completions.create({
          model: contentSnapshot.modelConfig?.model || 'gpt-4',
          messages,
          temperature: contentSnapshot.modelConfig?.temperature ?? 0.7,
          max_tokens: contentSnapshot.modelConfig?.maxTokens ?? 1024,
        });

        outputText = response.choices[0]?.message?.content?.trim() || '';
        totalCalls++;
        totalTokens += response.usage?.total_tokens || 0;

        // Build metric context
        const metricContext: MetricContext = {
          example: {
            id: example.id,
            inputVariables: inputVars,
            expectedOutput: example.expectedOutput || undefined,
            metadata: example.metadata as Record<string, unknown> | undefined,
          },
        };

        if (run.judgeRubric) {
          metricContext.rubric = run.judgeRubric.rubricJson as unknown as JudgeRubricConfig;
          metricContext.modelConfig = run.judgeRubric.modelConfig as unknown as JudgeModelConfig;
        }

        // Evaluate
        metricResult = await metric(outputText, metricContext);

        if (metricResult.passed) passedCount++;
        totalScore += metricResult.score;

      } catch (error) {
        metricResult = {
          passed: false,
          score: 0,
          reason: error instanceof Error ? error.message : 'Evaluation failed',
        };
      }

      const latencyMs = Date.now() - startTime;

      // Save result
      await prisma.advancedEvalResult.create({
        data: {
          runId,
          exampleId: example.id,
          outputText,
          passed: metricResult.passed,
          score: metricResult.score,
          failureReason: metricResult.passed ? null : metricResult.reason,
          judgeDetails: metricResult.details as Prisma.InputJsonValue,
          latencyMs,
        },
      });
    }

    // Calculate final score
    const finalScore = examples.length > 0 ? totalScore / examples.length : 0;

    // Update run with final results
    await prisma.advancedEvaluationRun.update({
      where: { id: runId },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
        progress: 100,
        stage: 'Completed',
        score: finalScore,
        cost: {
          calls: totalCalls,
          tokens: totalTokens,
          usdEstimate: (totalTokens / 1000) * 0.03,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error('Evaluation job failed:', error);

    await prisma.advancedEvaluationRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

async function triggerComparisonJob(runId: string, maxSamples?: number): Promise<void> {
  try {
    await prisma.advancedEvaluationRun.update({
      where: { id: runId },
      data: {
        status: 'running',
        startedAt: new Date(),
        stage: 'Loading versions',
        progress: 5,
      },
    });

    const run = await prisma.advancedEvaluationRun.findUnique({
      where: { id: runId },
      include: { judgeRubric: true },
    });

    if (!run || !run.versionAId || !run.versionBId) {
      throw new Error('Run or versions not found');
    }

    const [versionA, versionB] = await Promise.all([
      prisma.templateVersion.findUnique({ where: { id: run.versionAId } }),
      prisma.templateVersion.findUnique({ where: { id: run.versionBId } }),
    ]);

    if (!versionA || !versionB) {
      throw new Error('Versions not found');
    }

    const examples = await prisma.datasetExample.findMany({
      where: { datasetId: run.datasetId },
      take: maxSamples,
    });

    const contentA = parseContentSnapshot(versionA.contentSnapshot);
    const contentB = parseContentSnapshot(versionB.contentSnapshot);

    // Configure LLM
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    setLLMJudgeClient({
      async call(prompt: string, config?: JudgeModelConfig): Promise<string> {
        const response = await openai.chat.completions.create({
          model: config?.model || 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: config?.temperature ?? 0.1,
          max_tokens: config?.maxTokens ?? 1024,
          response_format: { type: 'json_object' },
        });
        return response.choices[0]?.message?.content || '{}';
      },
    });

    let winsA = 0, winsB = 0, ties = 0;
    let totalScoreA = 0, totalScoreB = 0;

    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];
      const inputVars = example.inputVariables as Record<string, unknown>;

      await prisma.advancedEvaluationRun.update({
        where: { id: runId },
        data: {
          progress: 10 + Math.floor((i / examples.length) * 80),
          stage: `Comparing example ${i + 1}/${examples.length}`,
        },
      });

      // Get outputs from both versions
      const renderedA = renderPromptParts(contentA, inputVars);
      const renderedB = renderPromptParts(contentB, inputVars);

      const [respA, respB] = await Promise.all([
        openai.chat.completions.create({
          model: contentA.modelConfig?.model || 'gpt-4',
          messages: [
            { role: 'system', content: renderedA.system },
            { role: 'user', content: renderedA.user },
          ],
          temperature: contentA.modelConfig?.temperature ?? 0.7,
        }),
        openai.chat.completions.create({
          model: contentB.modelConfig?.model || 'gpt-4',
          messages: [
            { role: 'system', content: renderedB.system },
            { role: 'user', content: renderedB.user },
          ],
          temperature: contentB.modelConfig?.temperature ?? 0.7,
        }),
      ]);

      const outputA = respA.choices[0]?.message?.content || '';
      const outputB = respB.choices[0]?.message?.content || '';

      // Get pairwise metric
      const metric = getMetric('pairwise_judge');
      const result = await metric!(outputA, {
        example: {
          id: example.id,
          inputVariables: inputVars,
          expectedOutput: example.expectedOutput || undefined,
        },
        outputA,
        outputB,
        rubric: run.judgeRubric?.rubricJson as unknown as JudgeRubricConfig,
        modelConfig: run.judgeRubric?.modelConfig as unknown as JudgeModelConfig,
      });

      const winner = result.details?.winner as string || 'tie';
      if (winner === 'A') winsA++;
      else if (winner === 'B') winsB++;
      else ties++;

      totalScoreA += result.details?.scoreA as number || 0.5;
      totalScoreB += result.details?.scoreB as number || 0.5;

      await prisma.advancedEvalResult.create({
        data: {
          runId,
          exampleId: example.id,
          outputText: outputA,
          outputTextA: outputA,
          outputTextB: outputB,
          passed: true,
          winner,
          winnerReason: result.reason,
          judgeDetails: result.details as Prisma.InputJsonValue,
        },
      });
    }

    await prisma.advancedEvaluationRun.update({
      where: { id: runId },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
        progress: 100,
        stage: 'Completed',
        winsA,
        winsB,
        ties,
        scoreA: examples.length > 0 ? totalScoreA / examples.length : 0,
        scoreB: examples.length > 0 ? totalScoreB / examples.length : 0,
      },
    });
  } catch (error) {
    console.error('Comparison job failed:', error);

    await prisma.advancedEvaluationRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

export default router;
