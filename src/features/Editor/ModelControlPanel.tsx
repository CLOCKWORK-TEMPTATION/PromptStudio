import { useState } from 'react';
import {
  Settings2,
  ChevronDown,
  ChevronUp,
  Thermometer,
  Gauge,
  Hash,
  Ban,
  FileJson,
  Plus,
  X,
  Info,
  Save,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useEditorStore } from '../../stores/editorStore';
import { AI_MODELS, DEFAULT_MODEL_CONFIG } from '../../types';
import type { ModelConfig } from '../../types';
import clsx from 'clsx';

interface ModelControlPanelProps {
  expanded?: boolean;
}

export function ModelControlPanel({ expanded = false }: ModelControlPanelProps) {
  const { theme, currentModelConfig, updateCurrentModelConfig } = useAppStore();
  const { modelId, setModelId } = useEditorStore();
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [newStopSequence, setNewStopSequence] = useState('');
  const [showPresets, setShowPresets] = useState(false);

  const selectedModel = AI_MODELS.find((m) => m.id === modelId) || AI_MODELS[0];

  const presets = [
    { name: 'Creative', config: { temperature: 1.2, top_p: 0.95, frequency_penalty: 0.5, presence_penalty: 0.5 } },
    { name: 'Balanced', config: { temperature: 0.7, top_p: 1.0, frequency_penalty: 0, presence_penalty: 0 } },
    { name: 'Precise', config: { temperature: 0.2, top_p: 0.9, frequency_penalty: 0, presence_penalty: 0 } },
    { name: 'Deterministic', config: { temperature: 0, top_p: 1.0, frequency_penalty: 0, presence_penalty: 0 } },
  ];

  const handleAddStopSequence = () => {
    if (newStopSequence && !currentModelConfig.stop_sequences.includes(newStopSequence)) {
      updateCurrentModelConfig({
        stop_sequences: [...currentModelConfig.stop_sequences, newStopSequence],
      });
      setNewStopSequence('');
    }
  };

  const handleRemoveStopSequence = (seq: string) => {
    updateCurrentModelConfig({
      stop_sequences: currentModelConfig.stop_sequences.filter((s) => s !== seq),
    });
  };

  const applyPreset = (preset: { config: Partial<ModelConfig> }) => {
    updateCurrentModelConfig(preset.config);
    setShowPresets(false);
  };

  return (
    <div className={clsx(
      'border rounded-lg overflow-hidden',
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
          <Settings2 className={clsx('w-5 h-5', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')} />
          <span className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Model Configuration
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className={clsx('w-5 h-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
        ) : (
          <ChevronDown className={clsx('w-5 h-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
        )}
      </button>

      {isExpanded && (
        <div className={clsx(
          'px-4 py-4 border-t space-y-4',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Model
            </label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              {AI_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.provider})
                </option>
              ))}
            </select>
            <div className={clsx(
              'mt-2 flex gap-4 text-xs',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
            )}>
              <span>Context: {selectedModel.context_window.toLocaleString()} tokens</span>
              <span>Functions: {selectedModel.supports_functions ? 'Yes' : 'No'}</span>
              <span>JSON Mode: {selectedModel.supports_json_mode ? 'Yes' : 'No'}</span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className={clsx('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              Quick Presets
            </span>
            <div className="relative">
              <button
                onClick={() => setShowPresets(!showPresets)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                Select Preset
              </button>
              {showPresets && (
                <div className={clsx(
                  'absolute top-full right-0 mt-2 w-40 rounded-lg shadow-lg border z-10',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  {presets.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className={clsx(
                        'w-full px-3 py-2 text-left text-sm transition-colors',
                        theme === 'dark'
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <SliderControl
            label="Temperature"
            value={currentModelConfig.temperature}
            onChange={(v) => updateCurrentModelConfig({ temperature: v })}
            min={0}
            max={2}
            step={0.1}
            icon={Thermometer}
            tooltip="Controls randomness. Lower = more focused, Higher = more creative"
            theme={theme}
          />

          <SliderControl
            label="Top P"
            value={currentModelConfig.top_p}
            onChange={(v) => updateCurrentModelConfig({ top_p: v })}
            min={0}
            max={1}
            step={0.05}
            icon={Gauge}
            tooltip="Nucleus sampling. Lower = fewer token choices"
            theme={theme}
          />

          <SliderControl
            label="Top K"
            value={currentModelConfig.top_k}
            onChange={(v) => updateCurrentModelConfig({ top_k: v })}
            min={1}
            max={100}
            step={1}
            icon={Hash}
            tooltip="Limits vocabulary. Only top K tokens considered"
            theme={theme}
          />

          <SliderControl
            label="Frequency Penalty"
            value={currentModelConfig.frequency_penalty}
            onChange={(v) => updateCurrentModelConfig({ frequency_penalty: v })}
            min={-2}
            max={2}
            step={0.1}
            icon={Ban}
            tooltip="Reduces repetition based on frequency"
            theme={theme}
          />

          <SliderControl
            label="Presence Penalty"
            value={currentModelConfig.presence_penalty}
            onChange={(v) => updateCurrentModelConfig({ presence_penalty: v })}
            min={-2}
            max={2}
            step={0.1}
            icon={Ban}
            tooltip="Reduces repetition based on presence"
            theme={theme}
          />

          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Max Tokens
            </label>
            <input
              type="number"
              value={currentModelConfig.max_tokens}
              onChange={(e) => updateCurrentModelConfig({ max_tokens: parseInt(e.target.value) || 2048 })}
              min={1}
              max={selectedModel.context_window}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            />
          </div>

          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Response Format
            </label>
            <select
              value={currentModelConfig.response_format}
              onChange={(e) => updateCurrentModelConfig({ response_format: e.target.value as ModelConfig['response_format'] })}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              <option value="text">Text</option>
              <option value="json_object">JSON Object</option>
              <option value="json_schema">JSON Schema</option>
            </select>
          </div>

          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Stop Sequences
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newStopSequence}
                onChange={(e) => setNewStopSequence(e.target.value)}
                placeholder="Add stop sequence..."
                className={clsx(
                  'flex-1 px-3 py-2 rounded-lg border transition-colors text-sm',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                )}
                onKeyDown={(e) => e.key === 'Enter' && handleAddStopSequence()}
              />
              <button
                onClick={handleAddStopSequence}
                disabled={!newStopSequence}
                className={clsx(
                  'px-3 py-2 rounded-lg transition-colors',
                  theme === 'dark'
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50'
                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50'
                )}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {currentModelConfig.stop_sequences.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentModelConfig.stop_sequences.map((seq, index) => (
                  <span
                    key={index}
                    className={clsx(
                      'inline-flex items-center gap-1 px-2 py-1 rounded text-sm',
                      theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                    )}
                  >
                    <code>{JSON.stringify(seq)}</code>
                    <button
                      onClick={() => handleRemoveStopSequence(seq)}
                      className="hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => updateCurrentModelConfig(DEFAULT_MODEL_CONFIG)}
            className={clsx(
              'w-full py-2 rounded-lg text-sm font-medium transition-colors',
              theme === 'dark'
                ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                : 'bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            )}
          >
            Reset to Defaults
          </button>
        </div>
      )}
    </div>
  );
}

interface SliderControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
  theme: 'light' | 'dark';
}

function SliderControl({
  label,
  value,
  onChange,
  min,
  max,
  step,
  icon: Icon,
  tooltip,
  theme,
}: SliderControlProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={clsx('w-4 h-4', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
          <span className={clsx('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
            {label}
          </span>
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className={clsx('p-0.5', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            {showTooltip && (
              <div className={clsx(
                'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap z-10',
                theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-white'
              )}>
                {tooltip}
              </div>
            )}
          </div>
        </div>
        <span className={clsx(
          'text-sm font-mono',
          theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
        )}>
          {value.toFixed(step < 1 ? 2 : 0)}
        </span>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        className={clsx(
          'w-full h-2 rounded-lg appearance-none cursor-pointer',
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full',
          theme === 'dark'
            ? '[&::-webkit-slider-thumb]:bg-emerald-400'
            : '[&::-webkit-slider-thumb]:bg-emerald-500'
        )}
      />
    </div>
  );
}
