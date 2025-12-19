import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { History, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDateTime, formatRelativeTime } from '../../lib/utils';

interface HistoryEntry {
  id: string;
  operation: string;
  contentBefore?: string;
  contentAfter?: string;
  timestamp: string;
  user: {
    id: string;
    name: string;
    color: string;
  };
}

interface HistoryPanelProps {
  sessionId: string;
}

export default function HistoryPanel({ sessionId }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [sessionId]);

  const fetchHistory = async (pageNum = 1) => {
    setIsLoading(true);
    try {
      const response = await api.get<{ data: HistoryEntry[]; meta: { hasMore: boolean } }>(
        `/sessions/${sessionId}/history`,
        { page: pageNum, pageSize: 20 }
      );
      if (pageNum === 1) {
        setHistory(response.data.data);
      } else {
        setHistory(prev => [...prev, ...response.data.data]);
      }
      setHasMore(response.data.meta.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = () => {
    fetchHistory(page + 1);
  };

  const parseOperation = (operation: string) => {
    try {
      return JSON.parse(operation);
    } catch {
      return { type: 'unknown' };
    }
  };

  const getOperationLabel = (operation: string) => {
    const parsed = parseOperation(operation);
    switch (parsed.type) {
      case 'crdt_update':
        return 'Edited content';
      case 'restore_snapshot':
        return 'Restored snapshot';
      case 'update':
        return 'Updated';
      default:
        return 'Modified';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="font-medium flex items-center gap-2">
          <History size={18} />
          Edit History
        </h3>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && history.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No history yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {history.map((entry) => (
              <div key={entry.id} className="p-4">
                <div
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
                    style={{ backgroundColor: entry.user.color }}
                  >
                    {entry.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{entry.user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getOperationLabel(entry.operation)}
                    </p>
                  </div>
                  {(entry.contentBefore || entry.contentAfter) && (
                    <button className="p-1 text-muted-foreground">
                      {expandedId === entry.id ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded content diff */}
                {expandedId === entry.id && (entry.contentBefore || entry.contentAfter) && (
                  <div className="mt-3 ml-11 space-y-2">
                    {entry.contentBefore && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Before:</div>
                        <pre className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800 overflow-x-auto max-h-32 overflow-y-auto">
                          {entry.contentBefore.slice(0, 500)}
                          {entry.contentBefore.length > 500 && '...'}
                        </pre>
                      </div>
                    )}
                    {entry.contentAfter && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">After:</div>
                        <pre className="text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800 overflow-x-auto max-h-32 overflow-y-auto">
                          {entry.contentAfter.slice(0, 500)}
                          {entry.contentAfter.length > 500 && '...'}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {hasMore && (
              <div className="p-4">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    'Load more'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
