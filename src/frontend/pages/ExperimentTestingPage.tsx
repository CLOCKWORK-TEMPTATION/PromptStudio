import { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  FlaskConical,
  Play,
  History,
  TrendingUp,
  Zap,
  Target,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  BarChart3,
  GitBranch,
  Sparkles,
} from 'lucide-react';

// Types
interface TrialMetrics {
  quality: number;
  cost: number;
  latency: number;
  tokens: number;
  successProbability: number;
  qualityCostRatio: number;
  improvementOverBase: number;
}

interface PromptVariant {
  id: string;
  content: string;
  mutationType: string;
}

interface ExperimentTrial {
  id: string;
  iteration: number;
  variant: PromptVariant;
  metrics: TrialMetrics;
  timestamp: string;
}

interface ExperimentSummary {
  totalTrials: number;
  totalIterations: number;
  avgQuality: number;
  avgCost: number;
  bestQualityCostRatio: number;
  convergenceIteration: number;
  mutationEffectiveness: Record<string, number>;
}

interface ExperimentResult {
  experimentId: string;
  basePrompt: string;
  bestPrompt: string;
  bestScore: number;
  improvement: number;
  trials: ExperimentTrial[];
  summary: ExperimentSummary;
  startTime: string;
  endTime: string;
  status: 'completed' | 'early_stopped' | 'failed';
}

interface ExperimentConfig {
  maxIterations: number;
  populationSize: number;
  acquisitionFunction: 'ucb' | 'ei' | 'poi' | 'thompson';
  explorationWeight: number;
  earlyStopThreshold: number;
  earlyStopPatience: number;
  mutationProbability: number;
  crossoverProbability: number;
}

export default function ExperimentTestingPage() {
  // State
  const [promptInput, setPromptInput] = useState('');
  const [experiments, setExperiments] = useState<ExperimentResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [selectedExperiment, setSelectedExperiment] = useState<ExperimentResult | null>(null);
  const [expandedTrials, setExpandedTrials] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Config state
  const [config, setConfig] = useState<Partial<ExperimentConfig>>({
    maxIterations: 5,
    populationSize: 4,
    acquisitionFunction: 'ucb',
    explorationWeight: 2.0,
  });

  // Fetch experiment history
  useEffect(() => {
    fetchExperimentHistory();
  }, []);

  const fetchExperimentHistory = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: { experiments: ExperimentResult[] } }>(
        '/prompts/experiments/history'
      );
      setExperiments(response.data.data.experiments);
    } catch (err) {
      console.error('Failed to fetch experiments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Run new experiment
  const runExperiment = async () => {
    if (!promptInput.trim()) {
      setError('Please enter a prompt to optimize');
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; data: ExperimentResult }>(
        '/prompts/experiments/bayesian',
        { prompt: promptInput, config }
      );

      const result = response.data.data;
      setExperiments(prev => [result, ...prev]);
      setSelectedExperiment(result);
      setActiveTab('history');
    } catch (err: any) {
      setError(err.message || 'Failed to run experiment');
    } finally {
      setIsRunning(false);
    }
  };

  // Quick optimize
  const runQuickOptimize = async () => {
    if (!promptInput.trim()) {
      setError('Please enter a prompt to optimize');
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; data: ExperimentResult }>(
        '/prompts/experiments/quick-optimize',
        { prompt: promptInput }
      );

      const result = response.data.data;
      setExperiments(prev => [result, ...prev]);
      setSelectedExperiment(result);
      setActiveTab('history');
    } catch (err: any) {
      setError(err.message || 'Failed to run quick optimization');
    } finally {
      setIsRunning(false);
    }
  };

  // Delete experiment
  const deleteExperiment = async (experimentId: string) => {
    try {
      await api.delete(`/prompts/experiments/${experimentId}`);
      setExperiments(prev => prev.filter(e => e.experimentId !== experimentId));
      if (selectedExperiment?.experimentId === experimentId) {
        setSelectedExperiment(null);
      }
    } catch (err) {
      console.error('Failed to delete experiment:', err);
    }
  };

  // Copy prompt to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Toggle trial expansion
  const toggleTrialExpansion = (trialId: string) => {
    setExpandedTrials(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trialId)) {
        newSet.delete(trialId);
      } else {
        newSet.add(trialId);
      }
      return newSet;
    });
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'early_stopped':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get mutation type badge
  const getMutationBadge = (type: string) => {
    const colors: Record<string, string> = {
      original: 'bg-gray-100 text-gray-800',
      add_examples: 'bg-blue-100 text-blue-800',
      add_constraints: 'bg-purple-100 text-purple-800',
      simplify: 'bg-green-100 text-green-800',
      elaborate: 'bg-orange-100 text-orange-800',
      restructure: 'bg-pink-100 text-pink-800',
      add_chain_of_thought: 'bg-indigo-100 text-indigo-800',
      add_output_format: 'bg-teal-100 text-teal-800',
      crossover: 'bg-yellow-100 text-yellow-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="text-primary" />
          تجارب تحسين البرومبت
        </h1>
        <p className="text-muted-foreground mt-1">
          استخدم خوارزميات Bayesian/Evolutionary للعثور على أفضل نسخة من البرومبت
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('new')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'new'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="inline-block w-4 h-4 mr-2" />
          تجربة جديدة
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="inline-block w-4 h-4 mr-2" />
          سجل التجارب ({experiments.length})
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            &times;
          </button>
        </div>
      )}

      {/* New Experiment Tab */}
      {activeTab === 'new' && (
        <div className="space-y-6">
          {/* Prompt Input */}
          <div className="bg-card border rounded-xl p-6">
            <label className="block text-sm font-medium mb-2">البرومبت الأساسي</label>
            <textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="أدخل البرومبت الذي تريد تحسينه..."
              className="w-full h-40 px-4 py-3 border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              dir="auto"
            />
          </div>

          {/* Configuration */}
          <div className="bg-card border rounded-xl p-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Target size={18} />
              إعدادات التجربة
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  عدد التكرارات
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={config.maxIterations}
                  onChange={(e) => setConfig({ ...config, maxIterations: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  حجم المجموعة
                </label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={config.populationSize}
                  onChange={(e) => setConfig({ ...config, populationSize: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  دالة الاكتساب
                </label>
                <select
                  value={config.acquisitionFunction}
                  onChange={(e) => setConfig({ ...config, acquisitionFunction: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                >
                  <option value="ucb">UCB (استكشاف متوازن)</option>
                  <option value="ei">EI (التحسين المتوقع)</option>
                  <option value="poi">POI (احتمال التحسن)</option>
                  <option value="thompson">Thompson Sampling</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  وزن الاستكشاف
                </label>
                <input
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={config.explorationWeight}
                  onChange={(e) => setConfig({ ...config, explorationWeight: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={runExperiment}
              disabled={isRunning || !promptInput.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري التحسين...
                </>
              ) : (
                <>
                  <Play size={20} />
                  تشغيل تجربة كاملة
                </>
              )}
            </button>
            <button
              onClick={runQuickOptimize}
              disabled={isRunning || !promptInput.trim()}
              className="flex items-center gap-2 px-6 py-3 border rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              <Zap size={20} />
              تحسين سريع
            </button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Experiment List */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">التجارب السابقة</h3>
              <button
                onClick={fetchExperimentHistory}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : experiments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد تجارب سابقة</p>
                <p className="text-sm">ابدأ بتشغيل تجربة جديدة</p>
              </div>
            ) : (
              experiments.map((exp) => (
                <div
                  key={exp.experimentId}
                  onClick={() => setSelectedExperiment(exp)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedExperiment?.experimentId === exp.experimentId
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(exp.status)}`}>
                      {exp.status === 'completed' ? 'مكتمل' : exp.status === 'early_stopped' ? 'توقف مبكر' : 'فشل'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteExperiment(exp.experimentId);
                      }}
                      className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-sm line-clamp-2 mb-2" dir="auto">
                    {exp.basePrompt.substring(0, 100)}...
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <TrendingUp size={12} />
                      {exp.improvement.toFixed(1)}%
                    </span>
                    <span className="flex items-center gap-1">
                      <GitBranch size={12} />
                      {exp.summary.totalTrials} تجربة
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDate(exp.startTime)}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Experiment Details */}
          <div className="lg:col-span-2">
            {selectedExperiment ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid sm:grid-cols-4 gap-4">
                  <div className="bg-card border rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp size={16} />
                      <span className="text-sm">التحسن</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      +{selectedExperiment.improvement.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Target size={16} />
                      <span className="text-sm">أفضل نتيجة</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {(selectedExperiment.bestScore * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <GitBranch size={16} />
                      <span className="text-sm">التجارب</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {selectedExperiment.summary.totalTrials}
                    </p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Clock size={16} />
                      <span className="text-sm">التقارب</span>
                    </div>
                    <p className="text-2xl font-bold">
                      الدورة {selectedExperiment.summary.convergenceIteration}
                    </p>
                  </div>
                </div>

                {/* Best Prompt */}
                <div className="bg-card border rounded-xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Sparkles className="text-yellow-500" size={18} />
                      أفضل برومبت
                    </h3>
                    <button
                      onClick={() => copyToClipboard(selectedExperiment.bestPrompt)}
                      className="flex items-center gap-1 px-3 py-1 text-sm border rounded-lg hover:bg-accent"
                    >
                      <Copy size={14} />
                      نسخ
                    </button>
                  </div>
                  <pre className="bg-muted/50 p-4 rounded-lg text-sm whitespace-pre-wrap overflow-x-auto" dir="auto">
                    {selectedExperiment.bestPrompt}
                  </pre>
                </div>

                {/* Mutation Effectiveness */}
                <div className="bg-card border rounded-xl p-6">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <BarChart3 size={18} />
                    فعالية الطفرات
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(selectedExperiment.summary.mutationEffectiveness)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, score]) => (
                        <div key={type} className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-1 rounded ${getMutationBadge(type)}`}>
                            {type.replace(/_/g, ' ')}
                          </span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${score * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">
                            {(score * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Trial History */}
                <div className="bg-card border rounded-xl p-6">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <History size={18} />
                    سجل التجارب التفصيلي
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {selectedExperiment.trials.map((trial) => (
                      <div key={trial.id} className="border rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleTrialExpansion(trial.id)}
                          className="w-full p-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              الدورة {trial.iteration}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${getMutationBadge(trial.variant.mutationType)}`}>
                              {trial.variant.mutationType.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">
                              {(trial.metrics.quality * 100).toFixed(1)}%
                            </span>
                            <span className={`text-xs ${trial.metrics.improvementOverBase > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {trial.metrics.improvementOverBase > 0 ? '+' : ''}
                              {trial.metrics.improvementOverBase.toFixed(1)}%
                            </span>
                            {expandedTrials.has(trial.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </div>
                        </button>
                        {expandedTrials.has(trial.id) && (
                          <div className="p-4 border-t bg-muted/30">
                            <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">الجودة</span>
                                <p className="font-medium">{(trial.metrics.quality * 100).toFixed(1)}%</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">التكلفة</span>
                                <p className="font-medium">${trial.metrics.cost.toFixed(4)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">الرموز</span>
                                <p className="font-medium">{trial.metrics.tokens}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">الجودة/التكلفة</span>
                                <p className="font-medium">{trial.metrics.qualityCostRatio.toFixed(2)}</p>
                              </div>
                            </div>
                            <div className="bg-background p-3 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-muted-foreground">المحتوى</span>
                                <button
                                  onClick={() => copyToClipboard(trial.variant.content)}
                                  className="p-1 hover:bg-accent rounded"
                                >
                                  <Copy size={12} />
                                </button>
                              </div>
                              <pre className="text-xs whitespace-pre-wrap max-h-32 overflow-y-auto" dir="auto">
                                {trial.variant.content}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>اختر تجربة لعرض التفاصيل</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
