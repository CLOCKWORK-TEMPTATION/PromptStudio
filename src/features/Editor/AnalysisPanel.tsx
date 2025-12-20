import {
  BarChart3,
  AlertTriangle,
  Lightbulb,
  Shield,
  Coins,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useAppStore } from '../../stores/appStore';
import clsx from 'clsx';

export function AnalysisPanel() {
  const { theme } = useAppStore();
  const { analysis, isAnalyzing, content } = useEditorStore();

  if (!content) {
    return (
      <div className={clsx(
        'h-full flex flex-col items-center justify-center p-6 text-center',
        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
      )}>
        <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
        <p>Start typing to see real-time analysis</p>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className={clsx(
        'h-full flex flex-col items-center justify-center p-6',
        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
      )}>
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Analyzing prompt...</p>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        <ScoreCard
          label="Overall Score"
          score={analysis.overall_score}
          theme={theme}
        />

        <div className="grid grid-cols-3 gap-2">
          <MiniScoreCard label="Clarity" score={analysis.clarity_score} theme={theme} />
          <MiniScoreCard label="Specificity" score={analysis.specificity_score} theme={theme} />
          <MiniScoreCard label="Structure" score={analysis.structure_score} theme={theme} />
        </div>

        {analysis.warnings.length > 0 && (
          <WarningsSection warnings={analysis.warnings} theme={theme} />
        )}

        {analysis.suggestions.length > 0 && (
          <SuggestionsSection suggestions={analysis.suggestions} theme={theme} />
        )}

        <ComponentsSection components={analysis.components} theme={theme} />

        <TokenEstimateSection estimate={analysis.token_estimate} theme={theme} />
      </div>
    </div>
  );
}

function ScoreCard({ label, score, theme }: { label: string; score: number; theme: 'light' | 'dark' }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'emerald';
    if (s >= 60) return 'amber';
    return 'red';
  };

  const color = getScoreColor(score);

  return (
    <div className={clsx(
      'p-4 rounded-lg border',
      theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className={clsx('font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
          {label}
        </span>
        <span className={clsx(
          'text-2xl font-bold',
          color === 'emerald' && (theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'),
          color === 'amber' && (theme === 'dark' ? 'text-amber-400' : 'text-amber-600'),
          color === 'red' && (theme === 'dark' ? 'text-red-400' : 'text-red-600'),
        )}>
          {score}
        </span>
      </div>
      <div className={clsx(
        'h-2 rounded-full overflow-hidden',
        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
      )}>
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500',
            color === 'emerald' && 'bg-emerald-500',
            color === 'amber' && 'bg-amber-500',
            color === 'red' && 'bg-red-500',
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function MiniScoreCard({ label, score, theme }: { label: string; score: number; theme: 'light' | 'dark' }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600';
    if (s >= 60) return theme === 'dark' ? 'text-amber-400' : 'text-amber-600';
    return theme === 'dark' ? 'text-red-400' : 'text-red-600';
  };

  return (
    <div className={clsx(
      'p-3 rounded-lg text-center',
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      <div className={clsx('text-lg font-bold', getScoreColor(score))}>
        {score}
      </div>
      <div className={clsx('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
        {label}
      </div>
    </div>
  );
}

function WarningsSection({ warnings, theme }: { warnings: { type: string; message: string; severity: string }[]; theme: 'light' | 'dark' }) {
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return theme === 'dark' ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-red-50 border-red-200 text-red-700';
      case 'warning':
        return theme === 'dark' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700';
      default:
        return theme === 'dark' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'security':
        return Shield;
      case 'sensitive_data':
        return AlertTriangle;
      case 'cost':
        return Coins;
      default:
        return AlertTriangle;
    }
  };

  return (
    <div className="space-y-2">
      <h3 className={clsx(
        'flex items-center gap-2 font-medium text-sm',
        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
      )}>
        <AlertTriangle className="w-4 h-4" />
        Warnings ({warnings.length})
      </h3>
      {warnings.map((warning, index) => {
        const Icon = getIcon(warning.type);
        return (
          <div
            key={index}
            className={clsx('p-3 rounded-lg border text-sm', getSeverityStyles(warning.severity))}
          >
            <div className="flex items-start gap-2">
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{warning.message}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SuggestionsSection({ suggestions, theme }: { suggestions: { type: string; message: string; impact: string; suggestion?: string }[]; theme: 'light' | 'dark' }) {
  const getImpactStyles = (impact: string) => {
    switch (impact) {
      case 'high':
        return theme === 'dark' ? 'border-emerald-500/50' : 'border-emerald-300';
      case 'medium':
        return theme === 'dark' ? 'border-amber-500/50' : 'border-amber-300';
      default:
        return theme === 'dark' ? 'border-gray-700' : 'border-gray-200';
    }
  };

  return (
    <div className="space-y-2">
      <h3 className={clsx(
        'flex items-center gap-2 font-medium text-sm',
        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
      )}>
        <Lightbulb className="w-4 h-4" />
        Suggestions ({suggestions.length})
      </h3>
      {suggestions.map((suggestion, index) => (
        <div
          key={index}
          className={clsx(
            'p-3 rounded-lg border text-sm',
            theme === 'dark' ? 'bg-gray-900' : 'bg-white',
            getImpactStyles(suggestion.impact)
          )}
        >
          <div className="flex items-start gap-2">
            <ChevronRight className={clsx(
              'w-4 h-4 flex-shrink-0 mt-0.5',
              theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
            )} />
            <div>
              <p className={clsx(theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                {suggestion.message}
              </p>
              {suggestion.suggestion && (
                <p className={clsx(
                  'mt-1 text-xs',
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                )}>
                  {suggestion.suggestion}
                </p>
              )}
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <span className={clsx(
              'px-2 py-0.5 rounded text-xs font-medium',
              suggestion.impact === 'high' && (theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'),
              suggestion.impact === 'medium' && (theme === 'dark' ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'),
              suggestion.impact === 'low' && (theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'),
            )}>
              {suggestion.impact} impact
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ComponentsSection({ components, theme }: { components: { type: string; content: string }[]; theme: 'light' | 'dark' }) {
  const componentTypes = ['role', 'context', 'instruction', 'constraint', 'example', 'output_format'];

  const getComponentStatus = (type: string) => {
    return components.some((c) => c.type === type);
  };

  return (
    <div className="space-y-2">
      <h3 className={clsx(
        'font-medium text-sm',
        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
      )}>
        Detected Components
      </h3>
      <div className={clsx(
        'p-3 rounded-lg',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="grid grid-cols-2 gap-2">
          {componentTypes.map((type) => {
            const detected = getComponentStatus(type);
            return (
              <div
                key={type}
                className={clsx(
                  'flex items-center gap-2 text-sm',
                  detected
                    ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                    : theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                )}
              >
                {detected ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                <span className="capitalize">{type.replace('_', ' ')}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TokenEstimateSection({ estimate, theme }: { estimate: { gpt4: number; gpt35: number; claude: number; llama: number; estimated_cost: Record<string, number> }; theme: 'light' | 'dark' }) {
  return (
    <div className="space-y-2">
      <h3 className={clsx(
        'flex items-center gap-2 font-medium text-sm',
        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
      )}>
        <Coins className="w-4 h-4" />
        Token Estimates
      </h3>
      <div className={clsx(
        'p-3 rounded-lg space-y-2',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}>GPT-4</span>
            <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{estimate.gpt4}</span>
          </div>
          <div className="flex justify-between">
            <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}>GPT-3.5</span>
            <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{estimate.gpt35}</span>
          </div>
          <div className="flex justify-between">
            <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}>Claude</span>
            <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{estimate.claude}</span>
          </div>
          <div className="flex justify-between">
            <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}>Llama</span>
            <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{estimate.llama}</span>
          </div>
        </div>
        <div className={clsx(
          'pt-2 border-t text-xs',
          theme === 'dark' ? 'border-gray-800 text-gray-500' : 'border-gray-200 text-gray-500'
        )}>
          Est. cost (GPT-4 Turbo): ${estimate.estimated_cost['gpt-4-turbo']?.toFixed(4) || '0.0000'}
        </div>
      </div>
    </div>
  );
}
