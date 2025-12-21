'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Play,
  Loader2,
  Award,
  Equal,
  AlertTriangle,
} from 'lucide-react';

interface CompareRun {
  id: string;
  status: string;
  progress: number;
  stage?: string;
  mode: string;
  metricType: string;
  scoreA?: number;
  scoreB?: number;
  winsA?: number;
  winsB?: number;
  ties?: number;
  cost?: { calls: number; tokens: number; usdEstimate: number };
  errorMessage?: string;
}

interface Version {
  id: string;
  versionNumber: number;
  isActive: boolean;
}

interface ComparePanelProps {
  templateId: string;
  datasetId: string;
  versions: Version[];
  onCompareComplete?: (run: CompareRun) => void;
}

export function ComparePanel({
  templateId,
  datasetId,
  versions,
  onCompareComplete,
}: ComparePanelProps) {
  const [versionAId, setVersionAId] = useState<string>('');
  const [versionBId, setVersionBId] = useState<string>('');
  const [maxSamples, setMaxSamples] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<CompareRun | null>(null);
  const [polling, setPolling] = useState(false);

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
          onCompareComplete?.(data);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [polling, currentRun, onCompareComplete]);

  const startComparison = async () => {
    if (!versionAId || !versionBId || !datasetId) {
      setError('Please select both versions and a dataset');
      return;
    }

    if (versionAId === versionBId) {
      setError('Please select different versions to compare');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCurrentRun(null);

      const body: Record<string, unknown> = {
        versionAId,
        versionBId,
        datasetId,
        metricType: 'pairwise_judge',
      };

      if (maxSamples) {
        body.maxSamples = maxSamples;
      }

      const response = await fetch('/api/advanced-evals/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start comparison');
      }

      const run = await response.json();
      setCurrentRun(run);
      setPolling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start comparison');
    } finally {
      setLoading(false);
    }
  };

  const canRun = versionAId && versionBId && datasetId && versionAId !== versionBId && !loading && !polling;

  // Calculate winner
  const getWinner = () => {
    if (!currentRun || currentRun.status !== 'succeeded') return null;

    const { winsA = 0, winsB = 0, ties = 0 } = currentRun;
    const total = winsA + winsB + ties;

    if (total === 0) return null;
    if (winsA > winsB) return 'A';
    if (winsB > winsA) return 'B';
    return 'tie';
  };

  const winner = getWinner();

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <GitBranch className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Compare Versions (A/B)</h3>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Version Selection */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Version A</label>
          <select
            value={versionAId}
            onChange={(e) => setVersionAId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            disabled={loading || polling}
          >
            <option value="">Select version</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.versionNumber} {v.isActive ? '(active)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Version B</label>
          <select
            value={versionBId}
            onChange={(e) => setVersionBId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            disabled={loading || polling}
          >
            <option value="">Select version</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id} disabled={v.id === versionAId}>
                v{v.versionNumber} {v.isActive ? '(active)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Max Samples */}
      <div className="mb-4">
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

      {/* Run Button */}
      <button
        onClick={startComparison}
        disabled={!canRun}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded font-medium transition-colors ${
          canRun
            ? 'bg-blue-600 text-white hover:bg-blue-700'
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
            <GitBranch className="w-5 h-5" />
            Compare Versions
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
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${currentRun.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {currentRun && currentRun.status === 'succeeded' && (
        <div className="mt-4 p-4 bg-gray-800 rounded border border-gray-700 space-y-4">
          {/* Winner Badge */}
          {winner && (
            <div className="text-center">
              {winner === 'tie' ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-full">
                  <Equal className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-300 font-medium">It's a Tie!</span>
                </div>
              ) : (
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                  winner === 'A' ? 'bg-green-900/50 border border-green-700' : 'bg-blue-900/50 border border-blue-700'
                }`}>
                  <Award className={`w-5 h-5 ${winner === 'A' ? 'text-green-400' : 'text-blue-400'}`} />
                  <span className={`font-medium ${winner === 'A' ? 'text-green-400' : 'text-blue-400'}`}>
                    Version {winner} Wins!
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className={`p-3 rounded border ${
              winner === 'A' ? 'bg-green-900/30 border-green-700' : 'bg-gray-700 border-gray-600'
            }`}>
              <div className={`text-2xl font-bold ${winner === 'A' ? 'text-green-400' : 'text-white'}`}>
                {currentRun.winsA || 0}
              </div>
              <div className="text-xs text-gray-400">Version A Wins</div>
              {currentRun.scoreA !== undefined && (
                <div className="text-xs text-gray-500 mt-1">
                  Avg Score: {(currentRun.scoreA * 100).toFixed(1)}%
                </div>
              )}
            </div>
            <div className="p-3 bg-gray-700 rounded border border-gray-600">
              <div className="text-2xl font-bold text-gray-300">{currentRun.ties || 0}</div>
              <div className="text-xs text-gray-400">Ties</div>
            </div>
            <div className={`p-3 rounded border ${
              winner === 'B' ? 'bg-blue-900/30 border-blue-700' : 'bg-gray-700 border-gray-600'
            }`}>
              <div className={`text-2xl font-bold ${winner === 'B' ? 'text-blue-400' : 'text-white'}`}>
                {currentRun.winsB || 0}
              </div>
              <div className="text-xs text-gray-400">Version B Wins</div>
              {currentRun.scoreB !== undefined && (
                <div className="text-xs text-gray-500 mt-1">
                  Avg Score: {(currentRun.scoreB * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </div>

          {/* Cost */}
          {currentRun.cost && (
            <div className="text-sm text-gray-400 text-center">
              Cost: {currentRun.cost.tokens.toLocaleString()} tokens (~${currentRun.cost.usdEstimate.toFixed(3)})
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ComparePanel;
