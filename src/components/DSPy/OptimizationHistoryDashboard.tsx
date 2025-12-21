'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  TrendingUp,
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  BarChart,
  PieChart,
  ChevronDown,
  ChevronUp,
  RotateCw,
  AlertCircle,
  Target,
  Zap,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface RunMetrics {
  successRate: number;
  failureRate: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  canceledRuns: number;
  runningRuns: number;
  queuedRuns: number;
}

interface DurationMetrics {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
}

interface CostMetrics {
  totalUSD: number;
  avgPerRun: number;
  totalCalls: number;
  avgCallsPerRun: number;
  totalTokens: number;
  avgTokensPerRun: number;
}

interface OptimizerDistribution {
  optimizerType: string;
  count: number;
  percentage: number;
  avgScore: number;
  avgDuration: number;
  successRate: number;
}

interface MetricDistribution {
  metricType: string;
  count: number;
  percentage: number;
  avgScore: number;
}

interface RecentActivity {
  runId: string;
  type: 'optimization' | 'evaluation';
  status: string;
  templateName?: string;
  datasetName?: string;
  score?: number;
  cost?: number;
  duration?: number;
  createdAt: string;
  finishedAt?: string;
}

interface TimeSeriesPoint {
  timestamp: string;
  successCount: number;
  failureCount: number;
  totalCost: number;
  avgDuration: number;
}

interface DashboardData {
  runs: RunMetrics;
  duration: DurationMetrics;
  cost: CostMetrics;
  optimizerDistribution: OptimizerDistribution[];
  metricDistribution: MetricDistribution[];
  recentActivity: RecentActivity[];
  timeSeriesData: TimeSeriesPoint[];
}

interface OptimizationHistoryDashboardProps {
  workspaceId?: string;
  onRunSelect?: (runId: string, type: 'optimization' | 'evaluation') => void;
  onRestart?: (runId: string) => Promise<void>;
}

// ============================================================
// Helper Functions
// ============================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'succeeded':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    case 'queued':
      return <Clock className="w-4 h-4 text-yellow-400" />;
    case 'canceled':
      return <AlertCircle className="w-4 h-4 text-gray-400" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'succeeded':
      return 'text-green-400';
    case 'failed':
      return 'text-red-400';
    case 'running':
      return 'text-blue-400';
    case 'queued':
      return 'text-yellow-400';
    case 'canceled':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
}

// ============================================================
// Component
// ============================================================

export function OptimizationHistoryDashboard({
  workspaceId,
  onRunSelect,
  onRestart,
}: OptimizationHistoryDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');

  // Load dashboard data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (workspaceId) {
        params.append('workspaceId', workspaceId);
        params.append('tenantId', workspaceId);
      }

      // Calculate date range
      if (dateRange !== 'all') {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);
        params.append('dateFrom', dateFrom.toISOString());
      }

      const response = await fetch(`/api/metrics/dashboard?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load dashboard data');

      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh if there are running jobs
  useEffect(() => {
    if (!data) return;
    const hasActive = data.runs.runningRuns > 0 || data.runs.queuedRuns > 0;
    if (!hasActive) return;

    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [data, loadData]);

  // Handle restart
  const handleRestart = async (runId: string) => {
    if (onRestart) {
      await onRestart(runId);
      loadData();
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 rounded-lg border border-gray-700">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-2" />
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
        <p className="font-medium">Error loading dashboard</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={loadData}
          className="mt-2 px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart className="w-6 h-6 text-purple-400" />
          <h2 className="text-xl font-bold text-white">Optimization History</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button
            onClick={loadData}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Success Rate */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
            <TrendingUp className="w-4 h-4" />
            Success Rate
          </div>
          <div className="text-2xl font-bold text-green-400">
            {data.runs.successRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.runs.successfulRuns} / {data.runs.successfulRuns + data.runs.failedRuns} runs
          </div>
        </div>

        {/* Total Runs */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
            <Activity className="w-4 h-4" />
            Total Runs
          </div>
          <div className="text-2xl font-bold text-white">{data.runs.totalRuns}</div>
          <div className="text-xs text-gray-500 mt-1">
            {data.runs.runningRuns + data.runs.queuedRuns} active
          </div>
        </div>

        {/* P95 Duration */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
            <Clock className="w-4 h-4" />
            P95 Duration
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {formatDuration(data.duration.p95)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            avg: {formatDuration(data.duration.avg)}
          </div>
        </div>

        {/* Total Cost */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
            <DollarSign className="w-4 h-4" />
            Total Cost
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {formatCost(data.cost.totalUSD)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            avg: {formatCost(data.cost.avgPerRun)}/run
          </div>
        </div>

        {/* Total Tokens */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
            <Zap className="w-4 h-4" />
            Tokens Used
          </div>
          <div className="text-2xl font-bold text-purple-400">
            {formatNumber(data.cost.totalTokens)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            avg: {formatNumber(data.cost.avgTokensPerRun)}/run
          </div>
        </div>

        {/* API Calls */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
            <Target className="w-4 h-4" />
            API Calls
          </div>
          <div className="text-2xl font-bold text-cyan-400">
            {formatNumber(data.cost.totalCalls)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            avg: {Math.round(data.cost.avgCallsPerRun)}/run
          </div>
        </div>
      </div>

      {/* Optimizer Distribution */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <button
          onClick={() => setExpandedSection(expandedSection === 'optimizer' ? null : 'optimizer')}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Optimizer Distribution</h3>
          </div>
          {expandedSection === 'optimizer' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'optimizer' && (
          <div className="p-4 border-t border-gray-700">
            {data.optimizerDistribution.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No optimization runs yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.optimizerDistribution.map((opt) => (
                  <div
                    key={opt.optimizerType}
                    className="bg-gray-900 rounded-lg p-4 border border-gray-600"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-white capitalize">
                        {opt.optimizerType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm text-gray-400">
                        {opt.count} runs ({opt.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                      <div
                        className="bg-purple-500 h-2 rounded-full"
                        style={{ width: `${opt.percentage}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400">Success:</span>
                        <span className="text-green-400 ml-1">{opt.successRate.toFixed(0)}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Avg Score:</span>
                        <span className="text-white ml-1">{(opt.avgScore * 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Avg Time:</span>
                        <span className="text-white ml-1">{formatDuration(opt.avgDuration)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Duration Percentiles */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <button
          onClick={() => setExpandedSection(expandedSection === 'duration' ? null : 'duration')}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Duration Percentiles</h3>
          </div>
          {expandedSection === 'duration' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'duration' && (
          <div className="p-4 border-t border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {[
                { label: 'Min', value: data.duration.min },
                { label: 'P50', value: data.duration.p50 },
                { label: 'P75', value: data.duration.p75 },
                { label: 'P90', value: data.duration.p90 },
                { label: 'P95', value: data.duration.p95, highlight: true },
                { label: 'P99', value: data.duration.p99 },
                { label: 'Max', value: data.duration.max },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`text-center p-3 rounded-lg ${
                    item.highlight ? 'bg-blue-900/50 border border-blue-600' : 'bg-gray-900'
                  }`}
                >
                  <div className="text-xs text-gray-400 mb-1">{item.label}</div>
                  <div className={`font-bold ${item.highlight ? 'text-blue-400' : 'text-white'}`}>
                    {formatDuration(item.value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
          </div>
        </div>

        <div className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
          {data.recentActivity.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No recent activity</p>
          ) : (
            data.recentActivity.map((activity) => (
              <div
                key={activity.runId}
                className="p-4 hover:bg-gray-750 cursor-pointer"
                onClick={() => onRunSelect?.(activity.runId, activity.type)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(activity.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            activity.type === 'optimization'
                              ? 'bg-purple-900/50 text-purple-300'
                              : 'bg-blue-900/50 text-blue-300'
                          }`}
                        >
                          {activity.type}
                        </span>
                        <span className="text-white text-sm font-mono">
                          {activity.runId.slice(0, 8)}...
                        </span>
                        {activity.templateName && (
                          <span className="text-gray-400 text-sm">
                            {activity.templateName}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(activity.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {activity.score !== undefined && (
                      <div className="text-sm">
                        <span className="text-gray-400">Score:</span>
                        <span className="text-green-400 ml-1">
                          {(activity.score * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {activity.cost !== undefined && (
                      <div className="text-sm text-yellow-400">
                        {formatCost(activity.cost)}
                      </div>
                    )}
                    {activity.duration !== undefined && (
                      <div className="text-sm text-gray-400">
                        {formatDuration(activity.duration)}
                      </div>
                    )}
                    {(activity.status === 'failed' || activity.status === 'canceled') && onRestart && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestart(activity.runId);
                        }}
                        className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                        title="Restart run"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Status Breakdown</h3>
        <div className="flex flex-wrap gap-4">
          {[
            { label: 'Succeeded', count: data.runs.successfulRuns, color: 'text-green-400', bg: 'bg-green-400' },
            { label: 'Failed', count: data.runs.failedRuns, color: 'text-red-400', bg: 'bg-red-400' },
            { label: 'Running', count: data.runs.runningRuns, color: 'text-blue-400', bg: 'bg-blue-400' },
            { label: 'Queued', count: data.runs.queuedRuns, color: 'text-yellow-400', bg: 'bg-yellow-400' },
            { label: 'Canceled', count: data.runs.canceledRuns, color: 'text-gray-400', bg: 'bg-gray-400' },
          ].map((status) => (
            <div key={status.label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${status.bg}`} />
              <span className="text-gray-300">{status.label}:</span>
              <span className={`font-bold ${status.color}`}>{status.count}</span>
            </div>
          ))}
        </div>

        {/* Progress bar visualization */}
        {data.runs.totalRuns > 0 && (
          <div className="mt-4 w-full h-4 bg-gray-700 rounded-full overflow-hidden flex">
            {data.runs.successfulRuns > 0 && (
              <div
                className="h-full bg-green-500"
                style={{ width: `${(data.runs.successfulRuns / data.runs.totalRuns) * 100}%` }}
                title={`Succeeded: ${data.runs.successfulRuns}`}
              />
            )}
            {data.runs.runningRuns > 0 && (
              <div
                className="h-full bg-blue-500"
                style={{ width: `${(data.runs.runningRuns / data.runs.totalRuns) * 100}%` }}
                title={`Running: ${data.runs.runningRuns}`}
              />
            )}
            {data.runs.queuedRuns > 0 && (
              <div
                className="h-full bg-yellow-500"
                style={{ width: `${(data.runs.queuedRuns / data.runs.totalRuns) * 100}%` }}
                title={`Queued: ${data.runs.queuedRuns}`}
              />
            )}
            {data.runs.failedRuns > 0 && (
              <div
                className="h-full bg-red-500"
                style={{ width: `${(data.runs.failedRuns / data.runs.totalRuns) * 100}%` }}
                title={`Failed: ${data.runs.failedRuns}`}
              />
            )}
            {data.runs.canceledRuns > 0 && (
              <div
                className="h-full bg-gray-500"
                style={{ width: `${(data.runs.canceledRuns / data.runs.totalRuns) * 100}%` }}
                title={`Canceled: ${data.runs.canceledRuns}`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default OptimizationHistoryDashboard;
