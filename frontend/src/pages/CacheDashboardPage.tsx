import { useEffect, useState } from 'react';
import { useCacheStore } from '../store/cacheStore';
import {
  Database,
  Settings,
  BarChart3,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
  Clock,
  Tag,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { formatDateTime, formatRelativeTime, formatNumber, formatCurrency, truncate } from '../lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

export default function CacheDashboardPage() {
  const {
    config,
    analytics,
    entries,
    totalEntries,
    currentPage,
    pageSize,
    isLoading,
    error,
    fetchConfig,
    updateConfig,
    fetchAnalytics,
    fetchEntries,
    deleteEntry,
    invalidateByTags,
    invalidateByPattern,
    clearAllCache,
    cleanupExpired,
  } = useCacheStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'entries' | 'settings'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [showInvalidateModal, setShowInvalidateModal] = useState(false);
  const [invalidateType, setInvalidateType] = useState<'tag' | 'pattern'>('tag');
  const [invalidateValue, setInvalidateValue] = useState('');

  // Local config state for editing
  const [localConfig, setLocalConfig] = useState({
    enabled: true,
    similarityThreshold: 0.85,
    defaultTTLSeconds: 3600,
    maxCacheSize: 10000,
  });

  useEffect(() => {
    fetchConfig();
    fetchAnalytics();
    fetchEntries();
  }, []);

  useEffect(() => {
    if (config) {
      setLocalConfig({
        enabled: config.enabled,
        similarityThreshold: config.similarityThreshold,
        defaultTTLSeconds: config.defaultTTLSeconds,
        maxCacheSize: config.maxCacheSize,
      });
    }
  }, [config]);

  const handleSaveConfig = async () => {
    await updateConfig(localConfig);
  };

  const handleInvalidate = async () => {
    if (!invalidateValue.trim()) return;

    if (invalidateType === 'tag') {
      await invalidateByTags(invalidateValue.split(',').map(t => t.trim()));
    } else {
      await invalidateByPattern(invalidateValue);
    }

    setShowInvalidateModal(false);
    setInvalidateValue('');
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to clear all cache entries? This cannot be undone.')) {
      await clearAllCache();
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchEntries(newPage, pageSize);
  };

  const filteredEntries = entries.filter(
    entry =>
      entry.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.response.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="text-primary" />
            Semantic Cache
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor your semantic caching system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchAnalytics();
              fetchEntries();
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={cleanupExpired}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted"
          >
            <Clock size={18} />
            Cleanup Expired
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 size={16} className="inline mr-2" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('entries')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'entries'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Database size={16} className="inline mr-2" />
          Entries
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'settings'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings size={16} className="inline mr-2" />
          Settings
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {error}
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && analytics && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Database size={16} />
                <span className="text-sm">Total Entries</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(analytics.totalEntries)}</div>
            </div>
            <div className="bg-card border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Zap size={16} />
                <span className="text-sm">Hit Rate</span>
              </div>
              <div className="text-2xl font-bold text-green-500">
                {(analytics.hitRate * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-card border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp size={16} />
                <span className="text-sm">Tokens Saved</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(analytics.tokensSaved)}</div>
            </div>
            <div className="bg-card border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign size={16} />
                <span className="text-sm">Cost Saved</span>
              </div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(analytics.estimatedCostSaved)}
              </div>
            </div>
          </div>

          {/* Chart */}
          {analytics.dailyStats.length > 0 && (
            <div className="bg-card border rounded-xl p-4">
              <h3 className="font-medium mb-4">Cache Performance (Last 30 Days)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                    />
                    <Area
                      type="monotone"
                      dataKey="totalHits"
                      stackId="1"
                      stroke="#10B981"
                      fill="#10B98133"
                      name="Hits"
                    />
                    <Area
                      type="monotone"
                      dataKey="totalMisses"
                      stackId="1"
                      stroke="#EF4444"
                      fill="#EF444433"
                      name="Misses"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top tags */}
          {analytics.topTags.length > 0 && (
            <div className="bg-card border rounded-xl p-4">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Tag size={16} />
                Top Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {analytics.topTags.map((tag) => (
                  <span
                    key={tag.tag}
                    className="px-3 py-1 bg-muted rounded-full text-sm"
                  >
                    {tag.tag} ({tag.count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Entries Tab */}
      {activeTab === 'entries' && (
        <div className="space-y-4">
          {/* Search and actions */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search prompts and responses..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInvalidateModal(true)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                <Filter size={18} className="inline mr-2" />
                Invalidate
              </button>
              <button
                onClick={handleClearAll}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90"
              >
                <Trash2 size={18} className="inline mr-2" />
                Clear All
              </button>
            </div>
          </div>

          {/* Entries list */}
          <div className="bg-card border rounded-xl divide-y">
            {isLoading && entries.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No cache entries found
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <div key={entry.id} className="p-4">
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 bg-muted rounded">{entry.model}</span>
                        <span className="text-xs text-muted-foreground">
                          {entry.hitCount} hits
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(entry.createdAt)}
                        </span>
                      </div>
                      <p className="font-medium text-sm">{truncate(entry.prompt, 100)}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {truncate(entry.response, 150)}
                      </p>
                      {entry.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {entry.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this cache entry?')) {
                            deleteEntry(entry.id);
                          }
                        }}
                        className="p-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={16} />
                      </button>
                      {expandedEntry === entry.id ? (
                        <ChevronUp size={18} />
                      ) : (
                        <ChevronDown size={18} />
                      )}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expandedEntry === entry.id && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Full Prompt</div>
                        <pre className="text-sm bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
                          {entry.prompt}
                        </pre>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Full Response</div>
                        <pre className="text-sm bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
                          {entry.response}
                        </pre>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Tokens Saved:</span>{' '}
                          {entry.tokensSaved}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Expires:</span>{' '}
                          {formatDateTime(entry.expiresAt)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created:</span>{' '}
                          {formatDateTime(entry.createdAt)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Access:</span>{' '}
                          {formatDateTime(entry.lastAccessedAt)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalEntries > pageSize && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {Math.ceil(totalEntries / pageSize)}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage * pageSize >= totalEntries}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-card border rounded-xl p-6 space-y-6">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Enable Caching</h4>
                <p className="text-sm text-muted-foreground">
                  Turn semantic caching on or off globally
                </p>
              </div>
              <button
                onClick={() => setLocalConfig({ ...localConfig, enabled: !localConfig.enabled })}
                className={`w-14 h-7 rounded-full transition-colors ${
                  localConfig.enabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    localConfig.enabled ? 'translate-x-7' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Similarity Threshold */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-medium">Similarity Threshold</h4>
                  <p className="text-sm text-muted-foreground">
                    Minimum similarity score for cache hits (0-1)
                  </p>
                </div>
                <span className="text-lg font-mono">{localConfig.similarityThreshold}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.01"
                value={localConfig.similarityThreshold}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    similarityThreshold: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>More hits (0.5)</span>
                <span>Exact match (1.0)</span>
              </div>
            </div>

            {/* Default TTL */}
            <div>
              <h4 className="font-medium mb-1">Default TTL (seconds)</h4>
              <p className="text-sm text-muted-foreground mb-2">
                How long cache entries remain valid
              </p>
              <input
                type="number"
                value={localConfig.defaultTTLSeconds}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    defaultTTLSeconds: parseInt(e.target.value) || 3600,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Current: {Math.floor(localConfig.defaultTTLSeconds / 3600)} hours{' '}
                {Math.floor((localConfig.defaultTTLSeconds % 3600) / 60)} minutes
              </p>
            </div>

            {/* Max Cache Size */}
            <div>
              <h4 className="font-medium mb-1">Maximum Cache Size</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Maximum number of entries to store
              </p>
              <input
                type="number"
                value={localConfig.maxCacheSize}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    maxCacheSize: parseInt(e.target.value) || 10000,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg bg-background"
              />
            </div>

            {/* Save button */}
            <button
              onClick={handleSaveConfig}
              disabled={isLoading}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* Invalidate Modal */}
      {showInvalidateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border shadow-lg w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Invalidate Cache</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setInvalidateType('tag')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium ${
                    invalidateType === 'tag'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  By Tags
                </button>
                <button
                  onClick={() => setInvalidateType('pattern')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium ${
                    invalidateType === 'pattern'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  By Pattern
                </button>
              </div>
              <input
                type="text"
                value={invalidateValue}
                onChange={(e) => setInvalidateValue(e.target.value)}
                placeholder={
                  invalidateType === 'tag'
                    ? 'Enter tags (comma-separated)'
                    : 'Enter search pattern'
                }
                className="w-full px-3 py-2 border rounded-lg bg-background"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowInvalidateModal(false)}
                className="px-4 py-2 rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleInvalidate}
                disabled={!invalidateValue.trim()}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg disabled:opacity-50"
              >
                Invalidate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
