import { useState, useMemo } from 'react';
import { Eye, Coins, ChevronDown, Palette } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useAppStore } from '../../stores/appStore';
import { tokenizeText } from '../../services/analysisService';
import { AI_MODELS } from '../../types';
import clsx from 'clsx';

const TOKEN_COLORS = [
  'bg-emerald-500/30',
  'bg-blue-500/30',
  'bg-amber-500/30',
  'bg-rose-500/30',
  'bg-purple-500/30',
  'bg-cyan-500/30',
  'bg-orange-500/30',
  'bg-teal-500/30',
];

export function TokenizerVisualization() {
  const { theme } = useAppStore();
  const { content, modelId } = useEditorStore();
  const [selectedModel, setSelectedModel] = useState(modelId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showColorLegend, setShowColorLegend] = useState(false);

  const visualization = useMemo(() => {
    if (!content) return null;
    return tokenizeText(content, selectedModel);
  }, [content, selectedModel]);

  const selectedModelInfo = AI_MODELS.find((m) => m.id === selectedModel);

  if (!content) {
    return (
      <div className={clsx(
        'p-4 rounded-lg border text-center',
        theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
      )}>
        <Eye className={clsx('w-8 h-8 mx-auto mb-2', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
        <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
          Type something to see tokenization
        </p>
      </div>
    );
  }

  return (
    <div className={clsx(
      'rounded-lg border overflow-hidden',
      theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={clsx(
          'w-full px-4 py-3 flex items-center justify-between transition-colors',
          theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
        )}
      >
        <div className="flex items-center gap-2">
          <Eye className={clsx('w-5 h-5', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
          <span className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Tokenizer Visualization
          </span>
        </div>
        <div className="flex items-center gap-3">
          {visualization && (
            <span className={clsx(
              'px-2 py-1 rounded text-sm font-mono',
              theme === 'dark' ? 'bg-gray-800 text-emerald-400' : 'bg-gray-100 text-emerald-600'
            )}>
              {visualization.total} tokens
            </span>
          )}
          <ChevronDown className={clsx(
            'w-5 h-5 transition-transform',
            isExpanded && 'rotate-180',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )} />
        </div>
      </button>

      {isExpanded && visualization && (
        <div className={clsx(
          'px-4 py-4 border-t',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <div className="flex items-center justify-between mb-4">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className={clsx(
                'px-3 py-1.5 rounded-lg border text-sm',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              {AI_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowColorLegend(!showColorLegend)}
              className={clsx(
                'flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors',
                theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Palette className="w-4 h-4" />
              Legend
            </button>
          </div>

          {showColorLegend && (
            <div className={clsx(
              'mb-4 p-3 rounded-lg text-sm',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
            )}>
              <p className={clsx('mb-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Each color represents a different token. Alternating colors help visualize token boundaries.
              </p>
              <div className="flex flex-wrap gap-2">
                {TOKEN_COLORS.slice(0, 4).map((color, i) => (
                  <span key={i} className={clsx('px-2 py-0.5 rounded', color)}>
                    Token {i + 1}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className={clsx(
            'p-4 rounded-lg font-mono text-sm leading-relaxed max-h-64 overflow-y-auto',
            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
          )}>
            {visualization.tokens.map((token, index) => (
              <span
                key={token.id}
                className={clsx(
                  'inline px-0.5 rounded',
                  TOKEN_COLORS[index % TOKEN_COLORS.length],
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                )}
                title={`Token ${index + 1}: "${token.text}"`}
              >
                {token.text}
              </span>
            ))}
          </div>

          <div className={clsx(
            'mt-4 grid grid-cols-2 gap-4 text-sm',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            <div className={clsx(
              'p-3 rounded-lg',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
            )}>
              <div className="flex items-center gap-2 mb-1">
                <Coins className="w-4 h-4" />
                <span>Estimated Cost</span>
              </div>
              <div className={clsx(
                'text-lg font-semibold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                ${((visualization.total / 1000) * (selectedModelInfo?.pricing.input || 0.01)).toFixed(4)}
              </div>
              <div className="text-xs mt-1">
                For input tokens at {selectedModelInfo?.name || 'selected model'} rates
              </div>
            </div>

            <div className={clsx(
              'p-3 rounded-lg',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
            )}>
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-4 h-4" />
                <span>Context Usage</span>
              </div>
              <div className={clsx(
                'text-lg font-semibold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {((visualization.total / (selectedModelInfo?.context_window || 8192)) * 100).toFixed(1)}%
              </div>
              <div className="text-xs mt-1">
                {visualization.total.toLocaleString()} / {(selectedModelInfo?.context_window || 8192).toLocaleString()} tokens
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className={clsx(
              'h-2 rounded-full overflow-hidden',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
            )}>
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                style={{
                  width: `${Math.min(100, (visualization.total / (selectedModelInfo?.context_window || 8192)) * 100)}%`
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
