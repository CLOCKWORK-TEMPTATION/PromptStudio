'use client';

import React, { useState } from 'react';
import {
  BarChart,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

interface EvaluationResult {
  runId: string;
  aggregateScore: number;
  totalExamples: number;
  passedExamples: number;
  failedExamples: number;
  failureCases: Array<{
    exampleId: string;
    input: Record<string, unknown>;
    expectedOutput?: string;
    actualOutput: string;
    reason: string;
  }>;
}

interface BaselineEvalPanelProps {
  templateVersionId: string;
  datasetId: string;
  disabled?: boolean;
  onEvaluationComplete?: (result: EvaluationResult) => void;
}

export function BaselineEvalPanel({
  templateVersionId,
  datasetId,
  disabled = false,
  onEvaluationComplete,
}: BaselineEvalPanelProps) {
  const [metricType, setMetricType] = useState<'exact_match' | 'contains' | 'json_valid'>('exact_match');
  const [maxSamples, setMaxSamples] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  const runEvaluation = async () => {
    if (!templateVersionId || !datasetId) {
      setError('Please select a template version and dataset');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await fetch('/api/evals/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateVersionId,
          datasetId,
          metricType,
          maxSamples,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Evaluation failed');
      }

      const evalResult = await response.json();
      setResult(evalResult);
      onEvaluationComplete?.(evalResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run evaluation');
    } finally {
      setLoading(false);
    }
  };

  const canRun = templateVersionId && datasetId && !disabled && !loading;

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Baseline Evaluation</h3>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Configuration */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-1">Metric</label>
            <select
              value={metricType}
              onChange={(e) => setMetricType(e.target.value as 'exact_match' | 'contains' | 'json_valid')}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              disabled={loading}
            >
              <option value="exact_match">Exact Match</option>
              <option value="contains">Contains</option>
              <option value="json_valid">Valid JSON</option>
            </select>
          </div>
          <div className="w-32">
            <label className="block text-sm text-gray-400 mb-1">Max Samples</label>
            <input
              type="number"
              placeholder="All"
              value={maxSamples || ''}
              onChange={(e) => setMaxSamples(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500"
              min={1}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Run Button */}
      <button
        onClick={runEvaluation}
        disabled={!canRun}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded font-medium transition-colors ${
          canRun
            ? 'bg-cyan-600 text-white hover:bg-cyan-700'
            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Running Evaluation...
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            Run Baseline Evaluation
          </>
        )}
      </button>

      {/* Results */}
      {result && (
        <div className="mt-4 p-4 bg-gray-800 rounded border border-gray-700 space-y-4">
          {/* Score */}
          <div className="text-center">
            <div className="text-4xl font-bold text-white">
              {(result.aggregateScore * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-400">Aggregate Score</div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 bg-gray-700 rounded">
              <div className="text-lg font-semibold text-white">{result.totalExamples}</div>
              <div className="text-xs text-gray-400">Total</div>
            </div>
            <div className="p-2 bg-green-900/30 rounded border border-green-700">
              <div className="text-lg font-semibold text-green-400 flex items-center justify-center gap-1">
                <CheckCircle className="w-4 h-4" />
                {result.passedExamples}
              </div>
              <div className="text-xs text-gray-400">Passed</div>
            </div>
            <div className="p-2 bg-red-900/30 rounded border border-red-700">
              <div className="text-lg font-semibold text-red-400 flex items-center justify-center gap-1">
                <XCircle className="w-4 h-4" />
                {result.failedExamples}
              </div>
              <div className="text-xs text-gray-400">Failed</div>
            </div>
          </div>

          {/* Failure Cases */}
          {result.failureCases.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                Top Failure Cases ({result.failureCases.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.failureCases.slice(0, 5).map((failure, idx) => (
                  <div key={idx} className="p-2 bg-gray-700 rounded text-xs">
                    <div className="text-gray-400 truncate">
                      Input: {JSON.stringify(failure.input).slice(0, 80)}...
                    </div>
                    {failure.expectedOutput && (
                      <div className="text-green-400 truncate mt-1">
                        Expected: {failure.expectedOutput.slice(0, 50)}...
                      </div>
                    )}
                    <div className="text-red-400 truncate mt-1">
                      Got: {failure.actualOutput.slice(0, 50)}...
                    </div>
                    <div className="text-yellow-400 mt-1">{failure.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      {!result && (
        <div className="mt-4 text-xs text-gray-500">
          Run baseline evaluation to see how your current prompt performs before optimization.
        </div>
      )}
    </div>
  );
}

export default BaselineEvalPanel;
