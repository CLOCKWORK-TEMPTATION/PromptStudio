import { useState } from 'react';
import {
  Wrench,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Play,
  Code,
  Copy,
  Check,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useAppStore } from '../../stores/appStore';
import type { ToolDefinition, JSONSchema } from '../../types';
import clsx from 'clsx';

export function ToolDefinitionPanel() {
  const { theme } = useAppStore();
  const { toolDefinitions, addToolDefinition, updateToolDefinition, removeToolDefinition } = useEditorStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingTool, setEditingTool] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleAddTool = () => {
    const newTool: ToolDefinition = {
      id: crypto.randomUUID(),
      session_id: '',
      prompt_id: '',
      name: 'new_function',
      description: 'Description of what this function does',
      parameters: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: 'First parameter',
          },
        },
        required: ['param1'],
      },
      returns: {
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
      },
      mock_response: { result: 'Mock response' },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    addToolDefinition(newTool);
    setEditingTool(newTool.id);
  };

  const handleSimulate = (tool: ToolDefinition) => {
    setSimulationResult(JSON.stringify(tool.mock_response, null, 2));
  };

  const copyToClipboard = (tool: ToolDefinition) => {
    const openAIFormat = {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    };
    navigator.clipboard.writeText(JSON.stringify(openAIFormat, null, 2));
    setCopiedId(tool.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
          <Wrench className={clsx('w-5 h-5', theme === 'dark' ? 'text-orange-400' : 'text-orange-600')} />
          <span className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Function Calling / Tools
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={clsx(
            'px-2 py-1 rounded text-sm',
            theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
          )}>
            {toolDefinitions.length} tool{toolDefinitions.length !== 1 && 's'}
          </span>
          <ChevronDown className={clsx(
            'w-5 h-5 transition-transform',
            isExpanded && 'rotate-180',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )} />
        </div>
      </button>

      {isExpanded && (
        <div className={clsx(
          'px-4 py-4 border-t space-y-4',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <button
            onClick={handleAddTool}
            className={clsx(
              'w-full py-2 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 transition-colors',
              theme === 'dark'
                ? 'border-gray-700 text-gray-400 hover:border-orange-500/50 hover:text-orange-400'
                : 'border-gray-300 text-gray-500 hover:border-orange-400 hover:text-orange-600'
            )}
          >
            <Plus className="w-4 h-4" />
            Add Tool Definition
          </button>

          {toolDefinitions.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              isEditing={editingTool === tool.id}
              onEdit={() => setEditingTool(editingTool === tool.id ? null : tool.id)}
              onUpdate={(updates) => updateToolDefinition(tool.id, updates)}
              onRemove={() => removeToolDefinition(tool.id)}
              onSimulate={() => handleSimulate(tool)}
              onCopy={() => copyToClipboard(tool)}
              copied={copiedId === tool.id}
              theme={theme}
            />
          ))}

          {simulationResult && (
            <div className={clsx(
              'p-4 rounded-lg',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className={clsx(
                  'text-sm font-medium',
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  Simulation Result
                </span>
                <button
                  onClick={() => setSimulationResult(null)}
                  className={clsx('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}
                >
                  Clear
                </button>
              </div>
              <pre className={clsx(
                'text-sm font-mono overflow-x-auto',
                theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
              )}>
                {simulationResult}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ToolCardProps {
  tool: ToolDefinition;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (updates: Partial<ToolDefinition>) => void;
  onRemove: () => void;
  onSimulate: () => void;
  onCopy: () => void;
  copied: boolean;
  theme: 'light' | 'dark';
}

function ToolCard({
  tool,
  isEditing,
  onEdit,
  onUpdate,
  onRemove,
  onSimulate,
  onCopy,
  copied,
  theme,
}: ToolCardProps) {
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleParametersChange = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      onUpdate({ parameters: parsed });
      setJsonError(null);
    } catch {
      setJsonError('Invalid JSON');
    }
  };

  const handleMockResponseChange = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      onUpdate({ mock_response: parsed });
      setJsonError(null);
    } catch {
      setJsonError('Invalid JSON');
    }
  };

  return (
    <div className={clsx(
      'rounded-lg border overflow-hidden',
      theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
    )}>
      <div
        className={clsx(
          'px-4 py-3 flex items-center justify-between cursor-pointer',
          theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
        )}
        onClick={onEdit}
      >
        <div className="flex items-center gap-2">
          {isEditing ? (
            <ChevronDown className={clsx('w-4 h-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
          ) : (
            <ChevronRight className={clsx('w-4 h-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
          )}
          <Code className={clsx('w-4 h-4', theme === 'dark' ? 'text-orange-400' : 'text-orange-600')} />
          <span className={clsx('font-mono text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {tool.name}()
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onSimulate(); }}
            className={clsx(
              'p-1.5 rounded transition-colors',
              theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
            )}
            title="Simulate"
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            className={clsx(
              'p-1.5 rounded transition-colors',
              theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
            )}
            title="Copy as OpenAI format"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className={clsx(
              'p-1.5 rounded transition-colors',
              theme === 'dark' ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-500 hover:text-red-600'
            )}
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isEditing && (
        <div className={clsx(
          'px-4 py-4 space-y-4 border-t',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-1',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Function Name
            </label>
            <input
              type="text"
              value={tool.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border font-mono text-sm',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            />
          </div>

          <div>
            <label className={clsx(
              'block text-sm font-medium mb-1',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Description
            </label>
            <textarea
              value={tool.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              rows={2}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm resize-none',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            />
          </div>

          <div>
            <label className={clsx(
              'block text-sm font-medium mb-1',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Parameters (JSON Schema)
            </label>
            <textarea
              value={JSON.stringify(tool.parameters, null, 2)}
              onChange={(e) => handleParametersChange(e.target.value)}
              rows={6}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border font-mono text-sm resize-none',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            />
          </div>

          <div>
            <label className={clsx(
              'block text-sm font-medium mb-1',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Mock Response (for simulation)
            </label>
            <textarea
              value={JSON.stringify(tool.mock_response, null, 2)}
              onChange={(e) => handleMockResponseChange(e.target.value)}
              rows={4}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border font-mono text-sm resize-none',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            />
          </div>

          {jsonError && (
            <p className="text-sm text-red-500">{jsonError}</p>
          )}
        </div>
      )}
    </div>
  );
}
