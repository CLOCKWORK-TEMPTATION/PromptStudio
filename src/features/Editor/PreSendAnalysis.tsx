'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Info,
  ChevronDown,
  ChevronUp,
  Target,
  Gauge,
  Lightbulb,
  RefreshCw,
  BarChart3,
  Percent,
} from 'lucide-react';

// Types
interface TokenEstimation {
  inputTokens: number;
  estimatedOutputTokens: number;
  totalTokens: number;
  contextUsagePercent: number;
}

interface CostEstimation {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  costPerRequest: number;
  monthlyEstimate: number;
}

interface ResponseTimeEstimation {
  estimatedSeconds: number;
  confidenceInterval: { min: number; max: number };
  tokensPerSecond: number;
}

interface SuccessFactor {
  name: string;
  score: number;
  weight: number;
  impact: 'positive' | 'negative' | 'neutral';
  suggestion?: string;
}

interface SuccessPrediction {
  probability: number;
  confidence: number;
  factors: SuccessFactor[];
  riskLevel: 'low' | 'medium' | 'high';
}

interface OptimizationRecommendation {
  type: 'shorten' | 'rephrase' | 'reduce_context' | 'add_structure' | 'add_examples' | 'clarify_output';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImprovement: {
    costReduction?: number;
    speedImprovement?: number;
    successIncrease?: number;
  };
  suggestedChange?: string;
}

interface PreSendAnalysisResult {
  tokenEstimation: TokenEstimation;
  costEstimation: CostEstimation;
  responseTimeEstimation: ResponseTimeEstimation;
  successPrediction: SuccessPrediction;
  recommendations: OptimizationRecommendation[];
  overallScore: number;
  readyToSend: boolean;
  warnings: string[];
}

interface PreSendAnalysisProps {
  prompt: string;
  model: string;
  onAnalysisComplete?: (analysis: PreSendAnalysisResult) => void;
  autoAnalyze?: boolean;
  debounceMs?: number;
  className?: string;
}

// Model pricing for local calculations
const MODEL_PRICING: Record<string, { input: number; output: number; contextWindow: number }> = {
  'gpt-4': { input: 0.03, output: 0.06, contextWindow: 8192 },
  'gpt-4-turbo': { input: 0.01, output: 0.03, contextWindow: 128000 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03, contextWindow: 128000 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002, contextWindow: 16385 },
  'claude-3-opus': { input: 0.015, output: 0.075, contextWindow: 200000 },
  'claude-3-sonnet': { input: 0.003, output: 0.015, contextWindow: 200000 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125, contextWindow: 200000 },
};

export function PreSendAnalysis({
  prompt,
  model,
  onAnalysisComplete,
  autoAnalyze = true,
  debounceMs = 500,
  className = '',
}: PreSendAnalysisProps) {
  const [analysis, setAnalysis] = useState<PreSendAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);

  // Local analysis function (for instant feedback)
  const performLocalAnalysis = useCallback((promptText: string, selectedModel: string): PreSendAnalysisResult => {
    const pricing = MODEL_PRICING[selectedModel] || MODEL_PRICING['gpt-4'];

    // Token estimation
    const inputTokens = Math.ceil(promptText.length / 4);
    const estimatedOutputTokens = Math.ceil(inputTokens * 0.8);
    const totalTokens = inputTokens + estimatedOutputTokens;
    const contextUsagePercent = (totalTokens / pricing.contextWindow) * 100;

    // Cost estimation
    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (estimatedOutputTokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;

    // Response time estimation
    const baseTime = selectedModel.includes('gpt-4') ? 2.0 : selectedModel.includes('claude-3-opus') ? 3.0 : 1.0;
    const perTokenTime = selectedModel.includes('gpt-4') ? 0.05 : 0.03;
    const estimatedSeconds = baseTime + (estimatedOutputTokens * perTokenTime);

    // Success prediction factors
    const factors: SuccessFactor[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    // Structure score
    const structureScore = evaluateStructure(promptText);
    factors.push({
      name: 'بنية البرومبت',
      score: structureScore,
      weight: 0.2,
      impact: structureScore >= 0.7 ? 'positive' : structureScore >= 0.4 ? 'neutral' : 'negative',
      suggestion: structureScore < 0.7 ? 'أضف عناوين وأقسام واضحة' : undefined,
    });
    totalScore += structureScore * 0.2;
    totalWeight += 0.2;

    // Examples score
    const examplesScore = evaluateExamples(promptText);
    factors.push({
      name: 'وجود أمثلة',
      score: examplesScore,
      weight: 0.15,
      impact: examplesScore >= 0.7 ? 'positive' : examplesScore >= 0.4 ? 'neutral' : 'negative',
      suggestion: examplesScore < 0.5 ? 'أضف أمثلة توضيحية' : undefined,
    });
    totalScore += examplesScore * 0.15;
    totalWeight += 0.15;

    // Output spec score
    const outputSpecScore = evaluateOutputSpec(promptText);
    factors.push({
      name: 'تحديد المخرجات',
      score: outputSpecScore,
      weight: 0.2,
      impact: outputSpecScore >= 0.7 ? 'positive' : outputSpecScore >= 0.4 ? 'neutral' : 'negative',
      suggestion: outputSpecScore < 0.6 ? 'حدد تنسيق المخرجات المطلوب' : undefined,
    });
    totalScore += outputSpecScore * 0.2;
    totalWeight += 0.2;

    // Length score
    const lengthScore = evaluateLength(promptText);
    factors.push({
      name: 'طول مناسب',
      score: lengthScore,
      weight: 0.15,
      impact: lengthScore >= 0.7 ? 'positive' : lengthScore >= 0.4 ? 'neutral' : 'negative',
      suggestion: lengthScore < 0.5
        ? (promptText.length < 100 ? 'البرومبت قصير جداً' : 'البرومبت طويل جداً')
        : undefined,
    });
    totalScore += lengthScore * 0.15;
    totalWeight += 0.15;

    // Instructions score
    const instructionScore = evaluateInstructions(promptText);
    factors.push({
      name: 'وضوح التعليمات',
      score: instructionScore,
      weight: 0.15,
      impact: instructionScore >= 0.7 ? 'positive' : instructionScore >= 0.4 ? 'neutral' : 'negative',
      suggestion: instructionScore < 0.6 ? 'استخدم تعليمات واضحة ومحددة' : undefined,
    });
    totalScore += instructionScore * 0.15;
    totalWeight += 0.15;

    // Safety score (simplified)
    const safetyScore = 0.9;
    factors.push({
      name: 'درجة الأمان',
      score: safetyScore,
      weight: 0.15,
      impact: 'positive',
    });
    totalScore += safetyScore * 0.15;
    totalWeight += 0.15;

    const probability = totalScore / totalWeight;
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (probability >= 0.75) riskLevel = 'low';
    else if (probability < 0.5) riskLevel = 'high';

    // Generate recommendations
    const recommendations: OptimizationRecommendation[] = [];

    if (totalCost > 0.05) {
      recommendations.push({
        type: 'shorten',
        priority: 'medium',
        title: 'تقليل التكلفة',
        description: 'اختصر البرومبت لتقليل التكلفة',
        expectedImprovement: { costReduction: 20 },
      });
    }

    if (contextUsagePercent > 50) {
      recommendations.push({
        type: 'reduce_context',
        priority: contextUsagePercent > 80 ? 'high' : 'medium',
        title: 'تقليل السياق',
        description: `تستخدم ${contextUsagePercent.toFixed(1)}% من السياق`,
        expectedImprovement: { costReduction: 15, speedImprovement: 10 },
      });
    }

    for (const factor of factors) {
      if (factor.score < 0.6 && factor.suggestion) {
        recommendations.push({
          type: factor.name.includes('أمثلة') ? 'add_examples' :
                factor.name.includes('مخرجات') ? 'clarify_output' :
                factor.name.includes('بنية') ? 'add_structure' : 'rephrase',
          priority: factor.score < 0.4 ? 'high' : 'medium',
          title: `تحسين ${factor.name}`,
          description: factor.suggestion,
          expectedImprovement: { successIncrease: Math.round((0.7 - factor.score) * 100) },
        });
      }
    }

    // Warnings
    const warnings: string[] = [];
    if (contextUsagePercent > 90) warnings.push('⚠️ استخدام السياق يقترب من الحد الأقصى');
    if (totalCost > 0.1) warnings.push('💰 التكلفة المقدرة مرتفعة');
    if (probability < 0.5) warnings.push('⚠️ احتمال النجاح منخفض');

    const overallScore = (1 - contextUsagePercent / 100) * 0.2 +
                        Math.max(0, 1 - totalCost / 0.1) * 0.2 +
                        probability * 0.6;

    return {
      tokenEstimation: {
        inputTokens,
        estimatedOutputTokens,
        totalTokens,
        contextUsagePercent,
      },
      costEstimation: {
        inputCost,
        outputCost,
        totalCost,
        currency: 'USD',
        costPerRequest: totalCost,
        monthlyEstimate: totalCost * 100,
      },
      responseTimeEstimation: {
        estimatedSeconds,
        confidenceInterval: {
          min: Math.max(0.5, estimatedSeconds * 0.7),
          max: estimatedSeconds * 1.5,
        },
        tokensPerSecond: estimatedOutputTokens / estimatedSeconds,
      },
      successPrediction: {
        probability,
        confidence: 0.8,
        factors,
        riskLevel,
      },
      recommendations: recommendations.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      }),
      overallScore,
      readyToSend: probability >= 0.6 && contextUsagePercent < 90,
      warnings,
    };
  }, []);

  // Auto-analyze with debounce
  useEffect(() => {
    if (!autoAnalyze || !prompt) {
      setAnalysis(null);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(() => {
      const result = performLocalAnalysis(prompt, model);
      setAnalysis(result);
      setIsLoading(false);
      onAnalysisComplete?.(result);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [prompt, model, autoAnalyze, debounceMs, performLocalAnalysis, onAnalysisComplete]);

  // Manual analyze
  const handleManualAnalyze = () => {
    if (!prompt) return;
    setIsLoading(true);
    setTimeout(() => {
      const result = performLocalAnalysis(prompt, model);
      setAnalysis(result);
      setIsLoading(false);
      onAnalysisComplete?.(result);
    }, 100);
  };

  if (!prompt) {
    return null;
  }

  return (
    <div className={`bg-dark-800 rounded-lg border border-dark-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-dark-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-medium text-white">تحليل ما قبل الإرسال</span>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <RefreshCw className="w-4 h-4 text-primary-400 animate-spin" />
          )}
          <button
            onClick={handleManualAnalyze}
            disabled={isLoading}
            className="p-1.5 hover:bg-dark-700 rounded text-dark-400 hover:text-primary-400 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {analysis && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-2 p-3 border-b border-dark-700">
            {/* Tokens */}
            <div className="text-center p-2 bg-dark-900 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-dark-400 mb-1">
                <Zap className="w-3 h-3" />
                <span className="text-xs">التوكنات</span>
              </div>
              <div className="text-lg font-bold text-white">
                {analysis.tokenEstimation.totalTokens.toLocaleString()}
              </div>
              <div className="text-xs text-dark-500">
                {analysis.tokenEstimation.contextUsagePercent.toFixed(1)}% سياق
              </div>
            </div>

            {/* Cost */}
            <div className="text-center p-2 bg-dark-900 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-dark-400 mb-1">
                <DollarSign className="w-3 h-3" />
                <span className="text-xs">التكلفة</span>
              </div>
              <div className="text-lg font-bold text-white">
                ${analysis.costEstimation.totalCost.toFixed(4)}
              </div>
              <div className="text-xs text-dark-500">
                ~${analysis.costEstimation.monthlyEstimate.toFixed(2)}/شهر
              </div>
            </div>

            {/* Time */}
            <div className="text-center p-2 bg-dark-900 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-dark-400 mb-1">
                <Clock className="w-3 h-3" />
                <span className="text-xs">الوقت</span>
              </div>
              <div className="text-lg font-bold text-white">
                {analysis.responseTimeEstimation.estimatedSeconds.toFixed(1)}s
              </div>
              <div className="text-xs text-dark-500">
                ±{(analysis.responseTimeEstimation.confidenceInterval.max - analysis.responseTimeEstimation.estimatedSeconds).toFixed(1)}s
              </div>
            </div>

            {/* Success */}
            <div className="text-center p-2 bg-dark-900 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-dark-400 mb-1">
                <Target className="w-3 h-3" />
                <span className="text-xs">النجاح</span>
              </div>
              <div className={`text-lg font-bold ${
                analysis.successPrediction.probability >= 0.7 ? 'text-green-400' :
                analysis.successPrediction.probability >= 0.5 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {(analysis.successPrediction.probability * 100).toFixed(0)}%
              </div>
              <div className={`text-xs ${
                analysis.successPrediction.riskLevel === 'low' ? 'text-green-500' :
                analysis.successPrediction.riskLevel === 'medium' ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {analysis.successPrediction.riskLevel === 'low' ? 'منخفض المخاطر' :
                 analysis.successPrediction.riskLevel === 'medium' ? 'متوسط المخاطر' : 'عالي المخاطر'}
              </div>
            </div>
          </div>

          {/* Overall Score Bar */}
          <div className="p-3 border-b border-dark-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-dark-300">الدرجة الإجمالية</span>
              <div className="flex items-center gap-2">
                {analysis.readyToSend ? (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle2 className="w-3 h-3" />
                    جاهز للإرسال
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-yellow-400">
                    <AlertTriangle className="w-3 h-3" />
                    يحتاج تحسين
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 bg-dark-900 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  analysis.overallScore >= 0.7 ? 'bg-green-500' :
                  analysis.overallScore >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${analysis.overallScore * 100}%` }}
              />
            </div>
          </div>

          {/* Warnings */}
          {analysis.warnings.length > 0 && (
            <div className="p-3 border-b border-dark-700 bg-yellow-500/5">
              <div className="space-y-1">
                {analysis.warnings.map((warning, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-yellow-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <div className="border-b border-dark-700">
              <button
                onClick={() => setShowRecommendations(!showRecommendations)}
                className="w-full p-3 flex items-center justify-between hover:bg-dark-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-dark-200">
                    توصيات التحسين ({analysis.recommendations.length})
                  </span>
                </div>
                {showRecommendations ? (
                  <ChevronUp className="w-4 h-4 text-dark-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-dark-400" />
                )}
              </button>

              {showRecommendations && (
                <div className="px-3 pb-3 space-y-2">
                  {analysis.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        rec.priority === 'high' ? 'bg-red-500/10 border-red-500/30' :
                        rec.priority === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30' :
                        'bg-blue-500/10 border-blue-500/30'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-white">{rec.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          rec.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                          rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {rec.priority === 'high' ? 'عالي' : rec.priority === 'medium' ? 'متوسط' : 'منخفض'}
                        </span>
                      </div>
                      <p className="text-xs text-dark-300">{rec.description}</p>
                      {rec.expectedImprovement && (
                        <div className="flex items-center gap-3 mt-2">
                          {rec.expectedImprovement.costReduction && (
                            <span className="text-xs text-green-400 flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" />
                              -{rec.expectedImprovement.costReduction}% تكلفة
                            </span>
                          )}
                          {rec.expectedImprovement.successIncrease && (
                            <span className="text-xs text-green-400 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              +{rec.expectedImprovement.successIncrease}% نجاح
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Detailed Factors */}
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full p-3 flex items-center justify-between hover:bg-dark-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary-400" />
                <span className="text-sm font-medium text-dark-200">
                  عوامل النجاح التفصيلية
                </span>
              </div>
              {showDetails ? (
                <ChevronUp className="w-4 h-4 text-dark-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-dark-400" />
              )}
            </button>

            {showDetails && (
              <div className="px-3 pb-3 space-y-2">
                {analysis.successPrediction.factors.map((factor, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-dark-400 truncate">{factor.name}</div>
                    <div className="flex-1 h-2 bg-dark-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          factor.impact === 'positive' ? 'bg-green-500' :
                          factor.impact === 'negative' ? 'bg-red-500' : 'bg-yellow-500'
                        }`}
                        style={{ width: `${factor.score * 100}%` }}
                      />
                    </div>
                    <div className="w-10 text-xs text-dark-300 text-right">
                      {(factor.score * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {!analysis && !isLoading && prompt && (
        <div className="p-6 text-center text-dark-400">
          <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">ابدأ بكتابة البرومبت للحصول على التحليل</p>
        </div>
      )}
    </div>
  );
}

// Helper functions
function evaluateStructure(prompt: string): number {
  let score = 0.3;
  if (prompt.includes('#') || prompt.includes('##')) score += 0.2;
  if (prompt.includes('\n\n')) score += 0.1;
  if (/\d\.\s/.test(prompt)) score += 0.15;
  if (prompt.includes('- ') || prompt.includes('• ')) score += 0.1;
  if (prompt.toLowerCase().includes('step') || prompt.includes('خطوة')) score += 0.15;
  return Math.min(score, 1);
}

function evaluateExamples(prompt: string): number {
  let score = 0.2;
  const keywords = ['example', 'e.g.', 'مثال', 'مثلاً'];
  for (const kw of keywords) {
    if (prompt.toLowerCase().includes(kw)) {
      score += 0.3;
      break;
    }
  }
  if (/input:|output:|المدخل:|المخرج:/i.test(prompt)) score += 0.25;
  if (prompt.includes('```')) score += 0.25;
  return Math.min(score, 1);
}

function evaluateOutputSpec(prompt: string): number {
  let score = 0.2;
  const keywords = ['format', 'output', 'return', 'المخرج', 'التنسيق'];
  for (const kw of keywords) {
    if (prompt.toLowerCase().includes(kw)) {
      score += 0.2;
      break;
    }
  }
  if (/json|xml|csv|markdown|جدول|قائمة/i.test(prompt)) score += 0.3;
  if (/max|min|limit|حد|كلمات/i.test(prompt)) score += 0.2;
  return Math.min(score, 1);
}

function evaluateLength(prompt: string): number {
  const length = prompt.length;
  if (length < 50) return 0.2;
  if (length < 100) return 0.4;
  if (length < 200) return 0.6;
  if (length <= 3000) return 1.0;
  if (length <= 5000) return 0.8;
  if (length <= 10000) return 0.6;
  return 0.4;
}

function evaluateInstructions(prompt: string): number {
  let score = 0.3;
  const keywords = ['must', 'should', 'always', 'never', 'يجب', 'لا تفعل', 'دائماً'];
  let count = 0;
  for (const kw of keywords) {
    if (prompt.toLowerCase().includes(kw)) count++;
  }
  score += Math.min(count * 0.15, 0.5);
  if (/^[A-Z][a-z]+\s/.test(prompt)) score += 0.2;
  return Math.min(score, 1);
}

export default PreSendAnalysis;
