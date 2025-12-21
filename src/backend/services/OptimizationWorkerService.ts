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
import { parseContentSnapshot } from '../../shared/utils/promptRenderer.js';
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
            include: { examples: true },
          },
        },
      });

      if (!run) {
        throw new Error('Run not found');
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
        metricType: run.metricType as 'exact_match' | 'contains' | 'json_valid',
        budget: run.budget as { maxCalls?: number; maxTokens?: number; maxUSD?: number },
      });

      // Check if aborted
      if (abortController.signal.aborted) {
        throw new Error('Job aborted');
      }

      // 5. Save result
      await this.updateRunProgress(runId, STAGES.SAVING);
      logger.info('Saving results', STAGES.SAVING);

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
          diagnostics: compileResult.diagnostics as unknown as Prisma.InputJsonValue,
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
