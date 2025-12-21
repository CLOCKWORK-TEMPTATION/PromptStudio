'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  DollarSign,
  TrendingUp,
  Activity,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface Run {
  id: string;
  type: 'optimization' | 'evaluation';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  mode?: string; // baseline | compare
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  cost?: {
    calls?: number;
    tokens?: number;
    usd?: number;
    totalUSD?: number;
  };
  score?: number;
  finalScore?: number;
  scoreA?: number;
  scoreB?: number;
  errorMessage?: string;
  templateName?: string;
  datasetName?: string;
}

interface RunStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
  avgDuration?: number;
  totalCost?: number;
}

interface RunHistoryPanelProps {
  workspaceId?: string;
  onRunSelect?: (run: Run) => void;
}

// ============================================================
// Component
// ============================================================

export function RunHistoryPanel({ workspaceId, onRunSelect }: RunHistoryPanelProps) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'optimization' | 'evaluation'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed' | 'running'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load runs
  const loadRuns = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (workspaceId) params.append('workspaceId', workspaceId);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('limit', '50');

      const response = await fetch(`/api/runs?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load runs');

      const data = await response.json();
      setRuns(data.runs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      const params = new URLSearchParams();
      if (workspaceId) params.append('workspaceId', workspaceId);

      const response = await fetch(`/api/runs/stats/summary?${params.toString()}`);
      if (!response.ok) return;

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    loadRuns();
    loadStats();
  }, [workspaceId, typeFilter, statusFilter]);

  // Auto-refresh for running jobs
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === 'running' || r.status === 'queued');
    if (!hasRunning) return;

    const interval = setInterval(loadRuns, 5000);
    return () => clearInterval(interval);
  }, [runs]);

  // Filter runs by search query
  const filteredRuns = runs.filter(run => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      run.id.toLowerCase().includes(query) ||
      run.templateName?.toLowerCase().includes(query) ||
      run.datasetName?.toLowerCase().includes(query)
    );
  });

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  // Format duration
  const formatDuration = (start?: string, end?: string): string => {
    if (!start || !end) return '-';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(duration / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Format cost
  const formatCost = (cost?: Run['cost']): string => {
    if (!cost) return '-';
    const usd = cost.usd || cost.totalUSD || 0;
    return usd > 0 ? `$${usd.toFixed(4)}` : '-';
  };

  // Format score
  const formatScore = (run: Run): string => {
    if (run.type === 'evaluation' && run.mode === 'compare') {
      if (run.scoreA !== undefined && run.scoreB !== undefined) {
        return `A:${(run.scoreA * 100).toFixed(0)}% / B:${(run.scoreB * 100).toFixed(0)}%`;
      }
    }
    const score = run.score ?? run.finalScore;
    if (score === undefined) return '-';
    return `${(score * 100).toFixed(1)}%`;
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Run History</h3>
        </div>
        <button
          onClick={() => { loadRuns(); loadStats(); }}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-800 rounded p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Activity className="w-3 h-3" />
              Total
            </div>
            <div className="text-xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-gray-800 rounded p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <CheckCircle className="w-3 h-3" />
              Completed
            </div>
            <div className="text-xl font-bold text-green-400">{stats.completed}</div>
          </div>
          <div className="bg-gray-800 rounded p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <XCircle className="w-3 h-3" />
              Failed
            </div>
            <div className="text-xl font-bold text-red-400">{stats.failed}</div>
          </div>
          <div className="bg-gray-800 rounded p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <DollarSign className="w-3 h-3" />
              Total Cost
            </div>
            <div className="text-xl font-bold text-yellow-400">
              ${(stats.totalCost || 0).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search runs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
        >
          <option value="all">All Types</option>
          <option value="optimization">Optimization</option>
          <option value="evaluation">Evaluation</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Run List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {loading && runs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading runs...
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No runs found
          </div>
        ) : (
          filteredRuns.map((run) => (
            <div
              key={run.id}
              className="border border-gray-700 rounded overflow-hidden"
            >
              {/* Run Row */}
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800"
                onClick={() => {
                  setExpandedRun(expandedRun === run.id ? null : run.id);
                  onRunSelect?.(run);
                }}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(run.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        run.type === 'optimization'
                          ? 'bg-purple-900/50 text-purple-300'
                          : 'bg-blue-900/50 text-blue-300'
                      }`}>
                        {run.type}
                        {run.mode && ` (${run.mode})`}
                      </span>
                      <span className="text-white text-sm font-mono">
                        {run.id.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(run.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {run.status === 'completed' && (
                    <div className="flex items-center gap-1 text-green-400 text-sm">
                      <TrendingUp className="w-4 h-4" />
                      {formatScore(run)}
                    </div>
                  )}
                  <div className="text-gray-400 text-sm">
                    {formatDuration(run.startedAt, run.finishedAt)}
                  </div>
                  <div className="text-yellow-400 text-sm">
                    {formatCost(run.cost)}
                  </div>
                  {expandedRun === run.id ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedRun === run.id && (
                <div className="border-t border-gray-700 p-3 bg-gray-800/50">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">ID:</span>
                      <span className="text-white ml-2 font-mono text-xs">{run.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Status:</span>
                      <span className={`ml-2 ${
                        run.status === 'completed' ? 'text-green-400' :
                        run.status === 'failed' ? 'text-red-400' :
                        run.status === 'running' ? 'text-blue-400' :
                        'text-yellow-400'
                      }`}>
                        {run.status}
                      </span>
                    </div>
                    {run.templateName && (
                      <div>
                        <span className="text-gray-400">Template:</span>
                        <span className="text-white ml-2">{run.templateName}</span>
                      </div>
                    )}
                    {run.datasetName && (
                      <div>
                        <span className="text-gray-400">Dataset:</span>
                        <span className="text-white ml-2">{run.datasetName}</span>
                      </div>
                    )}
                    {run.cost && (
                      <>
                        <div>
                          <span className="text-gray-400">API Calls:</span>
                          <span className="text-white ml-2">{run.cost.calls || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Tokens:</span>
                          <span className="text-white ml-2">
                            {run.cost.tokens ? run.cost.tokens.toLocaleString() : '-'}
                          </span>
                        </div>
                      </>
                    )}
                    {run.errorMessage && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Error:</span>
                        <span className="text-red-400 ml-2">{run.errorMessage}</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons for completed optimization runs */}
                  {run.type === 'optimization' && run.status === 'completed' && (
                    <div className="mt-3 pt-3 border-t border-gray-700 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Navigate to compare view
                          window.location.href = `/optimize?runId=${run.id}&view=compare`;
                        }}
                        className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                      >
                        View Results
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default RunHistoryPanel;
