import { useState, useEffect } from 'react';
import {
  Search,
  BookOpen,
  Lightbulb,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Zap,
  Brain,
  Target,
  Layers,
  GitBranch,
  RefreshCw,
  MessageSquare,
  Link,
  Search as SearchIcon,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useEditorStore } from '../../stores/editorStore';
import { getTechniques, getTechniqueBySlug } from '../../services/templateService';
import type { Technique } from '../../types';
import clsx from 'clsx';

const TECHNIQUE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'chain-of-thought': Brain,
  'few-shot-learning': Layers,
  'role-assignment': Target,
  'output-formatting': Zap,
  'constraints-definition': Target,
  'self-consistency': RefreshCw,
  'tree-of-thoughts': GitBranch,
  'react-pattern': Lightbulb,
  'prompt-chaining': Link,
  'zero-shot-prompting': Sparkles,
  'rag': SearchIcon,
  'meta-prompting': MessageSquare,
};

export function TechniquesView() {
  const { theme, setActiveView } = useAppStore();
  const { loadPrompt } = useEditorStore();
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTechnique, setSelectedTechnique] = useState<Technique | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTechniques();
  }, []);

  const loadTechniques = async () => {
    setIsLoading(true);
    try {
      const data = await getTechniques();
      setTechniques(data);
    } catch (error) {
      console.error('Failed to load techniques:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTechniques = techniques.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTryExample = (example: { prompt: string }) => {
    loadPrompt({
      content: example.prompt,
      title: 'Technique Example',
      description: '',
      tags: [],
      category: 'general',
      model_id: 'gpt-4',
    });
    setActiveView('editor');
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return theme === 'dark' ? 'text-emerald-400 bg-emerald-500/20' : 'text-emerald-700 bg-emerald-100';
      case 'intermediate':
        return theme === 'dark' ? 'text-amber-400 bg-amber-500/20' : 'text-amber-700 bg-amber-100';
      case 'advanced':
        return theme === 'dark' ? 'text-rose-400 bg-rose-500/20' : 'text-rose-700 bg-rose-100';
      default:
        return theme === 'dark' ? 'text-gray-400 bg-gray-500/20' : 'text-gray-700 bg-gray-100';
    }
  };

  return (
    <div className="h-full flex">
      <aside className={clsx(
        'w-80 border-r flex flex-col overflow-hidden',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
      )}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className={clsx('w-6 h-6', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')} />
            <h2 className={clsx('text-lg font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Techniques Library
            </h2>
          </div>

          <div className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg border',
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          )}>
            <Search className={clsx('w-4 h-4', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
            <input
              type="text"
              placeholder="Search techniques..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={clsx(
                'flex-1 bg-transparent border-none outline-none text-sm',
                theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
              )}
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={clsx(
                    'h-16 rounded-lg animate-pulse',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
                  )}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTechniques.map((technique) => {
                const Icon = TECHNIQUE_ICONS[technique.slug] || Lightbulb;
                const isSelected = selectedTechnique?.id === technique.id;

                return (
                  <button
                    key={technique.id}
                    onClick={() => setSelectedTechnique(technique)}
                    className={clsx(
                      'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors',
                      isSelected
                        ? theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'
                        : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    )}
                  >
                    <Icon className={clsx(
                      'w-5 h-5 flex-shrink-0 mt-0.5',
                      isSelected
                        ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                        : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    )} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          'font-medium truncate',
                          isSelected
                            ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'
                            : theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {technique.title}
                        </span>
                        <span className={clsx(
                          'px-1.5 py-0.5 rounded text-xs capitalize flex-shrink-0',
                          getDifficultyColor(technique.difficulty)
                        )}>
                          {technique.difficulty}
                        </span>
                      </div>
                      <p className={clsx(
                        'text-sm truncate mt-0.5',
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                      )}>
                        {technique.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {selectedTechnique ? (
          <div className="p-6 max-w-4xl">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                {(() => {
                  const Icon = TECHNIQUE_ICONS[selectedTechnique.slug] || Lightbulb;
                  return <Icon className={clsx('w-8 h-8', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')} />;
                })()}
                <h1 className={clsx('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {selectedTechnique.title}
                </h1>
              </div>
              <p className={clsx('text-lg', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                {selectedTechnique.description}
              </p>
              <div className="flex items-center gap-3 mt-3">
                <span className={clsx('px-2 py-1 rounded text-sm capitalize', getDifficultyColor(selectedTechnique.difficulty))}>
                  {selectedTechnique.difficulty}
                </span>
                {selectedTechnique.tags.map((tag) => (
                  <span
                    key={tag}
                    className={clsx(
                      'px-2 py-1 rounded text-sm',
                      theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className={clsx(
              'prose max-w-none',
              theme === 'dark' ? 'prose-invert' : ''
            )}>
              <div
                className={clsx(
                  'rounded-lg p-6',
                  theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                )}
                dangerouslySetInnerHTML={{
                  __html: selectedTechnique.content
                    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-800 p-4 rounded-lg overflow-x-auto"><code>$2</code></pre>')
                    .replace(/## (.*)/g, `<h2 class="${theme === 'dark' ? 'text-white' : 'text-gray-900'} text-xl font-semibold mt-6 mb-3">$1</h2>`)
                    .replace(/### (.*)/g, `<h3 class="${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'} text-lg font-medium mt-4 mb-2">$1</h3>`)
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/`([^`]+)`/g, `<code class="px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-gray-800 text-emerald-400' : 'bg-gray-200 text-emerald-600'}">$1</code>`)
                    .replace(/\n- (.*)/g, `<li class="${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}">$1</li>`)
                    .replace(/\n\n/g, '</p><p class="mb-4">')
                }}
              />
            </div>

            {selectedTechnique.best_for.length > 0 && (
              <div className="mt-6">
                <h3 className={clsx('font-semibold mb-3', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Best For
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedTechnique.best_for.map((useCase) => (
                    <span
                      key={useCase}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-sm',
                        theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                      )}
                    >
                      {useCase}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedTechnique.examples.length > 0 && (
              <div className="mt-6">
                <h3 className={clsx('font-semibold mb-3', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Examples
                </h3>
                <div className="space-y-4">
                  {selectedTechnique.examples.map((example, index) => (
                    <div
                      key={index}
                      className={clsx(
                        'rounded-lg border p-4',
                        theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {example.name}
                        </span>
                        <button
                          onClick={() => handleTryExample(example)}
                          className={clsx(
                            'px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors',
                            theme === 'dark'
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          )}
                        >
                          Try It
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                      <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        {example.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTechnique.related_techniques.length > 0 && (
              <div className="mt-6">
                <h3 className={clsx('font-semibold mb-3', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Related Techniques
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedTechnique.related_techniques.map((slug) => {
                    const related = techniques.find((t) => t.slug === slug);
                    if (!related) return null;
                    return (
                      <button
                        key={slug}
                        onClick={() => setSelectedTechnique(related)}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-colors',
                          theme === 'dark'
                            ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                      >
                        {related.title}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={clsx(
            'h-full flex flex-col items-center justify-center',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          )}>
            <BookOpen className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">Select a technique to learn more</p>
            <p className="text-sm mt-1">Master prompt engineering with our comprehensive guide</p>
          </div>
        )}
      </main>
    </div>
  );
}
