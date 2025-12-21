'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  DollarSign,
  Zap,
  Settings,
  RefreshCw,
} from 'lucide-react';

interface OptimizationConfig {
  optimizerType: 'bootstrap_fewshot' | 'copro';
  metricType: 'exact_match' | 'contains' | 'json_valid';
  budget: {
    maxCalls: number;
    maxTokens: number;
    maxUSD: number;
  };
}

interface OptimizationRun {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  progress: number;
  stage?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

interface OptimizationResult {
  id: string;
  runId: string;
  optimizedSnapshot: {
    system: string;
    developer?: string;
    demos?: Array<{ input: string; output: string }>;
  };
  baselineScore: number;
  optimizedScore: number;
  scoreDelta: number;
  cost: {
    calls: number;
    tokens: number;
    usdEstimate: number;
  };
}

interface OptimizePanelProps {
  templateId: string;
  versionId: string;
  datasetId: string;
  disabled?: boolean;
  onOptimizationComplete?: (result: OptimizationResult) => void;
  onApplyResult?: (resultId: string) => void;
}

const DEFAULT_CONFIG: OptimizationConfig = {
  optimizerType: 'bootstrap_fewshot',
  metricType: 'exact_match',
  budget: {
    maxCalls: 50,
    maxTokens: 50000,
    maxUSD: 5,
  },
};

export function OptimizePanel({
  templateId,
  versionId,
  datasetId,
  disabled = false,
  onOptimizationComplete,
  onApplyResult,
}: OptimizePanelProps) {
  const [config, setConfig] = useState<OptimizationConfig>(DEFAULT_CONFIG);
  const [showSettings, setShowSettings] = useState(false);
  const [currentRun, setCurrentRun] = useState<OptimizationRun | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Start optimization
  const startOptimization = async () => {
    if (!templateId || !versionId || !datasetId) {
      setError('Please select a template, version, and dataset');
      return;
    }

    try {
      setError(null);
      setResult(null);

      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          baseVersionId: versionId,
          datasetId,
          optimizerType: config.optimizerType,
          metricType: config.metricType,
          budget: config.budget,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start optimization');
      }

      const run = await response.json();
      setCurrentRun(run);
      setIsPolling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
    }
  };

  // Poll for status updates
  const pollStatus = useCallback(async () => {
    if (!currentRun?.id) return;

    try {
      const response = await fetch(`/api/optimize/${currentRun.id}`);
      if (!response.ok) throw new Error('Failed to get status');

      const status = await response.json();
      setCurrentRun(status);

      // Check if completed
      if (status.status === 'succeeded' || status.status === 'failed') {
        setIsPolling(false);

        if (status.status === 'succeeded') {
          // Load result
          const resultResponse = await fetch(`/api/optimize/${currentRun.id}/result`);
          if (resultResponse.ok) {
            const resultData = await resultResponse.json();
            setResult(resultData);
            onOptimizationComplete?.(resultData);
          }
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, [currentRun?.id, onOptimizationComplete]);

  // Polling effect
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [isPolling, pollStatus]);

  // Apply result (create new version)
  const handleApplyResult = async () => {
    if (!currentRun?.id) return;

    try {
      const response = await fetch(`/api/optimize/${currentRun.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activate: true }),
      });

      if (!response.ok) throw new Error('Failed to apply optimization');

      const data = await response.json();
      onApplyResult?.(data.newVersionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply');
    }
  };

  // Reset state
  const reset = () => {
    setCurrentRun(null);
    setResult(null);
    setError(null);
    setIsPolling(false);
  };

  // Check if can start
  const canStart = templateId && versionId && datasetId && !disabled && !isPolling;

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">DSPy Optimization</h3>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-4 bg-gray-800 rounded border border-gray-700 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Optimizer</label>
            <select
              value={config.optimizerType}
              onChange={(e) =>
                setConfig({ ...config, optimizerType: e.target.value as 'bootstrap_fewshot' | 'copro' })
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            >
              <option value="bootstrap_fewshot">Quick (BootstrapFewShot)</option>
              <option value="copro">Instruction (COPRO)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {config.optimizerType === 'bootstrap_fewshot'
                ? 'Generates few-shot examples automatically'
                : 'Optimizes prompt instructions using LLM feedback'}
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Metric</label>
            <select
              value={config.metricType}
              onChange={(e) =>
                setConfig({ ...config, metricType: e.target.value as 'exact_match' | 'contains' | 'json_valid' })
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            >
              <option value="exact_match">Exact Match</option>
              <option value="contains">Contains</option>
              <option value="json_valid">Valid JSON</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Calls</label>
              <input
                type="number"
                value={config.budget.maxCalls}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    budget: { ...config.budget, maxCalls: parseInt(e.target.value) || 50 },
                  })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                min={10}
                max={200}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Tokens</label>
              <input
                type="number"
                value={config.budget.maxTokens}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    budget: { ...config.budget, maxTokens: parseInt(e.target.value) || 50000 },
                  })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                min={10000}
                max={200000}
                step={10000}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max USD</label>
              <input
                type="number"
                value={config.budget.maxUSD}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    budget: { ...config.budget, maxUSD: parseFloat(e.target.value) || 5 },
                  })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                min={1}
                max={50}
                step={1}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Action / Status */}
      {!currentRun ? (
        <button
          onClick={startOptimization}
          disabled={!canStart}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded font-medium transition-colors ${
            canStart
              ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:from-yellow-400 hover:to-orange-400'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Zap className="w-5 h-5" />
          Start Optimization
        </button>
      ) : (
        <div className="space-y-4">
          {/* Status Display */}
          <div className="p-4 bg-gray-800 rounded border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {currentRun.status === 'running' && (
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                )}
                {currentRun.status === 'succeeded' && (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                )}
                {currentRun.status === 'failed' && (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                {currentRun.status === 'queued' && (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-pulse" />
                )}
                <span className="text-white font-medium capitalize">{currentRun.status}</span>
              </div>
              {currentRun.status !== 'running' && currentRun.status !== 'queued' && (
                <button
                  onClick={reset}
                  className="p-1 text-gray-400 hover:text-white"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Progress Bar */}
            {(currentRun.status === 'running' || currentRun.status === 'queued') && (
              <div className="space-y-2">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${currentRun.progress}%` }}
                  />
                </div>
                <div className="text-sm text-gray-400">
                  {currentRun.stage || 'Initializing...'}
                </div>
              </div>
            )}

            {/* Error Message */}
            {currentRun.status === 'failed' && currentRun.errorMessage && (
              <div className="text-sm text-red-400 mt-2">{currentRun.errorMessage}</div>
            )}
          </div>

          {/* Result Display */}
          {result && (
            <div className="p-4 bg-gray-800 rounded border border-green-700 space-y-4">
              <h4 className="text-white font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                Optimization Complete
              </h4>

              {/* Score Comparison */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-700 rounded">
                  <div className="text-2xl font-bold text-gray-300">
                    {(result.baselineScore * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">Baseline</div>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowRight className="w-6 h-6 text-green-400" />
                </div>
                <div className="text-center p-3 bg-green-900/30 rounded border border-green-700">
                  <div className="text-2xl font-bold text-green-400">
                    {(result.optimizedScore * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">Optimized</div>
                </div>
              </div>

              {/* Delta */}
              <div className="text-center">
                <span
                  className={`text-lg font-bold ${
                    result.scoreDelta > 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {result.scoreDelta > 0 ? '+' : ''}
                  {(result.scoreDelta * 100).toFixed(1)}%
                </span>
                <span className="text-gray-400 text-sm ml-2">improvement</span>
              </div>

              {/* Cost */}
              <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  ${result.cost.usdEstimate.toFixed(2)}
                </span>
                <span>{result.cost.calls} calls</span>
                <span>{(result.cost.tokens / 1000).toFixed(1)}k tokens</span>
              </div>

              {/* Optimized Prompt Preview */}
              {result.optimizedSnapshot.system && (
                <div className="text-xs">
                  <div className="text-gray-500 mb-1">Optimized System Prompt:</div>
                  <pre className="p-2 bg-gray-700 rounded text-gray-300 overflow-x-auto max-h-32 overflow-y-auto">
                    {result.optimizedSnapshot.system.slice(0, 500)}
                    {result.optimizedSnapshot.system.length > 500 && '...'}
                  </pre>
                </div>
              )}

              {/* Demos */}
              {result.optimizedSnapshot.demos && result.optimizedSnapshot.demos.length > 0 && (
                <div className="text-xs">
                  <div className="text-gray-500 mb-1">
                    Generated Demos ({result.optimizedSnapshot.demos.length}):
                  </div>
                  <div className="space-y-1">
                    {result.optimizedSnapshot.demos.slice(0, 2).map((demo, idx) => (
                      <div key={idx} className="p-2 bg-gray-700 rounded">
                        <span className="text-gray-400">In:</span>{' '}
                        <span className="text-gray-300">{demo.input.slice(0, 50)}...</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply Button */}
              <button
                onClick={handleApplyResult}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4" />
                Apply & Create New Version
              </button>
            </div>
          )}
        </div>
      )}

      {/* Requirements Info */}
      {!currentRun && (
        <div className="mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className={templateId ? 'text-green-400' : 'text-gray-500'}>
              {templateId ? 'Template selected' : 'Select a template'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={versionId ? 'text-green-400' : 'text-gray-500'}>
              {versionId ? 'Version selected' : 'Select a version'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={datasetId ? 'text-green-400' : 'text-gray-500'}>
              {datasetId ? 'Dataset selected' : 'Select a dataset'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default OptimizePanel;
