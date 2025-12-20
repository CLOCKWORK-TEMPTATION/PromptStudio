import prisma from '../lib/prisma.js';
import { PromptService } from './PromptService.js';
import { SafetyService } from './SafetyService.js';

/**
 * Pre-Send Prediction Service
 * Provides cost estimation, response time prediction, and success probability
 * based on historical data and prompt analysis
 */

// Model pricing per 1K tokens (input/output)
export const MODEL_PRICING: Record<string, { input: number; output: number; contextWindow: number }> = {
  'gpt-4': { input: 0.03, output: 0.06, contextWindow: 8192 },
  'gpt-4-turbo': { input: 0.01, output: 0.03, contextWindow: 128000 },
  'gpt-4-32k': { input: 0.06, output: 0.12, contextWindow: 32768 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002, contextWindow: 16385 },
  'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004, contextWindow: 16385 },
  'claude-3-opus': { input: 0.015, output: 0.075, contextWindow: 200000 },
  'claude-3-sonnet': { input: 0.003, output: 0.015, contextWindow: 200000 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125, contextWindow: 200000 },
  'claude-3.5-sonnet': { input: 0.003, output: 0.015, contextWindow: 200000 },
  'gemini-pro': { input: 0.00025, output: 0.0005, contextWindow: 32760 },
  'gemini-ultra': { input: 0.00125, output: 0.00375, contextWindow: 32760 },
  'llama-3-70b': { input: 0.0009, output: 0.0009, contextWindow: 8192 },
  'mistral-large': { input: 0.004, output: 0.012, contextWindow: 32000 },
};

// Average response times per model (in seconds)
const MODEL_RESPONSE_TIMES: Record<string, { baseTime: number; perTokenTime: number }> = {
  'gpt-4': { baseTime: 2.0, perTokenTime: 0.05 },
  'gpt-4-turbo': { baseTime: 1.0, perTokenTime: 0.03 },
  'gpt-3.5-turbo': { baseTime: 0.5, perTokenTime: 0.01 },
  'claude-3-opus': { baseTime: 3.0, perTokenTime: 0.08 },
  'claude-3-sonnet': { baseTime: 1.5, perTokenTime: 0.04 },
  'claude-3-haiku': { baseTime: 0.3, perTokenTime: 0.008 },
  'claude-3.5-sonnet': { baseTime: 1.5, perTokenTime: 0.04 },
  'gemini-pro': { baseTime: 0.8, perTokenTime: 0.02 },
  'default': { baseTime: 1.5, perTokenTime: 0.03 },
};

export interface TokenEstimation {
  inputTokens: number;
  estimatedOutputTokens: number;
  totalTokens: number;
  contextUsagePercent: number;
}

export interface CostEstimation {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  costPerRequest: number;
  monthlyEstimate: number;
}

export interface ResponseTimeEstimation {
  estimatedSeconds: number;
  confidenceInterval: { min: number; max: number };
  tokensPerSecond: number;
}

export interface SuccessPrediction {
  probability: number;
  confidence: number;
  factors: SuccessFactor[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface SuccessFactor {
  name: string;
  score: number;
  weight: number;
  impact: 'positive' | 'negative' | 'neutral';
  suggestion?: string;
}

export interface OptimizationRecommendation {
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

export interface HistoricalMetrics {
  avgTokens: number;
  avgCost: number;
  avgResponseTime: number;
  successRate: number;
  sampleSize: number;
}

export interface PreSendAnalysisResult {
  tokenEstimation: TokenEstimation;
  costEstimation: CostEstimation;
  responseTimeEstimation: ResponseTimeEstimation;
  successPrediction: SuccessPrediction;
  recommendations: OptimizationRecommendation[];
  historicalComparison?: HistoricalMetrics;
  overallScore: number;
  readyToSend: boolean;
  warnings: string[];
}

export class PreSendPredictionService {
  /**
   * Perform comprehensive pre-send analysis
   */
  static async analyze(
    prompt: string,
    model: string = 'gpt-4',
    options: {
      expectedOutputLength?: 'short' | 'medium' | 'long';
      requestsPerMonth?: number;
      includeHistory?: boolean;
      userId?: string;
    } = {}
  ): Promise<PreSendAnalysisResult> {
    const {
      expectedOutputLength = 'medium',
      requestsPerMonth = 100,
      includeHistory = true,
      userId,
    } = options;

    // Token estimation
    const tokenEstimation = this.estimateTokens(prompt, model, expectedOutputLength);

    // Cost estimation
    const costEstimation = this.estimateCost(
      tokenEstimation,
      model,
      requestsPerMonth
    );

    // Response time estimation
    const responseTimeEstimation = this.estimateResponseTime(
      tokenEstimation,
      model
    );

    // Success prediction
    const successPrediction = await this.predictSuccess(prompt, model);

    // Get recommendations
    const recommendations = this.generateRecommendations(
      prompt,
      tokenEstimation,
      costEstimation,
      successPrediction
    );

    // Historical comparison
    let historicalComparison: HistoricalMetrics | undefined;
    if (includeHistory) {
      historicalComparison = await this.getHistoricalMetrics(prompt, model, userId);
    }

    // Calculate overall score
    const overallScore = this.calculateOverallScore(
      tokenEstimation,
      costEstimation,
      successPrediction
    );

    // Determine if ready to send
    const warnings = this.generateWarnings(
      tokenEstimation,
      costEstimation,
      successPrediction,
      model
    );

    const readyToSend =
      successPrediction.probability >= 0.6 &&
      tokenEstimation.contextUsagePercent < 90 &&
      warnings.filter(w => w.includes('critical')).length === 0;

    return {
      tokenEstimation,
      costEstimation,
      responseTimeEstimation,
      successPrediction,
      recommendations,
      historicalComparison,
      overallScore,
      readyToSend,
      warnings,
    };
  }

  /**
   * Estimate token counts
   */
  static estimateTokens(
    prompt: string,
    model: string,
    expectedOutputLength: 'short' | 'medium' | 'long'
  ): TokenEstimation {
    // Estimate input tokens (roughly 4 chars per token)
    const inputTokens = Math.ceil(prompt.length / 4);

    // Estimate output tokens based on expected length
    const outputMultipliers = {
      short: 0.3,
      medium: 0.8,
      long: 1.5,
    };
    const estimatedOutputTokens = Math.ceil(
      inputTokens * outputMultipliers[expectedOutputLength]
    );

    const totalTokens = inputTokens + estimatedOutputTokens;

    // Get context window
    const contextWindow = MODEL_PRICING[model]?.contextWindow || 8192;
    const contextUsagePercent = (totalTokens / contextWindow) * 100;

    return {
      inputTokens,
      estimatedOutputTokens,
      totalTokens,
      contextUsagePercent,
    };
  }

  /**
   * Estimate costs
   */
  static estimateCost(
    tokenEstimation: TokenEstimation,
    model: string,
    requestsPerMonth: number
  ): CostEstimation {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4'];

    const inputCost = (tokenEstimation.inputTokens / 1000) * pricing.input;
    const outputCost = (tokenEstimation.estimatedOutputTokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;
    const monthlyEstimate = totalCost * requestsPerMonth;

    return {
      inputCost,
      outputCost,
      totalCost,
      currency: 'USD',
      costPerRequest: totalCost,
      monthlyEstimate,
    };
  }

  /**
   * Estimate response time
   */
  static estimateResponseTime(
    tokenEstimation: TokenEstimation,
    model: string
  ): ResponseTimeEstimation {
    const timing = MODEL_RESPONSE_TIMES[model] || MODEL_RESPONSE_TIMES['default'];

    const estimatedSeconds =
      timing.baseTime +
      (tokenEstimation.estimatedOutputTokens * timing.perTokenTime);

    // Add variance for confidence interval
    const variance = estimatedSeconds * 0.3;

    const tokensPerSecond = tokenEstimation.estimatedOutputTokens / estimatedSeconds;

    return {
      estimatedSeconds,
      confidenceInterval: {
        min: Math.max(0.5, estimatedSeconds - variance),
        max: estimatedSeconds + variance * 1.5,
      },
      tokensPerSecond,
    };
  }

  /**
   * Predict success probability
   */
  static async predictSuccess(
    prompt: string,
    model: string
  ): Promise<SuccessPrediction> {
    const factors: SuccessFactor[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    // Factor 1: Prompt clarity (structure)
    const structureScore = this.evaluateStructure(prompt);
    factors.push({
      name: 'بنية البرومبت',
      score: structureScore,
      weight: 0.2,
      impact: structureScore >= 0.7 ? 'positive' : structureScore >= 0.4 ? 'neutral' : 'negative',
      suggestion: structureScore < 0.7 ? 'أضف عناوين وأقسام واضحة باستخدام # أو ##' : undefined,
    });
    totalScore += structureScore * 0.2;
    totalWeight += 0.2;

    // Factor 2: Examples presence
    const examplesScore = this.evaluateExamples(prompt);
    factors.push({
      name: 'وجود أمثلة',
      score: examplesScore,
      weight: 0.15,
      impact: examplesScore >= 0.7 ? 'positive' : examplesScore >= 0.4 ? 'neutral' : 'negative',
      suggestion: examplesScore < 0.5 ? 'أضف أمثلة توضيحية للمدخلات والمخرجات المتوقعة' : undefined,
    });
    totalScore += examplesScore * 0.15;
    totalWeight += 0.15;

    // Factor 3: Output specification
    const outputSpecScore = this.evaluateOutputSpec(prompt);
    factors.push({
      name: 'تحديد المخرجات',
      score: outputSpecScore,
      weight: 0.2,
      impact: outputSpecScore >= 0.7 ? 'positive' : outputSpecScore >= 0.4 ? 'neutral' : 'negative',
      suggestion: outputSpecScore < 0.6 ? 'حدد تنسيق المخرجات المطلوب (JSON, قائمة, فقرة...)' : undefined,
    });
    totalScore += outputSpecScore * 0.2;
    totalWeight += 0.2;

    // Factor 4: Length appropriateness
    const lengthScore = this.evaluateLength(prompt);
    factors.push({
      name: 'طول مناسب',
      score: lengthScore,
      weight: 0.15,
      impact: lengthScore >= 0.7 ? 'positive' : lengthScore >= 0.4 ? 'neutral' : 'negative',
      suggestion: lengthScore < 0.5
        ? (prompt.length < 100 ? 'البرومبت قصير جداً، أضف المزيد من التفاصيل' : 'البرومبت طويل جداً، حاول الاختصار')
        : undefined,
    });
    totalScore += lengthScore * 0.15;
    totalWeight += 0.15;

    // Factor 5: Clear instructions
    const instructionScore = this.evaluateInstructions(prompt);
    factors.push({
      name: 'وضوح التعليمات',
      score: instructionScore,
      weight: 0.15,
      impact: instructionScore >= 0.7 ? 'positive' : instructionScore >= 0.4 ? 'neutral' : 'negative',
      suggestion: instructionScore < 0.6 ? 'استخدم كلمات واضحة مثل "يجب"، "لا تفعل"، "دائماً"' : undefined,
    });
    totalScore += instructionScore * 0.15;
    totalWeight += 0.15;

    // Factor 6: Safety score
    const safetyResult = await SafetyService.calculateSafetyScore(prompt);
    factors.push({
      name: 'درجة الأمان',
      score: safetyResult,
      weight: 0.15,
      impact: safetyResult >= 0.8 ? 'positive' : safetyResult >= 0.5 ? 'neutral' : 'negative',
      suggestion: safetyResult < 0.7 ? 'راجع المحتوى للتأكد من عدم وجود محتوى حساس' : undefined,
    });
    totalScore += safetyResult * 0.15;
    totalWeight += 0.15;

    const probability = totalScore / totalWeight;

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (probability >= 0.75) riskLevel = 'low';
    else if (probability < 0.5) riskLevel = 'high';

    // Calculate confidence based on factor consistency
    const scores = factors.map(f => f.score);
    const variance = this.calculateVariance(scores);
    const confidence = Math.max(0.5, 1 - variance);

    return {
      probability,
      confidence,
      factors,
      riskLevel,
    };
  }

  /**
   * Generate optimization recommendations
   */
  static generateRecommendations(
    prompt: string,
    tokenEstimation: TokenEstimation,
    costEstimation: CostEstimation,
    successPrediction: SuccessPrediction
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Cost optimization
    if (costEstimation.totalCost > 0.05) {
      recommendations.push({
        type: 'shorten',
        priority: 'medium',
        title: 'تقليل التكلفة',
        description: 'يمكنك تقليل التكلفة عن طريق اختصار البرومبت',
        expectedImprovement: {
          costReduction: 20,
        },
        suggestedChange: 'أزل التكرارات والتفاصيل غير الضرورية',
      });
    }

    // Context usage
    if (tokenEstimation.contextUsagePercent > 50) {
      recommendations.push({
        type: 'reduce_context',
        priority: tokenEstimation.contextUsagePercent > 80 ? 'high' : 'medium',
        title: 'تقليل استخدام السياق',
        description: `تستخدم ${tokenEstimation.contextUsagePercent.toFixed(1)}% من نافذة السياق`,
        expectedImprovement: {
          costReduction: 15,
          speedImprovement: 10,
        },
        suggestedChange: 'قسّم المهمة إلى أجزاء أصغر أو استخدم ملخصات',
      });
    }

    // Success probability improvements
    for (const factor of successPrediction.factors) {
      if (factor.score < 0.6 && factor.suggestion) {
        let type: OptimizationRecommendation['type'] = 'rephrase';

        if (factor.name.includes('أمثلة')) type = 'add_examples';
        else if (factor.name.includes('مخرجات')) type = 'clarify_output';
        else if (factor.name.includes('بنية')) type = 'add_structure';

        recommendations.push({
          type,
          priority: factor.score < 0.4 ? 'high' : 'medium',
          title: `تحسين ${factor.name}`,
          description: factor.suggestion,
          expectedImprovement: {
            successIncrease: Math.round((0.7 - factor.score) * 100),
          },
        });
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations;
  }

  /**
   * Get historical metrics for similar prompts
   */
  static async getHistoricalMetrics(
    prompt: string,
    model: string,
    userId?: string
  ): Promise<HistoricalMetrics | undefined> {
    try {
      // Get recent executions
      const executions = await prisma.promptExecution?.findMany?.({
        where: {
          model,
          ...(userId ? { userId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      if (!executions || executions.length === 0) {
        return undefined;
      }

      const avgTokens = executions.reduce((sum: number, e: any) => sum + (e.tokens || 0), 0) / executions.length;
      const avgCost = executions.reduce((sum: number, e: any) => sum + (e.cost || 0), 0) / executions.length;
      const avgResponseTime = executions.reduce((sum: number, e: any) => sum + (e.responseTime || 0), 0) / executions.length;
      const successCount = executions.filter((e: any) => e.success).length;

      return {
        avgTokens,
        avgCost,
        avgResponseTime,
        successRate: successCount / executions.length,
        sampleSize: executions.length,
      };
    } catch {
      // Table might not exist
      return undefined;
    }
  }

  /**
   * Calculate overall score
   */
  static calculateOverallScore(
    tokenEstimation: TokenEstimation,
    costEstimation: CostEstimation,
    successPrediction: SuccessPrediction
  ): number {
    // Context efficiency (0-1)
    const contextEfficiency = Math.max(0, 1 - tokenEstimation.contextUsagePercent / 100);

    // Cost efficiency (0-1, based on $0.10 as expensive threshold)
    const costEfficiency = Math.max(0, 1 - costEstimation.totalCost / 0.1);

    // Success probability is already 0-1
    const successScore = successPrediction.probability;

    // Weighted average
    return (
      contextEfficiency * 0.2 +
      costEfficiency * 0.2 +
      successScore * 0.6
    );
  }

  /**
   * Generate warnings
   */
  static generateWarnings(
    tokenEstimation: TokenEstimation,
    costEstimation: CostEstimation,
    successPrediction: SuccessPrediction,
    model: string
  ): string[] {
    const warnings: string[] = [];

    if (tokenEstimation.contextUsagePercent > 90) {
      warnings.push('⚠️ critical: استخدام السياق يقترب من الحد الأقصى');
    } else if (tokenEstimation.contextUsagePercent > 70) {
      warnings.push('⚠️ استخدام السياق مرتفع، قد يؤثر على جودة الاستجابة');
    }

    if (costEstimation.totalCost > 0.5) {
      warnings.push('💰 التكلفة المقدرة مرتفعة جداً');
    } else if (costEstimation.totalCost > 0.1) {
      warnings.push('💰 التكلفة المقدرة مرتفعة نسبياً');
    }

    if (successPrediction.probability < 0.5) {
      warnings.push('⚠️ critical: احتمال النجاح منخفض، راجع التوصيات');
    } else if (successPrediction.probability < 0.7) {
      warnings.push('⚠️ احتمال النجاح متوسط، يمكن تحسينه');
    }

    if (successPrediction.riskLevel === 'high') {
      warnings.push('🔴 مستوى المخاطرة مرتفع');
    }

    return warnings;
  }

  // Helper methods for success prediction

  private static evaluateStructure(prompt: string): number {
    let score = 0.3; // Base score

    if (prompt.includes('#') || prompt.includes('##')) score += 0.2;
    if (prompt.includes('\n\n')) score += 0.1;
    if (/\d\.\s/.test(prompt)) score += 0.15; // Numbered lists
    if (prompt.includes('- ') || prompt.includes('• ')) score += 0.1;
    if (prompt.toLowerCase().includes('step') || prompt.includes('خطوة')) score += 0.15;

    return Math.min(score, 1);
  }

  private static evaluateExamples(prompt: string): number {
    let score = 0.2;

    const exampleKeywords = ['example', 'e.g.', 'for instance', 'مثال', 'مثلاً', 'على سبيل المثال'];
    for (const kw of exampleKeywords) {
      if (prompt.toLowerCase().includes(kw)) {
        score += 0.3;
        break;
      }
    }

    // Check for input/output patterns
    if (/input:|output:|المدخل:|المخرج:/i.test(prompt)) score += 0.25;
    if (prompt.includes('```')) score += 0.25;

    return Math.min(score, 1);
  }

  private static evaluateOutputSpec(prompt: string): number {
    let score = 0.2;

    const outputKeywords = ['format', 'output', 'return', 'respond', 'المخرج', 'التنسيق', 'الناتج', 'أجب'];
    for (const kw of outputKeywords) {
      if (prompt.toLowerCase().includes(kw)) {
        score += 0.2;
        break;
      }
    }

    // Check for specific format mentions
    if (/json|xml|csv|markdown|html|جدول|قائمة/i.test(prompt)) score += 0.3;

    // Check for constraints
    if (/max|min|limit|words|characters|حد|كلمات|أحرف/i.test(prompt)) score += 0.2;

    return Math.min(score, 1);
  }

  private static evaluateLength(prompt: string): number {
    const length = prompt.length;

    // Optimal range: 200-3000 characters
    if (length < 50) return 0.2;
    if (length < 100) return 0.4;
    if (length < 200) return 0.6;
    if (length <= 3000) return 1.0;
    if (length <= 5000) return 0.8;
    if (length <= 10000) return 0.6;
    return 0.4;
  }

  private static evaluateInstructions(prompt: string): number {
    let score = 0.3;

    const instructionKeywords = [
      'must', 'should', 'always', 'never', 'do not', 'make sure',
      'يجب', 'لا تفعل', 'دائماً', 'أبداً', 'تأكد', 'احرص'
    ];

    let keywordCount = 0;
    for (const kw of instructionKeywords) {
      if (prompt.toLowerCase().includes(kw)) {
        keywordCount++;
      }
    }

    score += Math.min(keywordCount * 0.15, 0.5);

    // Check for imperative sentences
    if (/^[A-Z][a-z]+\s/.test(prompt) || /\.\s+[A-Z]/.test(prompt)) score += 0.2;

    return Math.min(score, 1);
  }

  private static calculateVariance(scores: number[]): number {
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const squaredDiffs = scores.map(s => Math.pow(s - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Quick analysis for real-time feedback
   */
  static quickAnalyze(prompt: string, model: string = 'gpt-4'): {
    tokens: number;
    cost: number;
    successProbability: number;
  } {
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(inputTokens * 0.8);
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4'];

    const cost =
      (inputTokens / 1000) * pricing.input +
      (outputTokens / 1000) * pricing.output;

    // Quick success probability
    let successProbability = 0.5;
    if (prompt.length > 100) successProbability += 0.1;
    if (prompt.includes('#')) successProbability += 0.1;
    if (/example|مثال/i.test(prompt)) successProbability += 0.1;
    if (/output|format|مخرج/i.test(prompt)) successProbability += 0.1;
    successProbability = Math.min(successProbability, 0.95);

    return {
      tokens: inputTokens + outputTokens,
      cost,
      successProbability,
    };
  }
}

export default PreSendPredictionService;
