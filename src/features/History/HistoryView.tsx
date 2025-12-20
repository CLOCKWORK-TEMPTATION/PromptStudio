import { useState, useEffect } from 'react';
import {
  History,
  Search,
  Star,
  StarOff,
  Trash2,
  Clock,
  Copy,
  ArrowRight,
  Filter,
  Calendar,
  Tag,
  GitCompare,
  RotateCcw,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useEditorStore } from '../../stores/editorStore';
import { getPrompts, getFavoritePrompts, toggleFavorite, deletePrompt, getPromptVersions } from '../../services/promptService';
import type { Prompt, PromptVersion } from '../../types';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

export function HistoryView() {
  const { theme, sessionId, setActiveView, setCurrentPrompt } = useAppStore();
  const { loadPrompt } = useEditorStore();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'favorites' | 'recent'>('all');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadPrompts();
    }
  }, [sessionId, filterType]);

  const loadPrompts = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const data = filterType === 'favorites'
        ? await getFavoritePrompts(sessionId)
        : await getPrompts(sessionId);
      setPrompts(data);
    } catch (error) {
      console.error('Failed to load prompts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadVersions = async (promptId: string) => {
    try {
      const data = await getPromptVersions(promptId);
      setVersions(data);
      setShowVersions(true);
    } catch (error) {
      console.error('Failed to load versions:', error);
    }
  };

  const handleToggleFavorite = async (prompt: Prompt) => {
    await toggleFavorite(prompt.id, !prompt.is_favorite);
    setPrompts(prompts.map((p) =>
      p.id === prompt.id ? { ...p, is_favorite: !p.is_favorite } : p
    ));
  };

  const handleDelete = async (promptId: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;
    await deletePrompt(promptId);
    setPrompts(prompts.filter((p) => p.id !== promptId));
    if (selectedPrompt?.id === promptId) {
      setSelectedPrompt(null);
    }
  };

  const handleOpenPrompt = (prompt: Prompt) => {
    setCurrentPrompt(prompt);
    loadPrompt({
      content: prompt.content,
      title: prompt.title,
      description: prompt.description,
      tags: prompt.tags,
      category: prompt.category,
      model_id: prompt.model_id,
    });
    setActiveView('editor');
  };

  const filteredPrompts = prompts.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex">
      <aside className={clsx(
        'w-80 border-r flex flex-col',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
      )}>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <History className={clsx('w-6 h-6', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')} />
            <h2 className={clsx('text-lg font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              History
            </h2>
          </div>

          <div className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg border',
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          )}>
            <Search className={clsx('w-4 h-4', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={clsx(
                'flex-1 bg-transparent border-none outline-none text-sm',
                theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
              )}
            />
          </div>

          <div className="flex gap-1">
            {[
              { id: 'all', label: 'All', icon: Filter },
              { id: 'favorites', label: 'Favorites', icon: Star },
              { id: 'recent', label: 'Recent', icon: Clock },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setFilterType(filter.id as typeof filterType)}
                className={clsx(
                  'flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1',
                  filterType === filter.id
                    ? theme === 'dark'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-emerald-100 text-emerald-700'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:bg-gray-800'
                      : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <filter.icon className="w-3.5 h-3.5" />
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={clsx(
                    'h-20 rounded-lg animate-pulse',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
                  )}
                />
              ))}
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className={clsx(
              'text-center py-8',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )}>
              <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No prompts found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => setSelectedPrompt(prompt)}
                  className={clsx(
                    'w-full p-3 rounded-lg text-left transition-colors',
                    selectedPrompt?.id === prompt.id
                      ? theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'
                      : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={clsx(
                      'font-medium truncate',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {prompt.title}
                    </span>
                    {prompt.is_favorite && (
                      <Star className={clsx('w-4 h-4 flex-shrink-0', theme === 'dark' ? 'text-amber-400' : 'text-amber-500')} fill="currentColor" />
                    )}
                  </div>
                  <p className={clsx(
                    'text-sm truncate mt-1',
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                  )}>
                    {prompt.content.slice(0, 50)}...
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className={clsx('w-3 h-3', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                    <span className={clsx('text-xs', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')}>
                      {formatDistanceToNow(new Date(prompt.updated_at), { addSuffix: true })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {selectedPrompt ? (
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className={clsx('text-2xl font-bold mb-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {selectedPrompt.title}
                </h1>
                <div className="flex items-center gap-3 text-sm">
                  <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}>
                    Updated {formatDistanceToNow(new Date(selectedPrompt.updated_at), { addSuffix: true })}
                  </span>
                  <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}>
                    {selectedPrompt.usage_count} uses
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleFavorite(selectedPrompt)}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  )}
                >
                  {selectedPrompt.is_favorite ? (
                    <Star className="w-5 h-5 text-amber-500" fill="currentColor" />
                  ) : (
                    <StarOff className={clsx('w-5 h-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                  )}
                </button>
                <button
                  onClick={() => loadVersions(selectedPrompt.id)}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                  )}
                  title="View versions"
                >
                  <GitCompare className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(selectedPrompt.id)}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-500 hover:text-red-600'
                  )}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {selectedPrompt.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedPrompt.tags.map((tag) => (
                  <span
                    key={tag}
                    className={clsx(
                      'px-2 py-1 rounded text-sm flex items-center gap-1',
                      theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                    )}
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className={clsx(
              'rounded-lg border p-4 mb-4',
              theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
            )}>
              <pre className={clsx(
                'whitespace-pre-wrap font-mono text-sm',
                theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
              )}>
                {selectedPrompt.content}
              </pre>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleOpenPrompt(selectedPrompt)}
                className={clsx(
                  'px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                )}
              >
                <ArrowRight className="w-4 h-4" />
                Open in Editor
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(selectedPrompt.content)}
                className={clsx(
                  'px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>

            {showVersions && versions.length > 0 && (
              <div className="mt-6">
                <h3 className={clsx('font-semibold mb-3', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Version History
                </h3>
                <div className="space-y-2">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className={clsx(
                        'p-3 rounded-lg border',
                        theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Version {version.version_number}
                        </span>
                        <span className={clsx('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {version.change_summary && (
                        <p className={clsx('text-sm mb-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                          {version.change_summary}
                        </p>
                      )}
                      <button
                        className={clsx(
                          'text-sm flex items-center gap-1',
                          theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                        )}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={clsx(
            'h-full flex flex-col items-center justify-center',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          )}>
            <History className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">Select a prompt to view details</p>
          </div>
        )}
      </main>
    </div>
  );
}
