import { useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useAppStore } from '../stores/appStore';
import { Wand2, Brain, Clock, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface MetaPromptingPanelProps {
  className?: string;
  collapsed?: boolean;
}

export function MetaPromptingPanel({ className, collapsed = false }: MetaPromptingPanelProps) {
  const { sessionId } = useAppStore();
  const {
    metaPromptConfig,
    sessionMetaPrompt,
    metaPromptEnabled,
    setMetaPromptConfig,
    setMetaPromptEnabled,
    generateSessionMetaPrompt,
  } = useEditorStore();

  // Generate session meta-prompt when config changes and enabled
  useEffect(() => {
    if (metaPromptEnabled && sessionId) {
      generateSessionMetaPrompt(sessionId);
    }
  }, [metaPromptEnabled, metaPromptConfig, sessionId, generateSessionMetaPrompt]);

  const personas = [
    { value: '', label: 'None' },
    { value: 'Technical Expert', label: 'Technical Expert' },
    { value: 'Creative Writer', label: 'Creative Writer' },
    { value: 'Data Analyst', label: 'Data Analyst' },
    { value: 'Product Manager', label: 'Product Manager' },
    { value: 'Teacher', label: 'Teacher' },
    { value: 'Researcher', label: 'Researcher' },
    { value: 'Business Consultant', label: 'Business Consultant' },
    { value: 'Marketing Specialist', label: 'Marketing Specialist' },
  ];

  const domains = [
    { value: '', label: 'None' },
    { value: 'Software Development', label: 'Software Development' },
    { value: 'Data Science', label: 'Data Science' },
    { value: 'Machine Learning', label: 'Machine Learning' },
    { value: 'Business Strategy', label: 'Business Strategy' },
    { value: 'Content Creation', label: 'Content Creation' },
    { value: 'Education', label: 'Education' },
    { value: 'Healthcare', label: 'Healthcare' },
    { value: 'Finance', label: 'Finance' },
    { value: 'Legal', label: 'Legal' },
    { value: 'Science & Research', label: 'Science & Research' },
  ];

  const timeConstraints = [
    { value: 'urgent', label: 'Urgent', description: 'Quick, concise responses' },
    { value: 'standard', label: 'Standard', description: 'Balanced detail and speed' },
    { value: 'comprehensive', label: 'Comprehensive', description: 'Thorough, detailed analysis' },
  ];

  if (collapsed) {
    return (
      <div className={clsx('p-2 border-b border-gray-200 dark:border-gray-700', className)}>
        <button
          onClick={() => setMetaPromptEnabled(!metaPromptEnabled)}
          className="w-full flex items-center justify-between text-sm px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4" />
            <span>Meta-Prompting</span>
          </div>
          <ChevronDown className={clsx('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>
    );
  }

  return (
    <div className={clsx('p-4 border-b border-gray-200 dark:border-gray-700 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Meta-Prompting</h3>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={metaPromptEnabled}
            onChange={(e) => setMetaPromptEnabled(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">Enable</span>
        </label>
      </div>

      {metaPromptEnabled && (
        <>
          {/* Persona Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Brain className="w-4 h-4" />
              Persona
            </label>
            <select
              value={metaPromptConfig.persona || ''}
              onChange={(e) => setMetaPromptConfig({ persona: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {personas.map((persona) => (
                <option key={persona.value} value={persona.value}>
                  {persona.label}
                </option>
              ))}
            </select>
          </div>

          {/* Domain Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Brain className="w-4 h-4" />
              Domain
            </label>
            <select
              value={metaPromptConfig.domain || ''}
              onChange={(e) => setMetaPromptConfig({ domain: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {domains.map((domain) => (
                <option key={domain.value} value={domain.value}>
                  {domain.label}
                </option>
              ))}
            </select>
          </div>

          {/* Time Constraint */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Clock className="w-4 h-4" />
              Response Depth
            </label>
            <div className="grid grid-cols-3 gap-2">
              {timeConstraints.map((constraint) => (
                <button
                  key={constraint.value}
                  onClick={() => setMetaPromptConfig({ timeConstraint: constraint.value as any })}
                  className={clsx(
                    'px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                    metaPromptConfig.timeConstraint === constraint.value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-700'
                  )}
                  title={constraint.description}
                >
                  {constraint.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {timeConstraints.find((c) => c.value === metaPromptConfig.timeConstraint)?.description}
            </p>
          </div>

          {/* Generated Meta-Prompt Preview */}
          {sessionMetaPrompt && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Generated Instructions
              </label>
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <p className="text-sm text-purple-900 dark:text-purple-100 leading-relaxed">
                  {sessionMetaPrompt}
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This instruction layer is fixed for this session and will be prepended to your prompts.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
