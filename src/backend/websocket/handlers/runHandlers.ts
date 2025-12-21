// ============================================================
// Run WebSocket Handlers
// Real-time updates for optimization and evaluation runs
// ============================================================

import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from '../index.js';
import { prisma } from '../../lib/prisma.js';
import { workerLogger } from '../../services/StructuredLogger.js';

// ============================================================
// Types
// ============================================================

interface RunSubscription {
  runId: string;
  type: 'optimization' | 'evaluation';
}

interface RunProgressUpdate {
  runId: string;
  status: string;
  progress: number;
  stage?: string;
  cost?: {
    calls?: number;
    tokens?: number;
    usd?: number;
  };
  result?: {
    baselineScore?: number;
    optimizedScore?: number;
    delta?: number;
  };
  errorMessage?: string;
  timestamp: number;
}

// ============================================================
// Handler Registration
// ============================================================

export function handleRunEvents(
  io: SocketIOServer,
  socket: AuthenticatedSocket
): void {
  const logger = workerLogger.child({ userId: socket.userId });

  // Subscribe to run updates
  socket.on('subscribe_run', async (data: RunSubscription) => {
    const { runId, type } = data;

    logger.info('User subscribing to run updates', { runId, type });

    // Join room for this run
    const roomName = `run:${runId}`;
    await socket.join(roomName);

    // Send current status immediately
    try {
      let run: { status: string; progress: number; stage?: string | null; errorMessage?: string | null } | null = null;

      if (type === 'optimization') {
        run = await prisma.optimizationRun.findUnique({
          where: { id: runId },
          select: { status: true, progress: true, stage: true, errorMessage: true },
        });
      } else {
        run = await prisma.advancedEvaluationRun.findUnique({
          where: { id: runId },
          select: { status: true, progress: true, stage: true, errorMessage: true },
        });
      }

      if (run) {
        socket.emit('run_status', {
          runId,
          type,
          status: run.status,
          progress: run.progress,
          stage: run.stage,
          errorMessage: run.errorMessage,
        });
      }
    } catch (error) {
      logger.error('Failed to fetch run status', { runId, error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Unsubscribe from run updates
  socket.on('unsubscribe_run', async (data: { runId: string }) => {
    const { runId } = data;
    const roomName = `run:${runId}`;
    await socket.leave(roomName);
    logger.info('User unsubscribed from run updates', { runId });
  });

  // Subscribe to workspace runs
  socket.on('subscribe_workspace_runs', async (data: { workspaceId: string }) => {
    const { workspaceId } = data;
    const roomName = `workspace:${workspaceId}:runs`;
    await socket.join(roomName);
    logger.info('User subscribed to workspace runs', { workspaceId });
  });

  // Unsubscribe from workspace runs
  socket.on('unsubscribe_workspace_runs', async (data: { workspaceId: string }) => {
    const { workspaceId } = data;
    const roomName = `workspace:${workspaceId}:runs`;
    await socket.leave(roomName);
    logger.info('User unsubscribed from workspace runs', { workspaceId });
  });
}

// ============================================================
// Broadcast Helpers
// ============================================================

/**
 * Broadcast run progress to subscribed clients
 */
export function broadcastRunProgress(
  io: SocketIOServer,
  update: RunProgressUpdate
): void {
  const roomName = `run:${update.runId}`;
  io.to(roomName).emit('run_progress', update);
}

/**
 * Broadcast new run to workspace subscribers
 */
export function broadcastNewRun(
  io: SocketIOServer,
  workspaceId: string,
  run: {
    id: string;
    type: 'optimization' | 'evaluation';
    status: string;
    templateName?: string;
    datasetName?: string;
    createdAt: Date;
  }
): void {
  const roomName = `workspace:${workspaceId}:runs`;
  io.to(roomName).emit('new_run', run);
}

/**
 * Broadcast run completion to workspace
 */
export function broadcastRunCompleted(
  io: SocketIOServer,
  workspaceId: string,
  run: {
    id: string;
    type: 'optimization' | 'evaluation';
    status: string;
    score?: number;
    cost?: { usd?: number };
    duration?: number;
  }
): void {
  const roomName = `workspace:${workspaceId}:runs`;
  io.to(roomName).emit('run_completed', run);
}

/**
 * Broadcast version applied
 */
export function broadcastVersionApplied(
  io: SocketIOServer,
  workspaceId: string,
  data: {
    templateId: string;
    newVersionId: string;
    versionNumber: number;
    runId: string;
    isActive: boolean;
  }
): void {
  const roomName = `workspace:${workspaceId}:runs`;
  io.to(roomName).emit('version_applied', data);

  // Also emit to template subscribers if any
  const templateRoom = `template:${data.templateId}`;
  io.to(templateRoom).emit('template_version_updated', {
    templateId: data.templateId,
    activeVersionId: data.isActive ? data.newVersionId : undefined,
    newVersionId: data.newVersionId,
    versionNumber: data.versionNumber,
  });
}
