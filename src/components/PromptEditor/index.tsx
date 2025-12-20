'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PenTool,
  Settings,
  Play,
  Save,
  Plus,
  Trash2,
  ChevronDown,
  Thermometer,
  Hash,
  Type,
  ToggleLeft,
  List,
  Braces,
  Info,
  Loader2,
  Gauge,
  DollarSign,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
} from 'lucide-react';
import { usePromptStudioStore } from '@/store';
import { PromptVariable } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const MODELS = [
  { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', provider: 'OpenAI' },
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic' },
];

const VARIABLE_TYPES: Array<{ type: PromptVariable['type']; icon: React.ReactNode; label: string }> = [
  { type: 'string', icon: <Type className="w-4 h-4" />, label: 'String' },
  { type: 'number', icon: <Hash className="w-4 h-4" />, label: 'Number' },
  { type: 'boolean', icon: <ToggleLeft className="w-4 h-4" />, label: 'Boolean' },
  { type: 'array', icon: <List className="w-4 h-4" />, label: 'Array' },
  { type: 'object', icon: <Braces className="w-4 h-4" />, label: 'Object' },
];

// Pre-Send Analysis Types
interface QuickAnalysis {
  tokens: number;
  cost: number;
  successProbability: number;
  contextUsagePercent: number;
  recommendations: string[];
  readyToSend: boolean;
}

// Quick local analysis function
function performQuickAnalysis(prompt: string, model: string): QuickAnalysis {
  const MODEL_PRICING: Record<string, { input: number; output: number; contextWindow: number }> = {
    'gpt-4-turbo-preview': { input: 0.01, output: 0.03, contextWindow: 128000 },
    'gpt-4': { input: 0.03, output: 0.06, contextWindow: 8192 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002, contextWindow: 16385 },
    'claude-3-opus': { input: 0.015, output: 0.075, contextWindow: 200000 },
    'claude-3-sonnet': { input: 0.003, output: 0.015, contextWindow: 200000 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125, contextWindow: 200000 },
  };

  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4'];
  const inputTokens = Math.ceil(prompt.length / 4);
  const outputTokens = Math.ceil(inputTokens * 0.8);
  const totalTokens = inputTokens + outputTokens;
  const contextUsagePercent = (totalTokens / pricing.contextWindow) * 100;
  const cost = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;

  // Calculate success probability
  let successProbability = 0.5;
  if (prompt.length > 100) successProbability += 0.1;
  if (prompt.includes('#') || prompt.includes('##')) successProbability += 0.1;
  if (/example|مثال|e\.g\./i.test(prompt)) successProbability += 0.1;
  if (/output|format|return|المخرج/i.test(prompt)) successProbability += 0.1;
  if (/must|should|always|يجب|دائماً/i.test(prompt)) successProbability += 0.05;
  successProbability = Math.min(successProbability, 0.95);

  // Generate recommendations
  const recommendations: string[] = [];
  if (!prompt.includes('#') && prompt.length > 200) {
    recommendations.push('أضف عناوين لتنظيم البرومبت');
  }
  if (!/example|مثال/i.test(prompt)) {
    recommendations.push('أضف أمثلة توضيحية');
  }
  if (!/output|format|المخرج/i.test(prompt)) {
    recommendations.push('حدد تنسيق المخرجات');
  }
  if (contextUsagePercent > 70) {
    recommendations.push('قلل حجم البرومبت لتحسين الأداء');
  }

  return {
    tokens: totalTokens,
    cost,
    successProbability,
    contextUsagePercent,
    recommendations,
    readyToSend: successProbability >= 0.6 && contextUsagePercent < 90,
  };
}

export function PromptEditor() {
  const { currentPrompt, updatePrompt } = usePromptStudioStore();
  const [showSettings, setShowSettings] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showPreSendAnalysis, setShowPreSendAnalysis] = useState(true);
  const [quickAnalysis, setQuickAnalysis] = useState<QuickAnalysis | null>(null);

  // Auto-analyze prompt on change
  useEffect(() => {
    if (currentPrompt?.prompt) {
      const timer = setTimeout(() => {
        const analysis = performQuickAnalysis(currentPrompt.prompt, currentPrompt.model);
        setQuickAnalysis(analysis);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setQuickAnalysis(null);
    }
  }, [currentPrompt?.prompt, currentPrompt?.model]);

  if (!currentPrompt) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-dark-400">
          <PenTool className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No prompt selected</p>
          <p className="text-sm mt-2">Create a new prompt to get started</p>
        </div>
      </div>
    );
  }

  const handleAddVariable = () => {
    const newVariable: PromptVariable = {
      name: `variable_${currentPrompt.variables.length + 1}`,
      type: 'string',
      description: '',
      required: true,
    };
    updatePrompt({ variables: [...currentPrompt.variables, newVariable] });
  };

  const handleUpdateVariable = (index: number, updates: Partial<PromptVariable>) => {
    const newVariables = [...currentPrompt.variables];
    newVariables[index] = { ...newVariables[index], ...updates };
    updatePrompt({ variables: newVariables });
  };

  const handleDeleteVariable = (index: number) => {
    const newVariables = currentPrompt.variables.filter((_, i) => i !== index);
    updatePrompt({ variables: newVariables });
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    // Simulate API call
    setTimeout(() => {
      setTestResult(
        'This is a simulated response from the AI model. In a production environment, this would connect to your configured API endpoint and return the actual model response based on your prompt template and variables.'
      );
      setIsTesting(false);
    }, 1500);
  };

  return (
    <div className="h-full flex flex-col bg-dark-900">
      {/* Header */}
      <div className="border-b border-dark-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/10 rounded-lg">
              <PenTool className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <input
                type="text"
                value={currentPrompt.name}
                onChange={(e) => updatePrompt({ name: e.target.value })}
                className="text-lg font-semibold text-white bg-transparent border-none focus:outline-none focus:ring-0"
                placeholder="Prompt name"
              />
              <input
                type="text"
                value={currentPrompt.description}
                onChange={(e) => updatePrompt({ description: e.target.value })}
                className="block text-sm text-dark-400 bg-transparent border-none focus:outline-none focus:ring-0 w-full"
                placeholder="Add a description..."
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${
                showSettings
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
              }`}
            >
              <Settings className="w-5 h-5" />
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-dark-200 transition-colors">
              <Save className="w-4 h-4" />
              <span className="text-sm">Save</span>
            </button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-dark-700 bg-dark-800/50 animate-fade-in">
          <h3 className="text-sm font-medium text-dark-200 mb-4">Model Settings</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Model Selection */}
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">Model</label>
              <select
                value={currentPrompt.model}
                onChange={(e) => updatePrompt({ model: e.target.value })}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
              >
                {MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.provider})
                  </option>
                ))}
              </select>
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">
                Temperature: {currentPrompt.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={currentPrompt.temperature}
                onChange={(e) => updatePrompt({ temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Max Tokens */}
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">Max Tokens</label>
              <input
                type="number"
                value={currentPrompt.maxTokens}
                onChange={(e) => updatePrompt({ maxTokens: parseInt(e.target.value) || 1024 })}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
                min={1}
                max={128000}
              />
            </div>

            {/* Top P */}
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">Top P: {currentPrompt.topP}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={currentPrompt.topP}
                onChange={(e) => updatePrompt({ topP: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Prompt Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-dark-700">
            <h3 className="text-sm font-medium text-dark-300 mb-1">Prompt Template</h3>
            <p className="text-xs text-dark-500">
              Use {'{{variableName}}'} syntax for dynamic values
            </p>
          </div>
          <div className="flex-1 p-4 overflow-hidden">
            <textarea
              value={currentPrompt.prompt}
              onChange={(e) => updatePrompt({ prompt: e.target.value })}
              className="w-full h-full p-4 bg-dark-950 border border-dark-700 rounded-lg text-sm text-dark-100 font-mono resize-none focus:border-primary-500 focus:outline-none"
              placeholder="Enter your prompt template here...

Example:
You are a helpful assistant that specializes in {{topic}}.

The user wants to know: {{question}}

Please provide a detailed and informative response."
            />
          </div>

          {/* Pre-Send Analysis Section */}
          {quickAnalysis && showPreSendAnalysis && (
            <div className="p-4 border-t border-dark-700 bg-dark-800/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary-400" />
                  <h3 className="text-sm font-medium text-dark-300">تحليل ما قبل الإرسال</h3>
                </div>
                <button
                  onClick={() => setShowPreSendAnalysis(false)}
                  className="text-dark-500 hover:text-dark-300 text-xs"
                >
                  إخفاء
                </button>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="text-center p-2 bg-dark-900 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-dark-500 mb-1">
                    <Gauge className="w-3 h-3" />
                  </div>
                  <div className="text-sm font-bold text-white">
                    {quickAnalysis.tokens.toLocaleString()}
                  </div>
                  <div className="text-xs text-dark-500">توكن</div>
                </div>

                <div className="text-center p-2 bg-dark-900 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-dark-500 mb-1">
                    <DollarSign className="w-3 h-3" />
                  </div>
                  <div className="text-sm font-bold text-white">
                    ${quickAnalysis.cost.toFixed(4)}
                  </div>
                  <div className="text-xs text-dark-500">تكلفة</div>
                </div>

                <div className="text-center p-2 bg-dark-900 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-dark-500 mb-1">
                    <Clock className="w-3 h-3" />
                  </div>
                  <div className="text-sm font-bold text-white">
                    {quickAnalysis.contextUsagePercent.toFixed(1)}%
                  </div>
                  <div className="text-xs text-dark-500">سياق</div>
                </div>

                <div className="text-center p-2 bg-dark-900 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-dark-500 mb-1">
                    <Target className="w-3 h-3" />
                  </div>
                  <div className={`text-sm font-bold ${
                    quickAnalysis.successProbability >= 0.7 ? 'text-green-400' :
                    quickAnalysis.successProbability >= 0.5 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {(quickAnalysis.successProbability * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-dark-500">نجاح</div>
                </div>
              </div>

              {/* Status & Recommendations */}
              <div className="flex items-center gap-2 mb-2">
                {quickAnalysis.readyToSend ? (
                  <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">
                    <CheckCircle2 className="w-3 h-3" />
                    جاهز للإرسال
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">
                    <AlertTriangle className="w-3 h-3" />
                    يحتاج تحسين
                  </span>
                )}
              </div>

              {quickAnalysis.recommendations.length > 0 && (
                <div className="space-y-1">
                  {quickAnalysis.recommendations.slice(0, 2).map((rec, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-dark-400">
                      <Lightbulb className="w-3 h-3 text-yellow-500" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!showPreSendAnalysis && (
            <button
              onClick={() => setShowPreSendAnalysis(true)}
              className="w-full p-2 text-xs text-dark-500 hover:text-dark-300 border-t border-dark-700 flex items-center justify-center gap-1"
            >
              <Gauge className="w-3 h-3" />
              عرض تحليل ما قبل الإرسال
            </button>
          )}

          {/* Test Section */}
          <div className="p-4 border-t border-dark-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-dark-300">Test Response</h3>
              <button
                onClick={handleTest}
                disabled={isTesting}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Test
                  </>
                )}
              </button>
            </div>
            {testResult && (
              <div className="p-4 bg-dark-950 rounded-lg border border-dark-700 animate-fade-in">
                <p className="text-sm text-dark-200">{testResult}</p>
              </div>
            )}
          </div>
        </div>

        {/* Variables Panel */}
        <div className="w-80 border-l border-dark-700 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-dark-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-dark-300">Variables</h3>
            <button
              onClick={handleAddVariable}
              className="p-1.5 hover:bg-dark-700 rounded-lg text-dark-400 hover:text-primary-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {currentPrompt.variables.length === 0 ? (
              <div className="text-center py-8">
                <Braces className="w-10 h-10 mx-auto mb-3 text-dark-600" />
                <p className="text-sm text-dark-400">No variables defined</p>
                <p className="text-xs text-dark-500 mt-1">
                  Click + to add a variable
                </p>
              </div>
            ) : (
              currentPrompt.variables.map((variable, index) => (
                <div
                  key={index}
                  className="p-3 bg-dark-800 rounded-lg border border-dark-700"
                >
                  <div className="flex items-start justify-between mb-3">
                    <input
                      type="text"
                      value={variable.name}
                      onChange={(e) =>
                        handleUpdateVariable(index, { name: e.target.value })
                      }
                      className="text-sm font-medium text-white bg-transparent border-none focus:outline-none"
                      placeholder="variable_name"
                    />
                    <button
                      onClick={() => handleDeleteVariable(index)}
                      className="p-1 hover:bg-dark-700 rounded text-dark-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <select
                      value={variable.type}
                      onChange={(e) =>
                        handleUpdateVariable(index, {
                          type: e.target.value as PromptVariable['type'],
                        })
                      }
                      className="w-full px-2 py-1.5 bg-dark-900 border border-dark-600 rounded text-xs text-white focus:border-primary-500 focus:outline-none"
                    >
                      {VARIABLE_TYPES.map((vt) => (
                        <option key={vt.type} value={vt.type}>
                          {vt.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={variable.description}
                      onChange={(e) =>
                        handleUpdateVariable(index, { description: e.target.value })
                      }
                      className="w-full px-2 py-1.5 bg-dark-900 border border-dark-600 rounded text-xs text-dark-300 focus:border-primary-500 focus:outline-none"
                      placeholder="Description..."
                    />

                    <label className="flex items-center gap-2 text-xs text-dark-400">
                      <input
                        type="checkbox"
                        checked={variable.required}
                        onChange={(e) =>
                          handleUpdateVariable(index, { required: e.target.checked })
                        }
                        className="rounded border-dark-600 bg-dark-900 text-primary-500 focus:ring-primary-500"
                      />
                      Required
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Variable Info */}
          <div className="p-4 border-t border-dark-700 bg-dark-800/50">
            <div className="flex items-start gap-2 text-xs text-dark-400">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                Variables are automatically extracted from your prompt template using the{' '}
                <code className="px-1 bg-dark-700 rounded text-primary-400">
                  {'{{name}}'}
                </code>{' '}
                syntax.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
