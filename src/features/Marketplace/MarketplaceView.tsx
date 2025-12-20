import React, { useState, useEffect } from 'react';
import {
  Store,
  Search,
  Star,
  Download,
  Eye,
  Filter,
  Clock,
  User,
  X,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useEditorStore } from '../../stores/editorStore';
import type { MarketplacePrompt, MarketplacePromptVariable } from '../../types';
import { supabase } from '../../lib/supabase';
import clsx from 'clsx';

type SortOption = 'popular' | 'recent' | 'rating' | 'trending';
type CategoryFilter = 'all' | 'coding' | 'writing' | 'analysis' | 'creative' | 'data' | 'business';

const SAMPLE_PROMPTS: MarketplacePrompt[] = [
  {
    id: '1',
    title: 'Code Review Assistant',
    description: 'A comprehensive prompt for reviewing code quality, best practices, and potential improvements.',
    content: 'Review the following code for:\n1. Code quality and readability\n2. Best practices\n3. Potential bugs\n4. Performance improvements\n\n{{code}}',
    category: 'coding',
    tags: ['code-review', 'best-practices', 'debugging'],
    authorId: 'user1',
    authorName: 'DevExpert',
    isFeatured: true,
    isStaffPick: false,
    rating: 4.8,
    avgRating: 4.8,
    reviewCount: 156,
    viewCount: 2340,
    downloads: 892,
    cloneCount: 892,
    variables: [{ name: 'code', type: 'string', description: 'The code to review' }],
    modelRecommendation: 'GPT-4',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-03-20'),
  },
  {
    id: '2',
    title: 'Creative Story Writer',
    description: 'Generate engaging stories with rich characters and plot development.',
    content: 'Write a {{genre}} story about {{topic}}. Include vivid descriptions and engaging dialogue.',
    category: 'creative',
    tags: ['storytelling', 'creative-writing', 'fiction'],
    authorId: 'user2',
    authorName: 'StoryMaster',
    isFeatured: false,
    isStaffPick: true,
    rating: 4.5,
    avgRating: 4.5,
    reviewCount: 89,
    viewCount: 1567,
    downloads: 445,
    cloneCount: 445,
    variables: [
      { name: 'genre', type: 'string', description: 'Story genre' },
      { name: 'topic', type: 'string', description: 'Main topic or theme' },
    ],
    modelRecommendation: 'GPT-4',
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-03-18'),
  },
];

export function MarketplaceView() {
  const { theme, setActiveView } = useAppStore();
  const { setContent, setTitle } = useEditorStore();
  const [prompts, setPrompts] = useState<MarketplacePrompt[]>(SAMPLE_PROMPTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedPrompt, setSelectedPrompt] = useState<MarketplacePrompt | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadMarketplacePrompts();
  }, []);

  const loadMarketplacePrompts = async () => {
    try {
      if (!supabase) return;
      const { data } = await supabase
        .from('marketplace_prompts')
        .select('*')
        .eq('status', 'approved')
        .order('clone_count', { ascending: false });

      if (data && data.length > 0) {
        setPrompts(data as unknown as MarketplacePrompt[]);
      }
    } catch {
      // Error handled silently
    }
  };

  const filteredPrompts = prompts
    .filter((p: MarketplacePrompt) => {
      const matchesSearch =
        searchQuery === '' ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a: MarketplacePrompt, b: MarketplacePrompt) => {
      switch (sortBy) {
        case 'popular':
          return (b.cloneCount ?? b.downloads) - (a.cloneCount ?? a.downloads);
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'rating':
          return (b.avgRating ?? b.rating) - (a.avgRating ?? a.rating);
        case 'trending':
          return (b.viewCount ?? 0) - (a.viewCount ?? 0);
        default:
          return 0;
      }
    });

  const usePrompt = (prompt: MarketplacePrompt) => {
    setContent(prompt.content);
    setTitle(prompt.title ?? '');
    setActiveView('editor');
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={clsx(
          'w-4 h-4',
          i < Math.round(rating)
            ? 'text-amber-400 fill-amber-400'
            : theme === 'dark'
            ? 'text-gray-600'
            : 'text-gray-300'
        )}
      />
    ));
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      coding: 'emerald',
      writing: 'blue',
      analysis: 'cyan',
      creative: 'rose',
      data: 'amber',
      business: 'violet',
    };
    return colors[category] || 'gray';
  };

  return (
    <div className="h-full flex flex-col">
      <div
        className={clsx(
          'px-6 py-4 border-b flex items-center justify-between',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}
      >
        <div className="flex items-center gap-4">
          <Store className={clsx('w-6 h-6', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')} />
          <h1 className={clsx('text-xl font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Prompt Marketplace
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              className={clsx(
                'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              )}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              placeholder="Search prompts..."
              className={clsx(
                'w-80 pl-10 pr-4 py-2 rounded-lg border text-sm transition-colors',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500/50'
              )}
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'p-2 rounded-lg border transition-colors',
              showFilters
                ? theme === 'dark'
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-600'
                : theme === 'dark'
                ? 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:text-gray-900'
            )}
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showFilters && (
        <div
          className={clsx(
            'px-6 py-3 border-b flex items-center gap-4',
            theme === 'dark' ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-50 border-gray-200'
          )}
        >
          <div className="flex items-center gap-2">
            <span className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as SortOption)}
              className={clsx(
                'px-3 py-1.5 rounded-lg border text-sm',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              <option value="popular">Most Popular</option>
              <option value="recent">Most Recent</option>
              <option value="rating">Highest Rated</option>
              <option value="trending">Trending</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Category:</span>
            <select
              value={categoryFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategoryFilter(e.target.value as CategoryFilter)}
              className={clsx(
                'px-3 py-1.5 rounded-lg border text-sm',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              <option value="all">All Categories</option>
              <option value="coding">Coding</option>
              <option value="writing">Writing</option>
              <option value="analysis">Analysis</option>
              <option value="creative">Creative</option>
              <option value="data">Data</option>
              <option value="business">Business</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrompts.map((prompt: MarketplacePrompt) => {
            const color = getCategoryColor(prompt.category);

            return (
              <div
                key={prompt.id}
                onClick={() => setSelectedPrompt(prompt)}
                className={clsx(
                  'rounded-xl border p-5 cursor-pointer transition-all duration-200',
                  theme === 'dark'
                    ? 'bg-gray-900 border-gray-800 hover:border-gray-700'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg'
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {prompt.isFeatured && (
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          theme === 'dark' ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
                        )}
                      >
                        Featured
                      </span>
                    )}
                    {prompt.isStaffPick && (
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                        )}
                      >
                        Staff Pick
                      </span>
                    )}
                  </div>
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                      theme === 'dark' ? `bg-${color}-500/20 text-${color}-400` : `bg-${color}-100 text-${color}-700`
                    )}
                  >
                    {prompt.category}
                  </span>
                </div>

                <h3
                  className={clsx(
                    'text-lg font-semibold mb-2 line-clamp-1',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}
                >
                  {prompt.title}
                </h3>

                <p
                  className={clsx('text-sm mb-4 line-clamp-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}
                >
                  {prompt.description}
                </p>

                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-1">{renderStars(prompt.avgRating ?? prompt.rating)}</div>
                  <span className={clsx('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                    ({prompt.reviewCount ?? 0})
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {prompt.tags.slice(0, 3).map((tag: string) => (
                    <span
                      key={tag}
                      className={clsx(
                        'px-2 py-0.5 rounded-full text-xs',
                        theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {tag}
                    </span>
                  ))}
                  {prompt.tags.length > 3 && (
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full text-xs',
                        theme === 'dark' ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      +{prompt.tags.length - 3}
                    </span>
                  )}
                </div>

                <div
                  className={clsx(
                    'flex items-center justify-between pt-4 border-t',
                    theme === 'dark' ? 'border-gray-800' : 'border-gray-100'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <User className={clsx('w-4 h-4', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                    <span className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      {prompt.authorName ?? 'Anonymous'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Eye className={clsx('w-4 h-4', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                      <span className={clsx('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                        {(prompt.viewCount ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Download className={clsx('w-4 h-4', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                      <span className={clsx('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                        {(prompt.cloneCount ?? prompt.downloads).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredPrompts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <Store className={clsx('w-16 h-16 mb-4', theme === 'dark' ? 'text-gray-700' : 'text-gray-300')} />
            <h3 className={clsx('text-lg font-medium mb-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              No prompts found
            </h3>
            <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>

      {selectedPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            className={clsx(
              'w-full max-w-3xl max-h-[90vh] rounded-xl overflow-hidden',
              theme === 'dark' ? 'bg-gray-900' : 'bg-white'
            )}
          >
            <div
              className={clsx(
                'px-6 py-4 border-b flex items-center justify-between',
                theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
              )}
            >
              <h2 className={clsx('text-xl font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {selectedPrompt.title}
              </h2>
              <button
                onClick={() => setSelectedPrompt(null)}
                className={clsx(
                  'p-2 rounded-lg transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <User className={clsx('w-5 h-5', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                    <span className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {selectedPrompt.authorName ?? 'Anonymous'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">{renderStars(selectedPrompt.avgRating ?? selectedPrompt.rating)}</div>
                  <span className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    {(selectedPrompt.avgRating ?? selectedPrompt.rating).toFixed(1)} ({selectedPrompt.reviewCount ?? 0} reviews)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={clsx(
                      'px-3 py-1 rounded-full text-sm capitalize',
                      theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {selectedPrompt.category}
                  </span>
                </div>
              </div>

              <p className={clsx('text-base', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                {selectedPrompt.description}
              </p>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Eye className={clsx('w-5 h-5', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                  <span className={clsx(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    {(selectedPrompt.viewCount ?? 0).toLocaleString()} views
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Download className={clsx('w-5 h-5', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                  <span className={clsx(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    {(selectedPrompt.cloneCount ?? selectedPrompt.downloads).toLocaleString()} clones
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className={clsx('w-5 h-5', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                  <span className={clsx(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Updated {new Date(selectedPrompt.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedPrompt.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className={clsx(
                      'px-3 py-1 rounded-full text-sm',
                      theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div>
                <h3 className={clsx('font-medium mb-3', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Prompt Content
                </h3>
                <div
                  className={clsx(
                    'rounded-lg p-4 overflow-x-auto',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                  )}
                >
                  <pre
                    className={clsx(
                      'text-sm whitespace-pre-wrap font-mono',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}
                  >
                    {selectedPrompt.content}
                  </pre>
                </div>
              </div>

              {selectedPrompt.variables && selectedPrompt.variables.length > 0 && (
                <div>
                  <h3 className={clsx('font-medium mb-3', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Variables
                  </h3>
                  <div className="space-y-2">
                    {selectedPrompt.variables.map((v: MarketplacePromptVariable) => (
                      <div
                        key={v.name}
                        className={clsx(
                          'flex items-center justify-between px-4 py-2 rounded-lg',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                        )}
                      >
                        <div>
                          <span className={clsx('font-mono text-sm', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')}>
                            {`{{${v.name}}}`}
                          </span>
                          <span className={clsx('ml-2 text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            {v.description}
                          </span>
                        </div>
                        <span className={clsx('text-xs uppercase', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                          {v.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className={clsx('font-medium mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Recommended Model
                </h3>
                <span
                  className={clsx(
                    'inline-block px-3 py-1 rounded-full text-sm',
                    theme === 'dark' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700'
                  )}
                >
                  {selectedPrompt.modelRecommendation}
                </span>
              </div>
            </div>

            <div
              className={clsx(
                'px-6 py-4 border-t flex items-center justify-end gap-3',
                theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
              )}
            >
              <button
                onClick={() => setSelectedPrompt(null)}
                className={clsx(
                  'px-4 py-2 rounded-lg font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                Close
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedPrompt.content);
                }}
                className={clsx(
                  'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2',
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
              <button
                onClick={() => {
                  usePrompt(selectedPrompt);
                  setSelectedPrompt(null);
                }}
                className={clsx(
                  'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2',
                  theme === 'dark'
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                )}
              >
                <ExternalLink className="w-4 h-4" />
                Use in Editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
