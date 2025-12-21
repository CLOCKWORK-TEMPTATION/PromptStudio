'use client';

import React, { useState, useEffect } from 'react';
import {
  PenTool,
  Settings,
  Play,
  Save,
  Plus,
  Trash2,
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
  Wand2,
} from 'lucide-react';
import { usePromptStudioStore } from '@/store';
import { PromptVariable } from '@/types';
import { useTranslation } from '@/i18n/LanguageContext';

const MODELS = [
  { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI' },
  { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI' },
  { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', provider: 'OpenAI' },
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic' },
  { id: 'models/gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', provider: 'Google' },
];

const getVariableTypes = (t: any): Array<{ type: PromptVariable['type']; icon: React.ReactNode; label: string }> => [
  { type: 'string', icon: <Type className="w-4 h-4" />, label: t('editor.variableType') || 'String' },
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
  const { t, dir } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showPreSendAnalysis, setShowPreSendAnalysis] = useState(true);
  const [quickAnalysis, setQuickAnalysis] = useState<QuickAnalysis | null>(null);
  const VARIABLE_TYPES = getVariableTypes(t);

  // System Prompt Generation State
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generationTask, setGenerationTask] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateSystemPrompt = async () => {
    if (!generationTask.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/prompts/generate-system-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: generationTask,
          provider: 'openai'
        }),
      });

      if (!response.ok) throw new Error('Generation failed');

      const data = await response.json();

      // Update prompt content with generated system prompt
      updatePrompt({
        prompt: data.systemPrompt,
        description: generationTask // Optionally update description too
      });

      setShowGenerateDialog(false);
      setGenerationTask('');
    } catch (error) {
      console.error('Failed to generate prompt:', error);
      // Ideally show a toast notification here
    } finally {
      setIsGenerating(false);
    }
  };

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
      <div className="flex items-center justify-center h-full" dir={dir}>
        <div className="text-center text-dark-400">
          <PenTool className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">{t('editor.title')}</p>
          <p className="text-sm mt-2">{t('common.select')}</p>
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
    const newVariables = currentPrompt.variables.filter((_: PromptVariable, i: number) => i !== index);
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
    <div className="h-full flex flex-col bg-dark-900" dir={dir}>
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePrompt({ name: e.target.value })}
                className="text-lg font-semibold text-white bg-transparent border-none focus:outline-none focus:ring-0"
                placeholder={t('editor.title')}
              />
              <input
                type="text"
                value={currentPrompt.description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePrompt({ description: e.target.value })}
                className="block text-sm text-dark-400 bg-transparent border-none focus:outline-none focus:ring-0 w-full"
                placeholder={t('common.add')}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings
                ? 'bg-primary-500/20 text-primary-400'
                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                }`}
            >
              <Settings className="w-5 h-5" />
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-dark-200 transition-colors">
              <Save className="w-4 h-4" />
              <span className="text-sm">{t('common.save')}</span>
            </button>
            <button
              onClick={() => setShowGenerateDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-white transition-colors"
              title="Generate System Prompt"
            >
              <Wand2 className="w-4 h-4" />
              <span className="text-sm hidden md:inline">Generate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Generation Dialog */}
      {showGenerateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-dark-800 rounded-xl border border-dark-700 shadow-xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary-400" />
              Generate System Prompt
            </h3>
            <p className="text-sm text-dark-300 mb-4">
              Describe your task, goal, or paste an existing prompt. Our AI will craft a professional system prompt for you using advanced reasoning patterns.
            </p>

            <textarea
              value={generationTask}
              onChange={(e) => setGenerationTask(e.target.value)}
              className="w-full h-32 px-3 py-2 bg-dark-950 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none resize-none mb-4"
              placeholder="e.g. Create a Python script to scrape LinkedIn profiles, ensuring rate limits are respected and data is saved to CSV..."
              autoFocus
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowGenerateDialog(false)}
                className="px-4 py-2 text-sm text-dark-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateSystemPrompt}
                disabled={!generationTask.trim() || isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-dark-700 bg-dark-800/50 animate-fade-in">
          <h3 className="text-sm font-medium text-dark-200 mb-4">{t('editor.modelConfig')}</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Model Selection */}
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">{t('editor.model')}</label>
              <select
                value={currentPrompt.model}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updatePrompt({ model: e.target.value })}
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
                {t('editor.temperature')}: {currentPrompt.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={currentPrompt.temperature}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePrompt({ temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Max Tokens */}
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">{t('editor.maxTokens')}</label>
              <input
                type="number"
                value={currentPrompt.maxTokens}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePrompt({ maxTokens: parseInt(e.target.value) || 1024 })}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
                min={1}
                max={128000}
              />
            </div>

            {/* Top P */}
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">{t('editor.topP')}: {currentPrompt.topP}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={currentPrompt.topP}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePrompt({ topP: parseFloat(e.target.value) })}
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
            <h3 className="text-sm font-medium text-dark-300 mb-1">{t('editor.title')}</h3>
            <p className="text-xs text-dark-500">
              {t('editor.placeholder')}
            </p>
          </div>
          <div className="flex-1 p-4 overflow-hidden">
            <textarea
              value={currentPrompt.prompt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePrompt({ prompt: e.target.value })}
              className="w-full h-full p-4 bg-dark-950 border border-dark-700 rounded-lg text-sm text-dark-100 font-mono resize-none focus:border-primary-500 focus:outline-none"
              placeholder={t('editor.placeholder')}
            />
          </div>

          {/* Pre-Send Analysis Section */}
          {quickAnalysis && showPreSendAnalysis && (
            <div className="p-4 border-t border-dark-700 bg-dark-800/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary-400" />
                  <h3 className="text-sm font-medium text-dark-300">{t('analysis.preSendAnalysis')}</h3>
                </div>
                <button
                  onClick={() => setShowPreSendAnalysis(false)}
                  className="text-dark-500 hover:text-dark-300 text-xs"
                >
                  {t('common.hide')}
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
                  <div className="text-xs text-dark-500">{t('editor.tokens')}</div>
                </div>

                <div className="text-center p-2 bg-dark-900 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-dark-500 mb-1">
                    <DollarSign className="w-3 h-3" />
                  </div>
                  <div className="text-sm font-bold text-white">
                    ${quickAnalysis.cost.toFixed(4)}
                  </div>
                  <div className="text-xs text-dark-500">{t('chains.cost')}</div>
                </div>

                <div className="text-center p-2 bg-dark-900 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-dark-500 mb-1">
                    <Clock className="w-3 h-3" />
                  </div>
                  <div className="text-sm font-bold text-white">
                    {quickAnalysis.contextUsagePercent.toFixed(1)}%
                  </div>
                  <div className="text-xs text-dark-500">{t('rag.contextLength')}</div>
                </div>

                <div className="text-center p-2 bg-dark-900 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-dark-500 mb-1">
                    <Target className="w-3 h-3" />
                  </div>
                  <div className={`text-sm font-bold ${quickAnalysis.successProbability >= 0.7 ? 'text-green-400' :
                    quickAnalysis.successProbability >= 0.5 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                    {(quickAnalysis.successProbability * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-dark-500">{t('analysis.successProbability')}</div>
                </div>
              </div>

              {/* Status & Recommendations */}
              <div className="flex items-center gap-2 mb-2">
                {quickAnalysis.readyToSend ? (
                  <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">
                    <CheckCircle2 className="w-3 h-3" />
                    {t('common.submit')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">
                    <AlertTriangle className="w-3 h-3" />
                    {t('editor.optimize')}
                  </span>
                )}
              </div>

              {quickAnalysis.recommendations.length > 0 && (
                <div className="space-y-1">
                  {quickAnalysis.recommendations.slice(0, 2).map((rec: string, idx: number) => (
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
              {t('analysis.preSendAnalysis')}
            </button>
          )}
          {/* Test Section */}
          <div className="p-4 border-t border-dark-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-dark-300">{t('editor.test')}</h3>
              <button
                onClick={handleTest}
                disabled={isTesting}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('editor.testing')}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    {t('editor.run')}
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
            <h3 className="text-sm font-medium text-dark-300">{t('editor.variables')}</h3>
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
                <p className="text-sm text-dark-400">{t('editor.variables')}</p>
                <p className="text-xs text-dark-500 mt-1">
                  {t('editor.addVariable')}
                </p>
              </div>
            ) : (
              currentPrompt.variables.map((variable: PromptVariable, index: number) => (
                <div
                  key={index}
                  className="p-3 bg-dark-800 rounded-lg border border-dark-700"
                >
                  <div className="flex items-start justify-between mb-3">
                    <input
                      type="text"
                      value={variable.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleUpdateVariable(index, { name: e.target.value })
                      }
                      className="text-sm font-medium text-white bg-transparent border-none focus:outline-none"
                      placeholder={t('editor.variableName')}
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
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleUpdateVariable(index, { description: e.target.value })
                      }
                      className="w-full px-2 py-1.5 bg-dark-900 border border-dark-600 rounded text-xs text-dark-300 focus:border-primary-500 focus:outline-none"
                      placeholder={t('editor.variableValue')}
                    />

                    <label className="flex items-center gap-2 text-xs text-dark-400">
                      <input
                        type="checkbox"
                        checked={variable.required}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleUpdateVariable(index, { required: e.target.checked })
                        }
                        className="rounded border-dark-600 bg-dark-900 text-primary-500 focus:ring-primary-500"
                      />
                      {t('editor.required')}
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
                {t('editor.variables')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
