// ============================================================
// Optimization Worker Service
// Handles job pickup, progress updates, success/failure flows
// ============================================================

import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { QueueService } from './QueueService.js';
import { DspyServiceClient } from './DspyServiceClient.js';
import { BudgetEnforcementService } from './BudgetEnforcementService.js';
import { workerLogger, optimizationLogger } from './StructuredLogger.js';
import {
  createContentSnapshot,
  parseContentSnapshot,
  renderPromptParts,
} from '../../shared/utils/promptRenderer.js';
import {
  getMetric,
  setLLMJudgeClient,
  type JudgeModelConfig,
  type JudgeRubricConfig,
} from '../lib/metrics/index.js';
import { DEFAULT_JUDGE_MODEL_CONFIG, DEFAULT_JUDGE_RUBRIC } from '../lib/metrics/defaultRubric.js';
import type { Server as SocketIOServer } from 'socket.io';

// ============================================================
// Types
// ============================================================

export interface OptimizationJobPayload {
  runId: string;
  templateId: string;
  baseVersionId: string;
  datasetId: string;
  optimizerType: string;
  metricType: string;
  budget: {
    maxCalls?: number;
    maxTokens?: number;
    maxUSD?: number;
  };
  tenantId?: string;
  workspaceId?: string;
}

export interface WorkerConfig {
  pollIntervalMs: number;
  maxConcurrentJobs: number;
  jobTimeoutMs: number;
  progressUpdateIntervalMs: number;
}

export interface RunProgress {
  runId: string;
  status: string;
  progress: number;
  stage: string;
  cost?: {
    calls: number;
    tokens: number;
    usd: number;
  };
}

// ============================================================
// Stage Definitions
// ============================================================

const STAGES = {
  QUEUED: { stage: 'Waiting to start', progress: 0 },
  LOADING: { stage: 'Loading data', progress: 10 },
  PREPARING: { stage: 'Preparing DSPy compilation', progress: 20 },
  CALLING_DSPY: { stage: 'Calling DSPy service', progress: 40 },
  COMPILING: { stage: 'Compiling optimizations', progress: 60 },
  EVALUATING: { stage: 'Evaluating results', progress: 80 },
  SAVING: { stage: 'Saving results', progress: 90 },
  COMPLETED: { stage: 'Completed', progress: 100 },
};

class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

// ============================================================
// Optimization Worker Service
// ============================================================

export class OptimizationWorkerService {
  private queueService: QueueService;
  private dspyClient: DspyServiceClient;
  private budgetService: BudgetEnforcementService;
  private io?: SocketIOServer;
  private isRunning: boolean = false;
  private activeJobs: Map<string, { abortController: AbortController }> = new Map();

  private config: WorkerConfig = {
    pollIntervalMs: 1000,
    maxConcurrentJobs: 3,
    jobTimeoutMs: 300000, // 5 minutes
    progressUpdateIntervalMs: 2000,
  };

  constructor(io?: SocketIOServer) {
    this.queueService = new QueueService();
    this.dspyClient = new DspyServiceClient();
    this.budgetService = new BudgetEnforcementService();
    this.io = io;

    // Register optimization queue
    this.queueService.registerQueue({
      name: 'optimization',
      maxConcurrency: this.config.maxConcurrentJobs,
      retryAttempts: 3,
      timeout: this.config.jobTimeoutMs,
      deadLetterQueue: 'optimization_dlq',
    });

    workerLogger.info('Optimization worker initialized');
  }

  /**
   * Set WebSocket server for real-time updates
   */
  setSocketServer(io: SocketIOServer): void {
    this.io = io;
  }

  /**
   * Start the worker polling loop
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      workerLogger.warn('Worker is already running');
      return;
    }

    this.isRunning = true;
    workerLogger.info('Starting optimization worker');

    this.pollLoop();
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    workerLogger.info('Stopping optimization worker');

    // Abort all active jobs
    for (const [runId, job] of this.activeJobs) {
      job.abortController.abort();
      workerLogger.info('Aborted job', { runId });
    }

    this.activeJobs.clear();
    await this.queueService.close();
  }

  /**
   * Enqueue an optimization job
   */
  async enqueueJob(payload: OptimizationJobPayload): Promise<string> {
    const logger = optimizationLogger.child({
      runId: payload.runId,
      workspaceId: payload.workspaceId || payload.tenantId,
    });

    logger.info('Enqueueing optimization job', {
      templateId: payload.templateId,
      optimizerType: payload.optimizerType,
      metricType: payload.metricType,
    });

    const messageId = await this.queueService.enqueue('optimization', {
      type: 'optimization_run',
      payload: payload as unknown as Record<string, unknown>,
      tenantId: payload.tenantId,
    });

    logger.info('Job enqueued', { messageId });

    return messageId;
  }

  /**
   * Cancel a running optimization job
   */
  async cancelJob(runId: string): Promise<boolean> {
    const logger = optimizationLogger.child({ runId });

    const activeJob = this.activeJobs.get(runId);
    if (activeJob) {
      activeJob.abortController.abort();
      this.activeJobs.delete(runId);
      logger.info('Job cancelled (active)');
    }

    // Update database status
    await prisma.optimizationRun.update({
      where: { id: runId },
      data: {
        status: 'canceled',
        finishedAt: new Date(),
      },
    });

    // Emit cancellation event
    this.emitRunUpdate(runId, {
      status: 'canceled',
      progress: 0,
      stage: 'Cancelled by user',
    });

    logger.info('Job marked as cancelled');

    return true;
  }

  /**
   * Restart a failed optimization run with same settings
   */
  async restartRun(runId: string): Promise<string> {
    const logger = optimizationLogger.child({ runId });

    // Get original run
    const originalRun = await prisma.optimizationRun.findUnique({
      where: { id: runId },
    });

    if (!originalRun) {
      throw new Error('Original run not found');
    }

    if (originalRun.status !== 'failed' && originalRun.status !== 'canceled') {
      throw new Error('Can only restart failed or cancelled runs');
    }

    logger.info('Restarting run', {
      originalStatus: originalRun.status,
      optimizerType: originalRun.optimizerType,
    });

    // Create new run with same settings
    const newRun = await prisma.optimizationRun.create({
      data: {
        templateId: originalRun.templateId,
        baseVersionId: originalRun.baseVersionId,
        datasetId: originalRun.datasetId,
        optimizerType: originalRun.optimizerType,
        metricType: originalRun.metricType,
        budget: originalRun.budget as Prisma.InputJsonValue,
        status: 'queued',
        progress: 0,
        stage: 'Waiting to start',
        tenantId: originalRun.tenantId,
        createdById: originalRun.createdById,
      },
    });

    // Enqueue new job
    await this.enqueueJob({
      runId: newRun.id,
      templateId: newRun.templateId,
      baseVersionId: newRun.baseVersionId,
      datasetId: newRun.datasetId,
      optimizerType: newRun.optimizerType,
      metricType: newRun.metricType,
      budget: newRun.budget as { maxCalls?: number; maxTokens?: number; maxUSD?: number },
      tenantId: newRun.tenantId ?? undefined,
    });

    logger.info('Run restarted', { newRunId: newRun.id });

    return newRun.id;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * Main polling loop
   */
  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check if we can take more jobs
        if (this.activeJobs.size < this.config.maxConcurrentJobs) {
          // Also check for runs that are stuck in 'queued' status
          await this.pickupQueuedRuns();

          // Try to dequeue from Redis queue
          const message = await this.queueService.dequeue('optimization');
          if (message) {
            this.processJob(message.id, message.payload as unknown as OptimizationJobPayload);
          }
        }

        // Wait before next poll
        await this.sleep(this.config.pollIntervalMs);
      } catch (error) {
        workerLogger.errorWithStack('Error in poll loop', error as Error);
        await this.sleep(this.config.pollIntervalMs * 2);
      }
    }
  }

  /**
   * Pick up runs that are in 'queued' status in the database
   */
  private async pickupQueuedRuns(): Promise<void> {
    const queuedRuns = await prisma.optimizationRun.findMany({
      where: {
        status: 'queued',
      },
      take: this.config.maxConcurrentJobs - this.activeJobs.size,
      orderBy: { createdAt: 'asc' },
    });

    for (const run of queuedRuns) {
      if (this.activeJobs.has(run.id)) {
        continue; // Already processing
      }

      const payload: OptimizationJobPayload = {
        runId: run.id,
        templateId: run.templateId,
        baseVersionId: run.baseVersionId,
        datasetId: run.datasetId,
        optimizerType: run.optimizerType,
        metricType: run.metricType,
        budget: run.budget as { maxCalls?: number; maxTokens?: number; maxUSD?: number },
        tenantId: run.tenantId ?? undefined,
      };

      this.processJob(`db_${run.id}`, payload);
    }
  }

  /**
   * Process a single optimization job
   */
  private async processJob(messageId: string, payload: OptimizationJobPayload): Promise<void> {
    const { runId } = payload;
    const abortController = new AbortController();
    this.activeJobs.set(runId, { abortController });

    const logger = optimizationLogger.child({
      runId,
      workspaceId: payload.workspaceId || payload.tenantId,
      templateId: payload.templateId,
      optimizerType: payload.optimizerType,
      metricType: payload.metricType,
    });

    const startTime = Date.now();
    logger.info('Starting job processing');

    try {
      // 1. Update status to running
      await this.updateRunStatus(runId, 'running', STAGES.LOADING);
      logger.info('Status updated to running', STAGES.LOADING);

      // Check if aborted
      if (abortController.signal.aborted) {
        throw new Error('Job aborted');
      }

      // 2. Load run data
      const run = await prisma.optimizationRun.findUnique({
        where: { id: runId },
        include: {
          baseVersion: true,
          dataset: {
            include: { examples: true, judgeRubric: true },
          },
        },
      });

      if (!run) {
        throw new Error('Run not found');
      }

      const selectedMetricType = run.dataset.format === 'unlabeled'
        ? 'judge_rubric'
        : this.resolveComparisonMetric(run.metricType);

      if (selectedMetricType !== run.metricType) {
        await prisma.optimizationRun.update({
          where: { id: runId },
          data: { metricType: selectedMetricType },
        });
      }

      // 3. Update progress
      await this.updateRunProgress(runId, STAGES.PREPARING);
      logger.info('Preparing DSPy compilation', STAGES.PREPARING);

      // Parse content snapshot
      const contentSnapshot = parseContentSnapshot(run.baseVersion.contentSnapshot);

      // Prepare dataset for DSPy
      const dspyDataset = run.dataset.examples.map(ex => ({
        input_variables: ex.inputVariables as Record<string, unknown>,
        expected_output: ex.expectedOutput || undefined,
      }));

      // Check if aborted
      if (abortController.signal.aborted) {
        throw new Error('Job aborted');
      }

      // 4. Call DSPy service
      await this.updateRunProgress(runId, STAGES.CALLING_DSPY);
      logger.info('Calling DSPy service', STAGES.CALLING_DSPY);

      const compileResult = await this.dspyClient.compile({
        basePromptSnapshot: {
          system: contentSnapshot.system,
          developer: contentSnapshot.developer,
          user: contentSnapshot.user,
          context: contentSnapshot.context,
        },
        dataset: dspyDataset,
        model: {
          providerModelString: contentSnapshot.modelConfig?.model || 'gpt-4',
          temperature: contentSnapshot.modelConfig?.temperature,
          maxTokens: contentSnapshot.modelConfig?.maxTokens,
        },
        optimizer: {
          type: run.optimizerType as 'bootstrap_fewshot' | 'copro',
        },
        metricType: selectedMetricType as 'exact_match' | 'contains' | 'json_valid' | 'judge_rubric',
        budget: run.budget as { maxCalls?: number; maxTokens?: number; maxUSD?: number },
      });

      // Check if aborted
      if (abortController.signal.aborted) {
        throw new Error('Job aborted');
      }

      // 5. Evaluate A/B results
      await this.updateRunProgress(runId, STAGES.EVALUATING);
      logger.info('Evaluating A/B comparison', STAGES.EVALUATING);

      const abComparison = await this.runAbComparison({
        dataset: run.dataset,
        baseSnapshot: contentSnapshot,
        optimizedSnapshot: compileResult.optimizedPromptSnapshot,
        metricType: selectedMetricType,
        budget: run.budget as { maxCalls?: number; maxTokens?: number; maxUSD?: number },
      });

      // 6. Save result
      await this.updateRunProgress(runId, STAGES.SAVING);
      logger.info('Saving results', STAGES.SAVING);

      const baseDiagnostics = (compileResult.diagnostics ?? {}) as Record<string, unknown>;

      await prisma.optimizationResult.create({
        data: {
          runId,
          optimizedSnapshot: compileResult.optimizedPromptSnapshot as unknown as Prisma.InputJsonValue,
          dspyArtifactJson: compileResult.dspyArtifactJson
            ? JSON.parse(compileResult.dspyArtifactJson)
            : null,
          baselineScore: compileResult.baselineScore,
          optimizedScore: compileResult.optimizedScore,
          scoreDelta: compileResult.delta,
          cost: compileResult.cost as unknown as Prisma.InputJsonValue,
          diagnostics: {
            ...baseDiagnostics,
            abComparison,
          } as Prisma.InputJsonValue,
        },
      });

      // 6. Mark as succeeded
      const duration = Date.now() - startTime;
      await prisma.optimizationRun.update({
        where: { id: runId },
        data: {
          status: 'succeeded',
          finishedAt: new Date(),
          stage: STAGES.COMPLETED.stage,
          progress: STAGES.COMPLETED.progress,
        },
      });

      // Emit success
      this.emitRunUpdate(runId, {
        status: 'succeeded',
        progress: 100,
        stage: 'Completed',
        result: {
          baselineScore: compileResult.baselineScore,
          optimizedScore: compileResult.optimizedScore,
          delta: compileResult.delta,
          cost: compileResult.cost,
          abComparison,
        },
      });

      logger.info('Job completed successfully', {
        duration,
        baselineScore: compileResult.baselineScore,
        optimizedScore: compileResult.optimizedScore,
        delta: compileResult.delta,
        cost: compileResult.cost,
      });

      // Record cost for budget tracking
      if (payload.tenantId && compileResult.cost) {
        await this.budgetService.recordRunCost(payload.tenantId, {
          calls: compileResult.cost.calls || 0,
          tokens: compileResult.cost.tokens || 0,
          usd: compileResult.cost.usdEstimate || 0,
        });
      }

      // Complete queue message
      if (!messageId.startsWith('db_')) {
        await this.queueService.complete('optimization', messageId);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.errorWithStack('Job failed', error as Error, { duration });

      if (error instanceof BudgetExceededError) {
        await this.budgetService.hardStopRun('optimization', runId, errorMessage);
        this.emitRunUpdate(runId, {
          status: 'failed',
          progress: 0,
          stage: 'Budget exceeded',
          errorMessage,
        });

        if (!messageId.startsWith('db_')) {
          await this.queueService.fail('optimization', messageId, errorMessage);
        }

        return;
      }

      // Mark as failed
      await prisma.optimizationRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage,
        },
      });

      // Emit failure
      this.emitRunUpdate(runId, {
        status: 'failed',
        progress: 0,
        stage: 'Failed',
        errorMessage,
      });

      // Fail queue message
      if (!messageId.startsWith('db_')) {
        await this.queueService.fail('optimization', messageId, errorMessage);
      }
    } finally {
      this.activeJobs.delete(runId);
    }
  }

  /**
   * Update run status
   */
  private async updateRunStatus(
    runId: string,
    status: string,
    stageInfo: { stage: string; progress: number }
  ): Promise<void> {
    await prisma.optimizationRun.update({
      where: { id: runId },
      data: {
        status,
        stage: stageInfo.stage,
        progress: stageInfo.progress,
        startedAt: status === 'running' ? new Date() : undefined,
      },
    });

    this.emitRunUpdate(runId, {
      status,
      progress: stageInfo.progress,
      stage: stageInfo.stage,
    });
  }

  /**
   * Update run progress
   */
  private async updateRunProgress(
    runId: string,
    stageInfo: { stage: string; progress: number }
  ): Promise<void> {
    await prisma.optimizationRun.update({
      where: { id: runId },
      data: {
        stage: stageInfo.stage,
        progress: stageInfo.progress,
      },
    });

    this.emitRunUpdate(runId, {
      status: 'running',
      progress: stageInfo.progress,
      stage: stageInfo.stage,
    });
  }

  /**
   * Emit real-time run update via WebSocket
   */
  private emitRunUpdate(runId: string, update: Partial<RunProgress> & { result?: unknown; errorMessage?: string }): void {
    if (!this.io) return;

    this.io.emit('optimization_progress', {
      runId,
      ...update,
      timestamp: Date.now(),
    });
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private resolveComparisonMetric(metricType: string): 'exact_match' | 'contains' | 'json_valid' {
    if (metricType === 'exact_match' || metricType === 'contains' || metricType === 'json_valid') {
      return metricType;
    }
    return 'exact_match';
  }

  private buildOptimizedSnapshot(
    baseSnapshot: ReturnType<typeof parseContentSnapshot>,
    optimizedSnapshot: { system: string; developer?: string }
  ): ReturnType<typeof createContentSnapshot> {
    return createContentSnapshot(
      {
        system: optimizedSnapshot.system,
        developer: optimizedSnapshot.developer ?? baseSnapshot.developer,
        user: baseSnapshot.user,
        context: baseSnapshot.context,
      },
      {
        variablesSchema: baseSnapshot.variablesSchema,
        defaultValues: baseSnapshot.defaultValues,
        modelConfig: baseSnapshot.modelConfig,
      }
    );
  }

  private async runAbComparison({
    dataset,
    baseSnapshot,
    optimizedSnapshot,
    metricType,
    budget,
  }: {
    dataset: {
      format: string;
      examples: Array<{
        id: string;
        inputVariables: Prisma.InputJsonValue;
        expectedOutput: string | null;
        metadata: Prisma.InputJsonValue | null;
      }>;
      judgeRubric?: { rubricJson: Prisma.InputJsonValue; modelConfig: Prisma.InputJsonValue } | null;
    };
    baseSnapshot: ReturnType<typeof parseContentSnapshot>;
    optimizedSnapshot: { system: string; developer?: string };
    metricType: string;
    budget: { maxCalls?: number; maxTokens?: number; maxUSD?: number };
  }): Promise<{
    metricType: 'exact_match' | 'contains' | 'json_valid' | 'judge_rubric';
    sampleCount: number;
    winsBaseline: number;
    winsOptimized: number;
    ties: number;
    examples?: Array<{
      exampleId: string;
      winner: 'baseline' | 'optimized' | 'tie';
      scoreBaseline?: number;
      scoreOptimized?: number;
      reason?: string;
    }>;
  } | null> {
    if (dataset.examples.length === 0) {
      return null;
    }

    const optimizedContent = this.buildOptimizedSnapshot(baseSnapshot, optimizedSnapshot);
    const rubric = dataset.judgeRubric?.rubricJson as JudgeRubricConfig | undefined;
    const modelConfig = dataset.judgeRubric?.modelConfig as JudgeModelConfig | undefined;
    const judgeBudget = {
      maxCalls: budget.maxCalls ?? 100,
      maxTokens: budget.maxTokens ?? 100000,
      maxUSD: budget.maxUSD ?? 10,
    };

    let judgeCalls = 0;
    let judgeTokens = 0;

    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    setLLMJudgeClient({
      async call(prompt: string, config?: JudgeModelConfig): Promise<string> {
        if (judgeCalls >= judgeBudget.maxCalls) {
          throw new BudgetExceededError(`Judge calls exceeded ${judgeBudget.maxCalls}`);
        }
        if (judgeTokens >= judgeBudget.maxTokens) {
          throw new BudgetExceededError(`Judge tokens exceeded ${judgeBudget.maxTokens}`);
        }
        if ((judgeTokens / 1000) * 0.03 >= judgeBudget.maxUSD) {
          throw new BudgetExceededError(`Judge cost exceeded $${judgeBudget.maxUSD}`);
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

        if (judgeCalls >= judgeBudget.maxCalls) {
          throw new BudgetExceededError(`Judge calls exceeded ${judgeBudget.maxCalls}`);
        }
        if (judgeTokens >= judgeBudget.maxTokens) {
          throw new BudgetExceededError(`Judge tokens exceeded ${judgeBudget.maxTokens}`);
        }
        if ((judgeTokens / 1000) * 0.03 >= judgeBudget.maxUSD) {
          throw new BudgetExceededError(`Judge cost exceeded $${judgeBudget.maxUSD}`);
        }

        return response.choices[0]?.message?.content || '{}';
      },
    });

    const comparisonMetricType = dataset.format === 'unlabeled'
      ? 'judge_rubric'
      : this.resolveComparisonMetric(metricType);

    const metric = getMetric(dataset.format === 'unlabeled' ? 'pairwise_judge' : comparisonMetricType);
    if (!metric) {
      return null;
    }

    let winsBaseline = 0;
    let winsOptimized = 0;
    let ties = 0;
    const exampleSummaries: Array<{
      exampleId: string;
      winner: 'baseline' | 'optimized' | 'tie';
      scoreBaseline?: number;
      scoreOptimized?: number;
      reason?: string;
    }> = [];

    for (const example of dataset.examples) {
      const inputVars = example.inputVariables as Record<string, unknown>;
      const baseRendered = renderPromptParts(baseSnapshot, inputVars);
      const optimizedRendered = renderPromptParts(optimizedContent, inputVars);

      const [baseOutput, optimizedOutput] = await Promise.all([
        this.generateOutput(openai, baseRendered, baseSnapshot.modelConfig),
        this.generateOutput(openai, optimizedRendered, optimizedContent.modelConfig),
      ]);

      let winner: 'baseline' | 'optimized' | 'tie' = 'tie';
      let scoreBaseline = 0.5;
      let scoreOptimized = 0.5;
      let reason: string | undefined;

      if (dataset.format === 'unlabeled') {
        const result = await metric(baseOutput, {
          example: {
            id: example.id,
            inputVariables: inputVars,
            expectedOutput: example.expectedOutput ?? undefined,
            metadata: example.metadata as Record<string, unknown> | undefined,
          },
          outputA: baseOutput,
          outputB: optimizedOutput,
          rubric: rubric ?? DEFAULT_JUDGE_RUBRIC,
          modelConfig: modelConfig ?? DEFAULT_JUDGE_MODEL_CONFIG,
        });

        const judgeWinner = (result.details?.winner as string | undefined) ?? 'tie';
        reason = result.reason;
        scoreBaseline = (result.details?.scoreA as number | undefined) ?? 0.5;
        scoreOptimized = (result.details?.scoreB as number | undefined) ?? 0.5;

        if (judgeWinner === 'A') {
          winner = 'baseline';
        } else if (judgeWinner === 'B') {
          winner = 'optimized';
        }
      } else {
        const baseResult = await metric(baseOutput, {
          example: {
            id: example.id,
            inputVariables: inputVars,
            expectedOutput: example.expectedOutput ?? undefined,
            metadata: example.metadata as Record<string, unknown> | undefined,
          },
        });
        const optimizedResult = await metric(optimizedOutput, {
          example: {
            id: example.id,
            inputVariables: inputVars,
            expectedOutput: example.expectedOutput ?? undefined,
            metadata: example.metadata as Record<string, unknown> | undefined,
          },
        });

        scoreBaseline = baseResult.score;
        scoreOptimized = optimizedResult.score;
        reason = optimizedResult.reason;

        if (scoreBaseline > scoreOptimized) {
          winner = 'baseline';
        } else if (scoreOptimized > scoreBaseline) {
          winner = 'optimized';
        }
      }

      if (winner === 'baseline') {
        winsBaseline += 1;
      } else if (winner === 'optimized') {
        winsOptimized += 1;
      } else {
        ties += 1;
      }

      if (exampleSummaries.length < 10) {
        exampleSummaries.push({
          exampleId: example.id,
          winner,
          scoreBaseline,
          scoreOptimized,
          reason,
        });
      }
    }

    return {
      metricType: dataset.format === 'unlabeled' ? 'judge_rubric' : comparisonMetricType,
      sampleCount: dataset.examples.length,
      winsBaseline,
      winsOptimized,
      ties,
      examples: exampleSummaries,
    };
  }

  private async generateOutput(
    openai: { chat: { completions: { create: (args: {
      model: string;
      messages: Array<{ role: 'system' | 'user'; content: string }>;
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      frequency_penalty?: number;
      presence_penalty?: number;
    }) => Promise<{ choices: Array<{ message?: { content?: string } }>; usage?: { total_tokens?: number } }> } } },
    rendered: { system: string; user: string; context?: string },
    modelConfig?: { model?: string; temperature?: number; maxTokens?: number; topP?: number; frequencyPenalty?: number; presencePenalty?: number }
  ): Promise<string> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

    if (rendered.system) {
      messages.push({ role: 'system', content: rendered.system });
    }

    let userContent = rendered.user;
    if (rendered.context) {
      userContent = `${rendered.context}\n\n${userContent}`;
    }
    messages.push({ role: 'user', content: userContent });

    const response = await openai.chat.completions.create({
      model: modelConfig?.model || 'gpt-4',
      messages,
      temperature: modelConfig?.temperature ?? 0.7,
      max_tokens: modelConfig?.maxTokens ?? 1024,
      top_p: modelConfig?.topP ?? 1,
      frequency_penalty: modelConfig?.frequencyPenalty ?? 0,
      presence_penalty: modelConfig?.presencePenalty ?? 0,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  }
}

// ============================================================
// Singleton Export
// ============================================================

let workerInstance: OptimizationWorkerService | null = null;

export function getOptimizationWorker(io?: SocketIOServer): OptimizationWorkerService {
  if (!workerInstance) {
    workerInstance = new OptimizationWorkerService(io);
  } else if (io) {
    workerInstance.setSocketServer(io);
  }
  return workerInstance;
}
