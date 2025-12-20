import { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  Play,
  Plus,
  Trash2,
  Settings,
  History,
  Brain,
  Database,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

// Types
interface ChainStage {
  id: string;
  name: string;
  prompt: string;
  expectedOutput?: string;
  order: number;
  dependencies?: string[];
  config?: {
    maxTokens?: number;
    temperature?: number;
    useMemory?: boolean;
    cacheOutput?: boolean;
    retryOnFail?: boolean;
    maxRetries?: number;
  };
}

interface PipelineTemplate {
  type: string;
  name: string;
  nameEn: string;
  description: string;
  stages: { id: string; name: string }[];
}

interface StageResult {
  stageId: string;
  stageName: string;
  input: string;
  output: string;
  duration: number;
  usedMemory: boolean;
  memorySimilarity?: number;
}

interface ExecutionResult {
  success: boolean;
  results: Record<string, string>;
  stageResults: StageResult[];
  totalDuration: number;
  totalCost?: number;
  errors?: string[];
  memoryStats?: {
    contextReused: boolean;
    similarContextsFound: number;
    newContextStored: boolean;
  };
}

interface MemoryStats {
  totalRecords: number;
  byType: Record<string, number>;
  avgRelevance: number;
  topTags: { tag: string; count: number }[];
  memoryUsage: number;
}

interface PromptChainEditorProps {
  promptId: string;
  chainId?: string;
  onChainCreated?: (chainId: string) => void;
  onExecutionComplete?: (result: ExecutionResult) => void;
}

export function PromptChainEditor({
  promptId,
  chainId: initialChainId,
  onChainCreated,
  onExecutionComplete,
}: PromptChainEditorProps) {
  // State
  const [chainId, setChainId] = useState(initialChainId);
  const [chainName, setChainName] = useState('');
  const [chainDescription, setChainDescription] = useState('');
  const [stages, setStages] = useState<ChainStage[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('standard');
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(-1);

  const [showSettings, setShowSettings] = useState(false);
  const [enableMemory, setEnableMemory] = useState(true);
  const [reuseContext, setReuseContext] = useState(true);

  const [input, setInput] = useState('');
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
    if (enableMemory) {
      loadMemoryStats();
    }
  }, [enableMemory]);

  // Apply template when selected
  useEffect(() => {
    const template = templates.find((t) => t.type === selectedTemplate);
    if (template) {
      applyTemplate(template);
    }
  }, [selectedTemplate, templates]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/chains/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      // Set default templates
      setTemplates([
        {
          type: 'standard',
          name: 'قياسي',
          nameEn: 'Standard',
          description: 'تحليل -> تخطيط -> صياغة -> مراجعة -> إخراج',
          stages: [
            { id: 'analyze', name: 'تحليل' },
            { id: 'plan', name: 'تخطيط' },
            { id: 'draft', name: 'صياغة' },
            { id: 'review', name: 'مراجعة' },
            { id: 'finalize', name: 'إخراج نهائي' },
          ],
        },
      ]);
    }
  };

  const loadMemoryStats = async () => {
    try {
      const response = await fetch('/api/chains/memory/stats');
      if (response.ok) {
        const data = await response.json();
        setMemoryStats(data);
      }
    } catch (error) {
      console.error('Failed to load memory stats:', error);
    }
  };

  const applyTemplate = (template: PipelineTemplate) => {
    const defaultPrompts: Record<string, string> = {
      analyze: `قم بتحليل المدخل التالي وحدد:
1. الموضوع الرئيسي والمواضيع الفرعية
2. الكيانات والمفاهيم الأساسية
3. السياق والنبرة المطلوبة

المدخل:
{{input}}`,
      plan: `بناءً على التحليل التالي:
{{analyze}}

ضع خطة منظمة للاستجابة.`,
      draft: `اتبع الخطة التالية:
{{plan}}

واكتب مسودة شاملة للاستجابة.`,
      review: `راجع المسودة التالية:
{{draft}}

وقدم ملاحظات للتحسين.`,
      finalize: `بناءً على المسودة والمراجعة، أنتج الإصدار النهائي.`,
    };

    const newStages: ChainStage[] = template.stages.map((s, index) => ({
      id: s.id,
      name: s.name,
      prompt: defaultPrompts[s.id] || `معالجة: {{input}}`,
      order: index,
      dependencies: index > 0 ? [template.stages[index - 1].id] : undefined,
      config: {
        useMemory: index === 0,
        cacheOutput: index === template.stages.length - 1,
      },
    }));

    setStages(newStages);
  };

  const handleCreateChain = async () => {
    if (!chainName.trim()) {
      alert('يرجى إدخال اسم السلسلة');
      return;
    }

    try {
      const response = await fetch('/api/chains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptId,
          name: chainName,
          description: chainDescription,
          stages,
          pipelineType: selectedTemplate,
          enableMemory,
          reuseContext,
        }),
      });

      if (response.ok) {
        const chain = await response.json();
        setChainId(chain.id);
        onChainCreated?.(chain.id);
      }
    } catch (error) {
      console.error('Failed to create chain:', error);
    }
  };

  const handleExecuteChain = useCallback(async () => {
    if (!chainId) {
      await handleCreateChain();
      return;
    }

    if (!input.trim()) {
      alert('يرجى إدخال النص');
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);
    setCurrentStageIndex(0);

    try {
      const response = await fetch(`/api/chains/${chainId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialContext: { input },
          useMemory: enableMemory,
          storeInMemory: enableMemory,
        }),
      });

      if (response.ok) {
        const result: ExecutionResult = await response.json();
        setExecutionResult(result);
        setCurrentStageIndex(result.stageResults.length);
        onExecutionComplete?.(result);

        // Refresh memory stats if memory was used
        if (enableMemory) {
          loadMemoryStats();
        }
      }
    } catch (error) {
      console.error('Failed to execute chain:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [chainId, input, enableMemory, onExecutionComplete]);

  const handleAddStage = () => {
    const newStage: ChainStage = {
      id: `stage_${Date.now()}`,
      name: `مرحلة ${stages.length + 1}`,
      prompt: '{{input}}',
      order: stages.length,
      dependencies: stages.length > 0 ? [stages[stages.length - 1].id] : undefined,
    };
    setStages([...stages, newStage]);
  };

  const handleRemoveStage = (stageId: string) => {
    setStages(stages.filter((s) => s.id !== stageId));
  };

  const handleUpdateStage = (stageId: string, updates: Partial<ChainStage>) => {
    setStages(
      stages.map((s) => (s.id === stageId ? { ...s, ...updates } : s))
    );
  };

  const getStageStatus = (stageId: string): 'pending' | 'running' | 'success' | 'error' => {
    if (!executionResult) {
      const stageIndex = stages.findIndex((s) => s.id === stageId);
      if (isExecuting && stageIndex === currentStageIndex) return 'running';
      if (isExecuting && stageIndex < currentStageIndex) return 'success';
      return 'pending';
    }

    const result = executionResult.stageResults.find((r) => r.stageId === stageId);
    if (!result) return 'pending';
    return executionResult.success ? 'success' : 'error';
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            سلاسل Prompt المتقدمة
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMemoryPanel(!showMemoryPanel)}
            className={`p-2 rounded-lg transition-colors ${
              showMemoryPanel
                ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
            title="الذاكرة طويلة الأمد"
          >
            <Brain className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Memory Stats Panel */}
      {showMemoryPanel && memoryStats && (
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-purple-900 dark:text-purple-100">
              إحصائيات الذاكرة طويلة الأمد
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {memoryStats.totalRecords}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">إجمالي السجلات</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {(memoryStats.avgRelevance * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">متوسط الصلة</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {(memoryStats.memoryUsage / 1024).toFixed(1)} KB
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">حجم الذاكرة</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {memoryStats.topTags.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">الوسوم النشطة</div>
            </div>
          </div>
          {memoryStats.topTags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {memoryStats.topTags.slice(0, 5).map((tag) => (
                <span
                  key={tag.tag}
                  className="px-2 py-1 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 text-sm rounded-full"
                >
                  {tag.tag} ({tag.count})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">إعدادات السلسلة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                اسم السلسلة
              </label>
              <input
                type="text"
                value={chainName}
                onChange={(e) => setChainName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="أدخل اسم السلسلة..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                قالب خط الأنابيب
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {templates.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.name} - {t.description}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enableMemory"
                checked={enableMemory}
                onChange={(e) => setEnableMemory(e.target.checked)}
                className="w-4 h-4 text-blue-600"
              />
              <label htmlFor="enableMemory" className="text-sm text-gray-700 dark:text-gray-300">
                تفعيل الذاكرة طويلة الأمد
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="reuseContext"
                checked={reuseContext}
                onChange={(e) => setReuseContext(e.target.checked)}
                className="w-4 h-4 text-blue-600"
              />
              <label htmlFor="reuseContext" className="text-sm text-gray-700 dark:text-gray-300">
                إعادة استخدام السياق من المهام السابقة
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Visualization */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">مراحل خط الأنابيب</h3>
          <button
            onClick={handleAddStage}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            إضافة مرحلة
          </button>
        </div>

        {/* Pipeline Stages */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4">
          {stages.map((stage, index) => {
            const status = getStageStatus(stage.id);
            return (
              <div key={stage.id} className="flex items-center gap-2">
                {/* Stage Card */}
                <div
                  className={`min-w-[180px] p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    status === 'running'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : status === 'success'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : status === 'error'
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                  onClick={() =>
                    setExpandedStage(expandedStage === stage.id ? null : stage.id)
                  }
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      {status === 'running' && (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                      )}
                      {status === 'success' && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      {status === 'error' && (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      {stage.config?.useMemory && (
                        <Brain className="w-4 h-4 text-purple-500" title="يستخدم الذاكرة" />
                      )}
                    </div>
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {stage.name}
                  </h4>
                  {executionResult && (
                    <div className="mt-2 text-xs text-gray-500">
                      {executionResult.stageResults.find((r) => r.stageId === stage.id)
                        ?.usedMemory && (
                        <span className="text-purple-500">استخدم الذاكرة</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Arrow */}
                {index < stages.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Expanded Stage Editor */}
        {expandedStage && (
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            {(() => {
              const stage = stages.find((s) => s.id === expandedStage);
              if (!stage) return null;

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) =>
                        handleUpdateStage(stage.id, { name: e.target.value })
                      }
                      className="text-lg font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none text-gray-900 dark:text-white"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRemoveStage(stage.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setExpandedStage(null)}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      قالب المرحلة
                    </label>
                    <textarea
                      value={stage.prompt}
                      onChange={(e) =>
                        handleUpdateStage(stage.id, { prompt: e.target.value })
                      }
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                      placeholder="استخدم {{variable}} للمتغيرات..."
                      dir="ltr"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={stage.config?.useMemory || false}
                        onChange={(e) =>
                          handleUpdateStage(stage.id, {
                            config: { ...stage.config, useMemory: e.target.checked },
                          })
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        استخدام الذاكرة
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={stage.config?.cacheOutput || false}
                        onChange={(e) =>
                          handleUpdateStage(stage.id, {
                            config: { ...stage.config, cacheOutput: e.target.checked },
                          })
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        تخزين المخرج
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={stage.config?.retryOnFail || false}
                        onChange={(e) =>
                          handleUpdateStage(stage.id, {
                            config: { ...stage.config, retryOnFail: e.target.checked },
                          })
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        إعادة المحاولة
                      </span>
                    </label>
                  </div>

                  {/* Stage Result */}
                  {executionResult && (
                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        نتيجة المرحلة
                      </h5>
                      <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap" dir="ltr">
                        {executionResult.stageResults.find((r) => r.stageId === stage.id)
                          ?.output || 'لم تُنفذ بعد'}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Input Section */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          المدخل
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="أدخل النص الذي تريد معالجته..."
        />
      </div>

      {/* Execute Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleExecuteChain}
          disabled={isExecuting || !input.trim()}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
            isExecuting || !input.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              جاري التنفيذ...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              تنفيذ السلسلة
            </>
          )}
        </button>

        {executionResult && (
          <button
            onClick={() => {
              setExecutionResult(null);
              setInput('');
            }}
            className="flex items-center gap-2 px-4 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            إعادة تعيين
          </button>
        )}
      </div>

      {/* Execution Result */}
      {executionResult && (
        <div
          className={`p-4 rounded-lg border-2 ${
            executionResult.success
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-red-500 bg-red-50 dark:bg-red-900/20'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {executionResult.success ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <XCircle className="w-6 h-6 text-red-500" />
              )}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {executionResult.success ? 'تم التنفيذ بنجاح' : 'فشل التنفيذ'}
              </h3>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {executionResult.totalDuration}ms
              </span>
              {executionResult.memoryStats && (
                <span className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  {executionResult.memoryStats.similarContextsFound} سياقات مشابهة
                </span>
              )}
            </div>
          </div>

          {/* Memory Stats */}
          {executionResult.memoryStats && (
            <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <div className="flex items-center gap-4 text-sm">
                {executionResult.memoryStats.contextReused && (
                  <span className="text-purple-600 dark:text-purple-300">
                    تم إعادة استخدام السياق
                  </span>
                )}
                {executionResult.memoryStats.newContextStored && (
                  <span className="text-purple-600 dark:text-purple-300">
                    تم تخزين السياق الجديد
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Final Output */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              المخرج النهائي
            </h4>
            <pre className="text-gray-900 dark:text-white whitespace-pre-wrap" dir="ltr">
              {executionResult.results[stages[stages.length - 1]?.id] || 'لا يوجد مخرج'}
            </pre>
          </div>

          {/* Errors */}
          {executionResult.errors && executionResult.errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                الأخطاء
              </h4>
              <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400">
                {executionResult.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PromptChainEditor;
