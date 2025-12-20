import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { refinementApi } from './refinementApi';
import { VersionDiff } from './types';
import { formatRelativeTime } from '../../lib/utils';

interface VersionDiffViewProps {
  promptId: string;
  version1: number;
  version2: number;
  onClose: () => void;
}

export default function VersionDiffView({
  promptId,
  version1,
  version2,
  onClose,
}: VersionDiffViewProps) {
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');

  useEffect(() => {
    fetchDiff();
  }, [promptId, version1, version2]);

  const fetchDiff = async () => {
    setIsLoading(true);
    try {
      const data = await refinementApi.getVersionDiff(promptId, version1, version2);
      setDiff(data);
    } catch (error) {
      console.error('Failed to fetch diff:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 0.8) return 'text-green-500';
    if (score >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getImprovementIcon = (improvement: number) => {
    if (improvement > 0) return <TrendingUp className="text-green-500" size={16} />;
    if (improvement < 0) return <TrendingDown className="text-red-500" size={16} />;
    return <Minus className="text-gray-400" size={16} />;
  };

  const highlightDifferences = (text1: string, text2: string) => {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);

    const result: Array<{
      line1: string;
      line2: string;
      status: 'same' | 'added' | 'removed' | 'modified';
    }> = [];

    for (let i = 0; i < maxLines; i++) {
      const l1 = lines1[i] || '';
      const l2 = lines2[i] || '';

      if (l1 === l2) {
        result.push({ line1: l1, line2: l2, status: 'same' });
      } else if (!l1 && l2) {
        result.push({ line1: '', line2: l2, status: 'added' });
      } else if (l1 && !l2) {
        result.push({ line1: l1, line2: '', status: 'removed' });
      } else {
        result.push({ line1: l1, line2: l2, status: 'modified' });
      }
    }

    return result;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="text-center text-gray-500 py-8">
        Failed to load diff
      </div>
    );
  }

  const diffLines = highlightDifferences(diff.from.content, diff.to.content);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft size={18} />
            Back to History
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'side-by-side'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              Side by Side
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'unified'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              Unified
            </button>
          </div>
        </div>

        {/* Version comparison header */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-lg font-bold">v{diff.from.version}</div>
              <div className={`text-sm ${getScoreColor(diff.from.qualityScore)}`}>
                {diff.from.qualityScore ? `${(diff.from.qualityScore * 100).toFixed(0)}%` : 'N/A'}
              </div>
              <div className="text-xs text-gray-500">
                {formatRelativeTime(diff.from.createdAt)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getImprovementIcon(diff.improvement)}
              <span
                className={`font-medium ${
                  diff.improvement > 0
                    ? 'text-green-500'
                    : diff.improvement < 0
                    ? 'text-red-500'
                    : 'text-gray-400'
                }`}
              >
                {diff.improvement > 0 ? '+' : ''}
                {(diff.improvement * 100).toFixed(1)}%
              </span>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">v{diff.to.version}</div>
              <div className={`text-sm ${getScoreColor(diff.to.qualityScore)}`}>
                {diff.to.qualityScore ? `${(diff.to.qualityScore * 100).toFixed(0)}%` : 'N/A'}
              </div>
              <div className="text-xs text-gray-500">
                {formatRelativeTime(diff.to.createdAt)}
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Similarity: {(diff.diff.similarity * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'side-by-side' ? (
          <div className="grid grid-cols-2 gap-4">
            {/* Version 1 */}
            <div>
              <div className="text-sm font-medium text-gray-500 mb-2">
                Version {diff.from.version}
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 overflow-hidden">
                {diffLines.map((line, index) => (
                  <div
                    key={index}
                    className={`px-3 py-1 text-sm font-mono whitespace-pre-wrap ${
                      line.status === 'removed'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        : line.status === 'modified'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                        : ''
                    }`}
                  >
                    <span className="text-gray-400 mr-2 select-none">
                      {String(index + 1).padStart(3, ' ')}
                    </span>
                    {line.line1 || '\u00A0'}
                  </div>
                ))}
              </div>
            </div>

            {/* Version 2 */}
            <div>
              <div className="text-sm font-medium text-gray-500 mb-2">
                Version {diff.to.version}
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 overflow-hidden">
                {diffLines.map((line, index) => (
                  <div
                    key={index}
                    className={`px-3 py-1 text-sm font-mono whitespace-pre-wrap ${
                      line.status === 'added'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        : line.status === 'modified'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                        : ''
                    }`}
                  >
                    <span className="text-gray-400 mr-2 select-none">
                      {String(index + 1).padStart(3, ' ')}
                    </span>
                    {line.line2 || '\u00A0'}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Unified view */
          <div className="bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 overflow-hidden">
            {diffLines.map((line, index) => (
              <div key={index}>
                {(line.status === 'removed' || line.status === 'modified') && (
                  <div className="px-3 py-1 text-sm font-mono whitespace-pre-wrap bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                    <span className="text-red-400 mr-2 select-none">-</span>
                    {line.line1}
                  </div>
                )}
                {(line.status === 'added' || line.status === 'modified') && (
                  <div className="px-3 py-1 text-sm font-mono whitespace-pre-wrap bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                    <span className="text-green-400 mr-2 select-none">+</span>
                    {line.line2}
                  </div>
                )}
                {line.status === 'same' && (
                  <div className="px-3 py-1 text-sm font-mono whitespace-pre-wrap">
                    <span className="text-gray-400 mr-2 select-none">{'\u00A0'}</span>
                    {line.line1}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Changes summary */}
        {diff.diff.changes.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-500 mb-2">Changes Summary</div>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {diff.diff.changes.slice(0, 10).map((change, index) => (
                <li key={index}>{change}</li>
              ))}
              {diff.diff.changes.length > 10 && (
                <li className="text-gray-400">
                  ...and {diff.diff.changes.length - 10} more changes
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
