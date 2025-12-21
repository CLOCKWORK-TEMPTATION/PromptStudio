'use client';

import React, { useState, useEffect } from 'react';
import {
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart,
  GitBranch,
  RefreshCw,
} from 'lucide-react';

interface EvaluationRun {
  id: string;
  status: string;
  progress: number;
  stage?: string;
  mode: string;
  metricType: string;
  score?: number;
  scoreA?: number;
  scoreB?: number;
  winsA?: number;
  winsB?: number;
  ties?: number;
  cost?: { calls: number; tokens: number; usdEstimate: number };
  topFailures?: Array<{ exampleId: string; reason: string; output: string }>;
  errorMessage?: string;
  createdAt: string;
  finishedAt?: string;
}

interface Rubric {
  id: string;
  name: string;
  description?: string;
}

interface EvaluatePanelProps {
  versionId: string;
  datasetId: string;
  onRunComplete?: (run: EvaluationRun) => void;
}

export function EvaluatePanel({
  versionId,
  datasetId,
  onRunComplete,
}: EvaluatePanelProps) {
  const [metricType, setMetricType] = useState<string>('exact_match');
  const [rubricId, setRubricId] = useState<string>('');
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [maxSamples, setMaxSamples] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<EvaluationRun | null>(null);
  const [polling, setPolling] = useState(false);

  // Load rubrics
  useEffect(() => {
    loadRubrics();
  }, []);

  // Poll for status updates
  useEffect(() => {
    if (!polling || !currentRun) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/advanced-evals/run/${currentRun.id}`);
        const data = await response.json();
        setCurrentRun(data);

        if (data.status === 'succeeded' || data.status === 'failed' || data.status === 'canceled') {
          setPolling(false);
          onRunComplete?.(data);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [polling, currentRun, onRunComplete]);

  const loadRubrics = async () => {
    try {
      const response = await fetch('/api/rubrics?limit=100');
      const data = await response.json();
      setRubrics(data.rubrics || []);
    } catch (err) {
      console.error('Failed to load rubrics:', err);
    }
  };

  const startEvaluation = async () => {
    if (!versionId || !datasetId) {
      setError('Please select a version and dataset');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCurrentRun(null);

      const body: Record<string, unknown> = {
        versionId,
        datasetId,
        metricType,
      };

      if ((metricType === 'judge_rubric' || metricType === 'pairwise_judge') && rubricId) {
        body.judgeRubricId = rubricId;
      }

      if (maxSamples) {
        body.maxSamples = maxSamples;
      }

      const response = await fetch('/api/advanced-evals/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start evaluation');
      }

      const run = await response.json();
      setCurrentRun(run);
      setPolling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start evaluation');
    } finally {
      setLoading(false);
    }
  };

  const showJudgeOptions = metricType === 'judge_rubric' || metricType === 'pairwise_judge';
  const canRun = versionId && datasetId && !loading && !polling;

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Evaluate</h3>
        </div>
        <button
          onClick={loadRubrics}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          title="Refresh rubrics"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
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
        <div>
          <label className="block text-sm text-gray-400 mb-1">Metric Type</label>
          <select
            value={metricType}
            onChange={(e) => setMetricType(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            disabled={loading || polling}
          >
            <option value="exact_match">Exact Match</option>
            <option value="contains">Contains</option>
            <option value="json_valid">Valid JSON</option>
            <option value="judge_rubric">LLM Judge (Rubric)</option>
            <option value="pairwise_judge">Pairwise Judge</option>
          </select>
        </div>

        {showJudgeOptions && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">Judge Rubric</label>
            <select
              value={rubricId}
              onChange={(e) => setRubricId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              disabled={loading || polling}
            >
              <option value="">Select a rubric (optional)</option>
              {rubrics.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-400 mb-1">Max Samples</label>
          <input
            type="number"
            placeholder="All examples"
            value={maxSamples || ''}
            onChange={(e) => setMaxSamples(e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500"
            min={1}
            disabled={loading || polling}
          />
        </div>
      </div>

      {/* Run Button */}
      <button
        onClick={startEvaluation}
        disabled={!canRun}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded font-medium transition-colors ${
          canRun
            ? 'bg-purple-600 text-white hover:bg-purple-700'
            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
        }`}
      >
        {loading || polling ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {currentRun?.stage || 'Starting...'}
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            Run Evaluation
          </>
        )}
      </button>

      {/* Progress */}
      {currentRun && (currentRun.status === 'running' || currentRun.status === 'queued') && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>{currentRun.stage}</span>
            <span>{currentRun.progress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${currentRun.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {currentRun && currentRun.status === 'succeeded' && (
        <div className="mt-4 p-4 bg-gray-800 rounded border border-gray-700 space-y-4">
          {/* Score */}
          {currentRun.mode === 'baseline' && currentRun.score !== undefined && (
            <div className="text-center">
              <div className="text-4xl font-bold text-white">
                {(currentRun.score * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-400">Score</div>
            </div>
          )}

          {/* Comparison Results */}
          {currentRun.mode === 'compare' && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 bg-green-900/30 rounded border border-green-700">
                <div className="text-lg font-semibold text-green-400">{currentRun.winsA || 0}</div>
                <div className="text-xs text-gray-400">Version A Wins</div>
              </div>
              <div className="p-2 bg-gray-700 rounded">
                <div className="text-lg font-semibold text-gray-300">{currentRun.ties || 0}</div>
                <div className="text-xs text-gray-400">Ties</div>
              </div>
              <div className="p-2 bg-blue-900/30 rounded border border-blue-700">
                <div className="text-lg font-semibold text-blue-400">{currentRun.winsB || 0}</div>
                <div className="text-xs text-gray-400">Version B Wins</div>
              </div>
            </div>
          )}

          {/* Cost */}
          {currentRun.cost && (
            <div className="text-sm text-gray-400">
              Cost: {currentRun.cost.tokens.toLocaleString()} tokens (~${currentRun.cost.usdEstimate.toFixed(3)})
            </div>
          )}

          {/* Top Failures */}
          {currentRun.topFailures && currentRun.topFailures.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Top Failures</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {currentRun.topFailures.slice(0, 3).map((failure, idx) => (
                  <div key={idx} className="p-2 bg-gray-700 rounded text-xs">
                    <div className="text-red-400">{failure.reason}</div>
                    {failure.output && (
                      <div className="text-gray-400 truncate mt-1">Output: {failure.output}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {currentRun && currentRun.status === 'failed' && (
        <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <XCircle className="w-4 h-4" />
            Evaluation Failed
          </div>
          {currentRun.errorMessage && (
            <div className="mt-1 text-xs">{currentRun.errorMessage}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default EvaluatePanel;
