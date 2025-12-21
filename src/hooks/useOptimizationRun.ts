import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// ============================================================
// Types
// ============================================================

export interface OptimizationRunProgress {
  runId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
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

export interface OptimizationRunResult {
  id: string;
  runId: string;
  optimizedSnapshot: unknown;
  baselineScore?: number;
  optimizedScore?: number;
  scoreDelta?: number;
  cost?: {
    calls?: number;
    tokens?: number;
    usd?: number;
  };
  diagnostics?: unknown;
  appliedVersion?: {
    id: string;
    versionNumber: number;
  };
}

export interface UseOptimizationRunOptions {
  runId?: string;
  workspaceId?: string;
  autoConnect?: boolean;
  pollingInterval?: number;
  onProgress?: (progress: OptimizationRunProgress) => void;
  onComplete?: (result: OptimizationRunResult) => void;
  onError?: (error: string) => void;
}

export interface UseOptimizationRunReturn {
  status: OptimizationRunProgress['status'] | null;
  progress: number;
  stage: string;
  cost: OptimizationRunProgress['cost'] | null;
  result: OptimizationRunResult | null;
  error: string | null;
  isConnected: boolean;
  isLoading: boolean;
  subscribe: (runId: string) => void;
  unsubscribe: () => void;
  refresh: () => Promise<void>;
  restart: () => Promise<string | null>;
  cancel: () => Promise<boolean>;
  apply: (activate?: boolean) => Promise<{ newVersionId: string; versionNumber: number } | null>;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useOptimizationRun(options: UseOptimizationRunOptions = {}): UseOptimizationRunReturn {
  const {
    runId: initialRunId,
    workspaceId,
    autoConnect = true,
    pollingInterval = 2000,
    onProgress,
    onComplete,
    onError,
  } = options;

  // State
  const [currentRunId, setCurrentRunId] = useState<string | null>(initialRunId || null);
  const [status, setStatus] = useState<OptimizationRunProgress['status'] | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [cost, setCost] = useState<OptimizationRunProgress['cost'] | null>(null);
  const [result, setResult] = useState<OptimizationRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const token = localStorage.getItem('authToken');
    if (!token) {
      console.warn('No auth token found, falling back to polling');
      return;
    }

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('WebSocket connected for optimization run updates');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('optimization_progress', (data: OptimizationRunProgress) => {
      if (currentRunId && data.runId === currentRunId) {
        setStatus(data.status);
        setProgress(data.progress);
        if (data.stage) setStage(data.stage);
        if (data.cost) setCost(data.cost);
        if (data.errorMessage) setError(data.errorMessage);

        onProgress?.(data);

        // If completed, fetch full result
        if (data.status === 'succeeded') {
          fetchResult(data.runId);
        }

        if (data.status === 'failed') {
          onError?.(data.errorMessage || 'Optimization failed');
        }
      }
    });

    socket.on('run_status', (data: { runId: string; status: string; progress: number; stage?: string; errorMessage?: string }) => {
      if (currentRunId && data.runId === currentRunId) {
        setStatus(data.status as OptimizationRunProgress['status']);
        setProgress(data.progress);
        if (data.stage) setStage(data.stage);
        if (data.errorMessage) setError(data.errorMessage);
      }
    });

    socketRef.current = socket;
  }, [currentRunId, onProgress, onError]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Subscribe to a run
  const subscribe = useCallback((runId: string) => {
    setCurrentRunId(runId);
    setStatus(null);
    setProgress(0);
    setStage('');
    setCost(null);
    setResult(null);
    setError(null);

    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe_run', { runId, type: 'optimization' });
    }

    // Start polling as fallback
    startPolling(runId);
  }, []);

  // Unsubscribe from current run
  const unsubscribe = useCallback(() => {
    if (currentRunId && socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe_run', { runId: currentRunId });
    }
    stopPolling();
    setCurrentRunId(null);
  }, [currentRunId]);

  // Fetch run status via API
  const fetchStatus = useCallback(async (runId: string) => {
    try {
      const response = await fetch(`/api/optimize/${runId}`);
      if (!response.ok) throw new Error('Failed to fetch run status');

      const data = await response.json();
      setStatus(data.status);
      setProgress(data.progress);
      if (data.stage) setStage(data.stage);
      if (data.errorMessage) setError(data.errorMessage);

      // If completed, fetch result
      if (data.status === 'succeeded' && !result) {
        await fetchResult(runId);
      }

      return data;
    } catch (err) {
      console.error('Error fetching run status:', err);
      return null;
    }
  }, [result]);

  // Fetch optimization result
  const fetchResult = useCallback(async (runId: string) => {
    try {
      const response = await fetch(`/api/optimize/${runId}/result`);
      if (!response.ok) return null;

      const data = await response.json();
      setResult(data);
      onComplete?.(data);
      return data;
    } catch (err) {
      console.error('Error fetching result:', err);
      return null;
    }
  }, [onComplete]);

  // Start polling
  const startPolling = useCallback((runId: string) => {
    stopPolling();

    pollingRef.current = setInterval(async () => {
      const data = await fetchStatus(runId);
      if (data && (data.status === 'succeeded' || data.status === 'failed' || data.status === 'canceled')) {
        stopPolling();
      }
    }, pollingInterval);
  }, [fetchStatus, pollingInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Refresh current run status
  const refresh = useCallback(async () => {
    if (!currentRunId) return;
    setIsLoading(true);
    await fetchStatus(currentRunId);
    setIsLoading(false);
  }, [currentRunId, fetchStatus]);

  // Restart the run
  const restart = useCallback(async (): Promise<string | null> => {
    if (!currentRunId) return null;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/optimize/${currentRunId}/restart`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to restart run');
      }

      const data = await response.json();
      subscribe(data.newRunId);
      return data.newRunId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restart');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentRunId, subscribe]);

  // Cancel the run
  const cancel = useCallback(async (): Promise<boolean> => {
    if (!currentRunId) return false;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/optimize/${currentRunId}/cancel`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to cancel run');

      setStatus('canceled');
      stopPolling();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentRunId, stopPolling]);

  // Apply the result
  const apply = useCallback(async (activate = true): Promise<{ newVersionId: string; versionNumber: number } | null> => {
    if (!currentRunId || !result) return null;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/optimize/${currentRunId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activate }),
      });

      if (!response.ok) throw new Error('Failed to apply result');

      const data = await response.json();
      return { newVersionId: data.newVersionId, versionNumber: data.versionNumber };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentRunId, result]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
      stopPolling();
    };
  }, [autoConnect, connect, disconnect, stopPolling]);

  // Subscribe to initial runId
  useEffect(() => {
    if (initialRunId) {
      subscribe(initialRunId);
    }
  }, [initialRunId, subscribe]);

  return {
    status,
    progress,
    stage,
    cost,
    result,
    error,
    isConnected,
    isLoading,
    subscribe,
    unsubscribe,
    refresh,
    restart,
    cancel,
    apply,
  };
}

export default useOptimizationRun;
