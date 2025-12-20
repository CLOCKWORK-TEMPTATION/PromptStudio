import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Star,
  Clock,
  Code,
  PenTool,
  BarChart,
  Sparkles,
  Database,
  Briefcase,
  MessageCircle,
  GraduationCap,
  ArrowRight,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useEditorStore } from '../../stores/editorStore';
import { getTemplates, getFeaturedTemplates, getTemplatesByCategory, searchTemplates, incrementTemplateUsage } from '../../services/templateService';
import type { Template } from '../../types';
import { TEMPLATE_CATEGORIES } from '../../types';
import clsx from 'clsx';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  coding: Code,
  writing: PenTool,
  analysis: BarChart,
  creative: Sparkles,
  data: Database,
  business: Briefcase,
  'customer-service': MessageCircle,
  education: GraduationCap,
};

export function TemplatesView() {
  const { theme, setActiveView } = useAppStore();
  const { loadPrompt } = useEditorStore();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [featuredTemplates, setFeaturedTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [selectedCategory]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) {
        handleSearch();
      } else {
        loadTemplates();
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const [allTemplates, featured] = await Promise.all([
        selectedCategory ? getTemplatesByCategory(selectedCategory) : getTemplates(),
        getFeaturedTemplates(),
      ]);
      setTemplates(allTemplates);
      setFeaturedTemplates(featured);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const results = await searchTemplates(searchQuery);
      setTemplates(results);
    } catch (error) {
      console.error('Failed to search templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseTemplate = async (template: Template) => {
    await incrementTemplateUsage(template.id);
    loadPrompt({
      content: template.content,
      title: `${template.title} (Copy)`,
      description: template.description,
      tags: template.tags,
      category: template.category,
      model_id: template.model_recommendation,
    });
    setActiveView('editor');
  };

  const handleCopyTemplate = async (template: Template) => {
    await navigator.clipboard.writeText(template.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        'w-64 border-r flex flex-col',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
      )}>
        <div className="p-4">
          <div className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg border',
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          )}>
            <Search className={clsx('w-4 h-4', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={clsx(
                'flex-1 bg-transparent border-none outline-none text-sm',
                theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
              )}
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors',
              !selectedCategory
                ? theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                : theme === 'dark' ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Filter className="w-5 h-5" />
            <span className="font-medium">All Templates</span>
          </button>

          <div className={clsx(
            'my-2 px-3 py-1 text-xs font-medium',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
          )}>
            CATEGORIES
          </div>

          {TEMPLATE_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id] || Filter;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors',
                  selectedCategory === cat.id
                    ? theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                    : theme === 'dark' ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {!searchQuery && !selectedCategory && featuredTemplates.length > 0 && (
            <section className="mb-8">
              <h2 className={clsx(
                'text-lg font-semibold mb-4 flex items-center gap-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <Star className="w-5 h-5 text-amber-500" />
                Featured Templates
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredTemplates.slice(0, 3).map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    theme={theme}
                    onClick={() => setSelectedTemplate(template)}
                    onUse={() => handleUseTemplate(template)}
                    getDifficultyColor={getDifficultyColor}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className={clsx(
              'text-lg font-semibold mb-4',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {selectedCategory
                ? `${TEMPLATE_CATEGORIES.find((c) => c.id === selectedCategory)?.name || ''} Templates`
                : searchQuery
                  ? `Search Results for "${searchQuery}"`
                  : 'All Templates'}
            </h2>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className={clsx(
                      'h-48 rounded-lg animate-pulse',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
                    )}
                  />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <div className={clsx(
                'text-center py-12',
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              )}>
                <p>No templates found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    theme={theme}
                    onClick={() => setSelectedTemplate(template)}
                    onUse={() => handleUseTemplate(template)}
                    getDifficultyColor={getDifficultyColor}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {selectedTemplate && (
        <TemplateModal
          template={selectedTemplate}
          theme={theme}
          onClose={() => setSelectedTemplate(null)}
          onUse={() => handleUseTemplate(selectedTemplate)}
          onCopy={() => handleCopyTemplate(selectedTemplate)}
          copied={copied}
          getDifficultyColor={getDifficultyColor}
        />
      )}
    </div>
  );
}

interface TemplateCardProps {
  template: Template;
  theme: 'light' | 'dark';
  onClick: () => void;
  onUse: () => void;
  getDifficultyColor: (difficulty: string) => string;
}

function TemplateCard({ template, theme, onClick, onUse, getDifficultyColor }: TemplateCardProps) {
  const Icon = CATEGORY_ICONS[template.category] || Filter;

  return (
    <div
      className={clsx(
        'rounded-lg border p-4 cursor-pointer transition-all hover:shadow-lg',
        theme === 'dark'
          ? 'bg-gray-900 border-gray-800 hover:border-gray-700'
          : 'bg-white border-gray-200 hover:border-gray-300'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={clsx(
          'p-2 rounded-lg',
          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
        )}>
          <Icon className={clsx('w-5 h-5', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')} />
        </div>
        <span className={clsx('px-2 py-0.5 rounded text-xs font-medium capitalize', getDifficultyColor(template.difficulty))}>
          {template.difficulty}
        </span>
      </div>

      <h3 className={clsx(
        'font-semibold mb-1',
        theme === 'dark' ? 'text-white' : 'text-gray-900'
      )}>
        {template.title}
      </h3>

      <p className={clsx(
        'text-sm mb-3 line-clamp-2',
        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
      )}>
        {template.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Clock className={clsx('w-4 h-4', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
          <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}>
            {template.usage_count} uses
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onUse();
          }}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            theme === 'dark'
              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
          )}
        >
          Use
        </button>
      </div>
    </div>
  );
}

interface TemplateModalProps {
  template: Template;
  theme: 'light' | 'dark';
  onClose: () => void;
  onUse: () => void;
  onCopy: () => void;
  copied: boolean;
  getDifficultyColor: (difficulty: string) => string;
}

function TemplateModal({ template, theme, onClose, onUse, onCopy, copied, getDifficultyColor }: TemplateModalProps) {
  const Icon = CATEGORY_ICONS[template.category] || Filter;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={clsx(
        'relative w-full max-w-3xl max-h-[90vh] rounded-xl overflow-hidden shadow-2xl',
        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
      )}>
        <div className={clsx(
          'px-6 py-4 border-b flex items-center justify-between',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={clsx(
              'p-2 rounded-lg',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              <Icon className={clsx('w-5 h-5', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')} />
            </div>
            <div>
              <h2 className={clsx('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {template.title}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={clsx(
                  'px-2 py-0.5 rounded text-xs font-medium capitalize',
                  getDifficultyColor(template.difficulty)
                )}>
                  {template.difficulty}
                </span>
                <span className={clsx('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                  {template.usage_count} uses
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <p className={clsx('mb-4', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
            {template.description}
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {template.tags.map((tag) => (
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

          <div className={clsx(
            'rounded-lg p-4 font-mono text-sm overflow-x-auto',
            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
          )}>
            <pre className={clsx('whitespace-pre-wrap', theme === 'dark' ? 'text-gray-200' : 'text-gray-800')}>
              {template.content}
            </pre>
          </div>

          {template.variables.length > 0 && (
            <div className="mt-4">
              <h3 className={clsx(
                'font-medium mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Variables
              </h3>
              <div className="space-y-2">
                {template.variables.map((v) => (
                  <div
                    key={v.name}
                    className={clsx(
                      'flex items-center justify-between px-3 py-2 rounded-lg',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                    )}
                  >
                    <code className={clsx('text-sm', theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600')}>
                      {`{{${v.name}}}`}
                    </code>
                    <span className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      {v.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={clsx(
          'px-6 py-4 border-t flex justify-end gap-3',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <button
            onClick={onCopy}
            className={clsx(
              'px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors',
              theme === 'dark'
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={onUse}
            className={clsx(
              'px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors',
              theme === 'dark'
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            )}
          >
            <ArrowRight className="w-4 h-4" />
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
}
