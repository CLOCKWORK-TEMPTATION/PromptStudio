import { useState, useRef, useEffect } from 'react';
import { Variable, Plus, Trash2, FileText, History, Clock, User, Settings, ChevronDown } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useAppStore } from '../../stores/appStore';
import type { SmartVariable } from '../../types';
import clsx from 'clsx';

const SYSTEM_VARIABLES: Omit<SmartVariable, 'id' | 'session_id' | 'created_at'>[] = [
  { name: 'timestamp', variable_type: 'timestamp', default_value: '', description: 'Current timestamp', is_system: true },
  { name: 'date', variable_type: 'timestamp', default_value: '', description: 'Current date (YYYY-MM-DD)', is_system: true },
  { name: 'time', variable_type: 'timestamp', default_value: '', description: 'Current time (HH:MM:SS)', is_system: true },
  { name: 'history:last', variable_type: 'history', default_value: '', description: 'Last used prompt', is_system: true },
  { name: 'history:count', variable_type: 'history', default_value: '', description: 'Number of saved prompts', is_system: true },
  { name: 'user:name', variable_type: 'env', default_value: 'Anonymous', description: 'Current user name', is_system: true },
  { name: 'model:name', variable_type: 'env', default_value: '', description: 'Selected model name', is_system: true },
  { name: 'model:tokens', variable_type: 'env', default_value: '', description: 'Max tokens for model', is_system: true },
];

export function SmartVariables() {
  const { theme } = useAppStore();
  const { smartVariables, setSmartVariables, content, setContent, showVariableSuggestions, variableSuggestionPosition, setShowVariableSuggestions } = useEditorStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [filterQuery, setFilterQuery] = useState('');

  const suggestionsRef = useRef<HTMLDivElement>(null);

  const allVariables = [
    ...SYSTEM_VARIABLES.map((v) => ({ ...v, id: v.name, session_id: '', created_at: '' })),
    ...smartVariables,
  ];

  const filteredVariables = allVariables.filter((v) =>
    v.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    v.description.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const handleAddVariable = () => {
    if (!newVarName.trim()) return;
    const newVar: SmartVariable = {
      id: crypto.randomUUID(),
      session_id: '',
      name: newVarName.replace(/\s+/g, '_').toLowerCase(),
      variable_type: 'custom',
      default_value: newVarValue,
      description: '',
      is_system: false,
      created_at: new Date().toISOString(),
    };
    setSmartVariables([...smartVariables, newVar]);
    setNewVarName('');
    setNewVarValue('');
  };

  const handleRemoveVariable = (id: string) => {
    setSmartVariables(smartVariables.filter((v) => v.id !== id));
  };

  const insertVariable = (name: string) => {
    const variable = `{{${name}}}`;
    setContent(content + variable);
    setShowVariableSuggestions(false);
  };

  const getVariableIcon = (type: string) => {
    switch (type) {
      case 'file': return FileText;
      case 'history': return History;
      case 'timestamp': return Clock;
      case 'env': return Settings;
      default: return Variable;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowVariableSuggestions(false);
      }
    };

    if (showVariableSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVariableSuggestions, setShowVariableSuggestions]);

  return (
    <>
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
            <Variable className={clsx('w-5 h-5', theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600')} />
            <span className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Smart Variables
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={clsx(
              'px-2 py-1 rounded text-sm',
              theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
            )}>
              {allVariables.length} available
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
            <input
              type="text"
              placeholder="Search variables..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              )}
            />

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredVariables.map((variable) => {
                const Icon = getVariableIcon(variable.variable_type);
                return (
                  <div
                    key={variable.id}
                    className={clsx(
                      'flex items-center justify-between px-3 py-2 rounded-lg group',
                      theme === 'dark' ? 'bg-gray-800/50 hover:bg-gray-800' : 'bg-gray-50 hover:bg-gray-100'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={clsx('w-4 h-4 flex-shrink-0', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <code className={clsx(
                            'text-sm font-mono',
                            theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                          )}>
                            @{variable.name}
                          </code>
                          {variable.is_system && (
                            <span className={clsx(
                              'px-1.5 py-0.5 rounded text-xs',
                              theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                            )}>
                              system
                            </span>
                          )}
                        </div>
                        {variable.description && (
                          <p className={clsx(
                            'text-xs truncate',
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                          )}>
                            {variable.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => insertVariable(variable.name)}
                        className={clsx(
                          'px-2 py-1 rounded text-xs font-medium transition-colors',
                          theme === 'dark'
                            ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                            : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
                        )}
                      >
                        Insert
                      </button>
                      {!variable.is_system && (
                        <button
                          onClick={() => handleRemoveVariable(variable.id)}
                          className={clsx(
                            'p-1 rounded transition-colors',
                            theme === 'dark'
                              ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/20'
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          )}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={clsx(
              'pt-3 border-t',
              theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
            )}>
              <p className={clsx(
                'text-sm font-medium mb-2',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Add Custom Variable
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  className={clsx(
                    'flex-1 px-3 py-2 rounded-lg border text-sm',
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  )}
                />
                <input
                  type="text"
                  placeholder="Default value"
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  className={clsx(
                    'flex-1 px-3 py-2 rounded-lg border text-sm',
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  )}
                />
                <button
                  onClick={handleAddVariable}
                  disabled={!newVarName.trim()}
                  className={clsx(
                    'px-3 py-2 rounded-lg transition-colors',
                    theme === 'dark'
                      ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50'
                      : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 disabled:opacity-50'
                  )}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className={clsx(
              'text-xs',
              theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
            )}>
              <p className="mb-1">Usage:</p>
              <code className={theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}>
                {'{{variable_name}}'} or @variable_name
              </code>
            </div>
          </div>
        )}
      </div>

      {showVariableSuggestions && variableSuggestionPosition && (
        <div
          ref={suggestionsRef}
          className={clsx(
            'fixed z-50 w-64 max-h-48 overflow-y-auto rounded-lg shadow-xl border',
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}
          style={{
            left: variableSuggestionPosition.x,
            top: variableSuggestionPosition.y,
          }}
        >
          {allVariables.slice(0, 8).map((variable) => {
            const Icon = getVariableIcon(variable.variable_type);
            return (
              <button
                key={variable.id}
                onClick={() => insertVariable(variable.name)}
                className={clsx(
                  'w-full px-3 py-2 flex items-center gap-2 text-left transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                )}
              >
                <Icon className={clsx('w-4 h-4', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                <div>
                  <code className={clsx(
                    'text-sm font-mono',
                    theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                  )}>
                    @{variable.name}
                  </code>
                  {variable.description && (
                    <p className={clsx(
                      'text-xs',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>
                      {variable.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
