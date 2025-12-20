import { useEffect, useState } from 'react';
import {
  History,
  Loader2,
  ChevronDown,
  ChevronUp,
  GitCompare,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { formatRelativeTime } from '../../lib/utils';
import { refinementApi } from './refinementApi';
import { PromptVersion, RefinementAnalytics } from './types';
import VersionDiffView from './VersionDiffView';
import ScoreChart from './ScoreChart';

interface RefinementHistoryProps {
  promptId: string;
  onVersionApply?: (versionId: string) => void;
}

export default function RefinementHistory({ promptId, onVersionApply }: RefinementHistoryProps) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [analytics, setAnalytics] = useState<RefinementAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    fetchData();
  }, [promptId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [versionsData, analyticsData] = await Promise.all([
        refinementApi.getVersions(promptId),
        refinementApi.getAnalytics(promptId).catch(() => null),
      ]);
      setVersions(versionsData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Failed to fetch refinement history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVersionSelect = (version: number) => {
    if (!compareMode) return;

    setSelectedVersions((prev) => {
      if (prev.includes(version)) {
        return prev.filter((v) => v !== version);
      }
      if (prev.length >= 2) {
        return [prev[1], version];
      }
      return [...prev, version];
    });
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      setShowDiff(true);
    }
  };

  const handleApplyVersion = async (versionId: string) => {
    try {
      await refinementApi.applyVersion(promptId, versionId);
      onVersionApply?.(versionId);
      await fetchData();
    } catch (error) {
      console.error('Failed to apply version:', error);
    }
  };

  const handleRollback = async (version: number) => {
    try {
      await refinementApi.rollbackToVersion(promptId, version);
      await fetchData();
    } catch (error) {
      console.error('Failed to rollback:', error);
    }
  };

  const getScoreColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'text-gray-400';
    if (score >= 0.8) return 'text-green-500';
    if (score >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBadge = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'N/A';
    return `${(score * 100).toFixed(0)}%`;
  };

  if (showDiff && selectedVersions.length === 2) {
    return (
      <VersionDiffView
        promptId={promptId}
        version1={Math.min(...selectedVersions)}
        version2={Math.max(...selectedVersions)}
        onClose={() => {
          setShowDiff(false);
          setSelectedVersions([]);
          setCompareMode(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <History size={18} />
            Refinement History
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCompareMode(!compareMode);
                setSelectedVersions([]);
              }}
              className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${
                compareMode
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              <GitCompare size={14} />
              Compare
            </button>
            {compareMode && selectedVersions.length === 2 && (
              <button
                onClick={handleCompare}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded"
              >
                View Diff
              </button>
            )}
          </div>
        </div>

        {/* Analytics summary */}
        {analytics && (
          <div className="mt-4 grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">
                {analytics.totalVersions}
              </div>
              <div className="text-xs text-gray-500">Versions</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getScoreColor(analytics.initialScore)}`}>
                {getScoreBadge(analytics.initialScore)}
              </div>
              <div className="text-xs text-gray-500">Initial Score</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getScoreColor(analytics.currentScore)}`}>
                {getScoreBadge(analytics.currentScore)}
              </div>
              <div className="text-xs text-gray-500">Current Score</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${analytics.totalImprovement >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {analytics.totalImprovement >= 0 ? '+' : ''}
                {(analytics.totalImprovement * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">Improvement</div>
            </div>
          </div>
        )}

        {/* Score chart */}
        {analytics && analytics.scoreHistory.length > 1 && (
          <div className="mt-4">
            <ScoreChart data={analytics.scoreHistory} />
          </div>
        )}
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No version history yet</p>
            <p className="text-xs mt-1">Run refinement to create versions</p>
          </div>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className={`p-4 ${
                  compareMode && selectedVersions.includes(version.version)
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : ''
                }`}
                onClick={() => handleVersionSelect(version.version)}
              >
                <div className="flex items-start gap-3">
                  {compareMode && (
                    <input
                      type="checkbox"
                      checked={selectedVersions.includes(version.version)}
                      onChange={() => handleVersionSelect(version.version)}
                      className="mt-1"
                    />
                  )}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 ${
                      index === 0 ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  >
                    v{version.version}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {index === 0 && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded dark:bg-green-900 dark:text-green-300">
                            Current
                          </span>
                        )}
                        <span className={`font-medium ${getScoreColor(version.qualityScore)}`}>
                          {getScoreBadge(version.qualityScore)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={12} />
                        {formatRelativeTime(version.createdAt)}
                      </span>
                    </div>
                    {version.refinementReason && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {version.refinementReason}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(expandedId === version.id ? null : version.id);
                        }}
                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                      >
                        {expandedId === version.id ? (
                          <>
                            <ChevronUp size={14} /> Hide content
                          </>
                        ) : (
                          <>
                            <ChevronDown size={14} /> Show content
                          </>
                        )}
                      </button>
                      {index !== 0 && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApplyVersion(version.id);
                            }}
                            className="text-xs text-green-500 hover:text-green-700 flex items-center gap-1"
                          >
                            <CheckCircle size={14} /> Apply
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRollback(version.version);
                            }}
                            className="text-xs text-orange-500 hover:text-orange-700 flex items-center gap-1"
                          >
                            <RotateCcw size={14} /> Rollback
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {expandedId === version.id && (
                  <div className="mt-3 ml-11 space-y-2">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Prompt Content:</div>
                      <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-3 rounded border dark:border-gray-700 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {version.content}
                      </pre>
                    </div>
                    {version.systemPrompt && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">System Prompt:</div>
                        <pre className="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800 overflow-x-auto max-h-24 overflow-y-auto whitespace-pre-wrap">
                          {version.systemPrompt}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
