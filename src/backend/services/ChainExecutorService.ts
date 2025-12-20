import OpenAI from 'openai';
import prisma from '../lib/prisma.js';
import { config } from '../config/index.js';
import { EmbeddingUtil } from './embedding-util.js';

/**
 * نتيجة تنفيذ مرحلة
 */
export interface StageExecutionResult {
  stageId: string;
  stageName: string;
  input: string;
  output: string;
  success: boolean;
  error?: string;
  duration: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  retries: number;
}

/**
 * نتيجة تنفيذ سلسلة كاملة
 */
export interface ChainExecutionFullResult {
  chainId: string;
  executionId: string;
  success: boolean;
  stageResults: StageExecutionResult[];
  finalOutput: string;
  totalDuration: number;
  totalCost: number;
  totalTokens: number;
  metrics: {
    avgStageDuration: number;
    successRate: number;
    retryRate: number;
  };
}

/**
 * إعدادات تنفيذ المرحلة
 */
export interface StageExecutionConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  retryOnError?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * تكوين مرحلة السلسلة
 */
export interface ChainStageConfig {
  id: string;
  name: string;
  prompt: string;
  order: number;
  dependencies?: string[];
  config?: StageExecutionConfig;
}

/**
 * خدمة تنفيذ السلاسل المحسنة
 * تنفيذ فعلي للمراحل مع LLM وقياس الأداء
 */
export class ChainExecutorService {
  private openai: OpenAI | null = null;

  private defaultConfig: StageExecutionConfig = {
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2048,
    retryOnError: true,
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 60000,
  };

  // تكلفة تقريبية لكل 1000 توكن
  private costPerToken: Record<string, { prompt: number; completion: number }> = {
    'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
    'gpt-4o': { prompt: 0.0025, completion: 0.01 },
    'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
    'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  };

  constructor() {
    if (config.openai?.apiKey) {
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    }
  }

  /**
   * تنفيذ سلسلة كاملة
   */
  async executeChain(
    chainId: string,
    initialContext: Record<string, any> = {},
    options: {
      sessionId?: string;
      streamCallback?: (stage: string, chunk: string) => void;
    } = {}
  ): Promise<ChainExecutionFullResult> {
    const startTime = Date.now();

    // جلب السلسلة
    const chain = await prisma.promptChain.findUnique({
      where: { id: chainId },
    });

    if (!chain) {
      throw new Error('Chain not found');
    }

    const stages = (chain.stages as any[]) as ChainStageConfig[];
    const sortedStages = [...stages].sort((a, b) => a.order - b.order);

    const stageResults: StageExecutionResult[] = [];
    const stageOutputs: Record<string, string> = {};
    const context: Record<string, any> = { ...initialContext };

    let totalCost = 0;
    let totalTokens = 0;
    let successfulStages = 0;
    let totalRetries = 0;

    // تنفيذ كل مرحلة
    for (const stage of sortedStages) {
      try {
        // التحقق من التبعيات
        if (stage.dependencies?.length) {
          const missingDeps = stage.dependencies.filter(dep => !stageOutputs[dep]);
          if (missingDeps.length > 0) {
            throw new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
          }
        }

        // بناء البرومبت
        const builtPrompt = this.buildPrompt(stage.prompt, context, stageOutputs);

        // تنفيذ المرحلة
        const result = await this.executeStage(
          stage,
          builtPrompt,
          options.streamCallback
        );

        stageResults.push(result);
        stageOutputs[stage.id] = result.output;
        context[stage.id] = result.output;

        totalCost += result.cost;
        totalTokens += result.tokenUsage.totalTokens;
        totalRetries += result.retries;

        if (result.success) {
          successfulStages++;
        }
      } catch (error) {
        const errorResult: StageExecutionResult = {
          stageId: stage.id,
          stageName: stage.name,
          input: stage.prompt,
          output: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0,
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          cost: 0,
          retries: 0,
        };

        stageResults.push(errorResult);

        // إيقاف التنفيذ عند فشل مرحلة حرجة
        break;
      }
    }

    const totalDuration = Date.now() - startTime;
    const finalOutput = stageOutputs[sortedStages[sortedStages.length - 1]?.id] || '';
    const allSuccess = stageResults.every(r => r.success);

    // حفظ التنفيذ
    const execution = await prisma.chainExecution.create({
      data: {
        chainId,
        stageResults: stageResults as any,
        totalDuration,
        totalCost,
        success: allSuccess,
        errorMessage: allSuccess ? null : stageResults.find(r => !r.success)?.error,
      },
    });

    return {
      chainId,
      executionId: execution.id,
      success: allSuccess,
      stageResults,
      finalOutput,
      totalDuration,
      totalCost,
      totalTokens,
      metrics: {
        avgStageDuration: totalDuration / stageResults.length,
        successRate: successfulStages / stageResults.length,
        retryRate: totalRetries / stageResults.length,
      },
    };
  }

  /**
   * تنفيذ مرحلة واحدة
   */
  private async executeStage(
    stage: ChainStageConfig,
    prompt: string,
    streamCallback?: (stage: string, chunk: string) => void
  ): Promise<StageExecutionResult> {
    const startTime = Date.now();
    const stageConfig = { ...this.defaultConfig, ...stage.config };
    let retries = 0;
    let lastError: Error | null = null;

    while (retries <= (stageConfig.maxRetries || 0)) {
      try {
        if (!this.openai) {
          // Fallback للتطوير بدون OpenAI
          return this.mockExecution(stage, prompt, startTime);
        }

        let output = '';
        let promptTokens = 0;
        let completionTokens = 0;

        if (streamCallback) {
          // Streaming mode
          const stream = await this.openai.chat.completions.create({
            model: stageConfig.model || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a helpful assistant executing a chain stage.' },
              { role: 'user', content: prompt },
            ],
            temperature: stageConfig.temperature,
            max_tokens: stageConfig.maxTokens,
            stream: true,
          });

          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              output += content;
              streamCallback(stage.id, content);
            }
          }

          // تقدير التوكنات للـ streaming
          promptTokens = EmbeddingUtil.estimateTokenCount(prompt);
          completionTokens = EmbeddingUtil.estimateTokenCount(output);
        } else {
          // Normal mode
          const response = await this.openai.chat.completions.create({
            model: stageConfig.model || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a helpful assistant executing a chain stage.' },
              { role: 'user', content: prompt },
            ],
            temperature: stageConfig.temperature,
            max_tokens: stageConfig.maxTokens,
          });

          output = response.choices[0]?.message?.content || '';
          promptTokens = response.usage?.prompt_tokens || 0;
          completionTokens = response.usage?.completion_tokens || 0;
        }

        const totalTokens = promptTokens + completionTokens;
        const cost = this.calculateCost(stageConfig.model || 'gpt-4o-mini', promptTokens, completionTokens);

        return {
          stageId: stage.id,
          stageName: stage.name,
          input: prompt,
          output,
          success: true,
          duration: Date.now() - startTime,
          tokenUsage: { promptTokens, completionTokens, totalTokens },
          cost,
          retries,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        retries++;

        if (retries <= (stageConfig.maxRetries || 0)) {
          await this.delay(stageConfig.retryDelay || 1000);
        }
      }
    }

    // فشل بعد كل المحاولات
    return {
      stageId: stage.id,
      stageName: stage.name,
      input: prompt,
      output: '',
      success: false,
      error: lastError?.message || 'Unknown error',
      duration: Date.now() - startTime,
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      cost: 0,
      retries,
    };
  }

  /**
   * تنفيذ وهمي للتطوير
   */
  private mockExecution(
    stage: ChainStageConfig,
    prompt: string,
    startTime: number
  ): StageExecutionResult {
    const mockOutput = `[Mock Output for "${stage.name}"]\nProcessed: ${prompt.slice(0, 100)}...\nResult: Stage completed successfully.`;
    const promptTokens = EmbeddingUtil.estimateTokenCount(prompt);
    const completionTokens = EmbeddingUtil.estimateTokenCount(mockOutput);

    return {
      stageId: stage.id,
      stageName: stage.name,
      input: prompt,
      output: mockOutput,
      success: true,
      duration: Date.now() - startTime,
      tokenUsage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      cost: 0,
      retries: 0,
    };
  }

  /**
   * بناء البرومبت مع استبدال المتغيرات
   */
  private buildPrompt(
    template: string,
    context: Record<string, any>,
    stageOutputs: Record<string, string>
  ): string {
    let prompt = template;

    // استبدال مخرجات المراحل
    for (const [stageId, output] of Object.entries(stageOutputs)) {
      prompt = prompt.replace(new RegExp(`\\{\\{${stageId}\\}\\}`, 'g'), output);
    }

    // استبدال متغيرات السياق
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
    }

    // معالجة الشروط
    prompt = prompt.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, varName, content) => (context[varName] ? content : '')
    );

    return prompt;
  }

  /**
   * حساب التكلفة
   */
  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = this.costPerToken[model] || this.costPerToken['gpt-4o-mini'];
    return (
      (promptTokens / 1000) * pricing.prompt +
      (completionTokens / 1000) * pricing.completion
    );
  }

  /**
   * تأخير
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * تحليل أداء سلسلة
   */
  async analyzePerformance(
    chainId: string,
    executionCount: number = 50
  ): Promise<{
    avgDuration: number;
    avgCost: number;
    successRate: number;
    stageStats: Record<string, {
      avgDuration: number;
      successRate: number;
      avgTokens: number;
    }>;
    trends: {
      improving: boolean;
      costTrend: 'increasing' | 'decreasing' | 'stable';
      durationTrend: 'increasing' | 'decreasing' | 'stable';
    };
  }> {
    const executions = await prisma.chainExecution.findMany({
      where: { chainId },
      orderBy: { createdAt: 'desc' },
      take: executionCount,
    });

    if (executions.length === 0) {
      return {
        avgDuration: 0,
        avgCost: 0,
        successRate: 0,
        stageStats: {},
        trends: { improving: false, costTrend: 'stable', durationTrend: 'stable' },
      };
    }

    const avgDuration = executions.reduce((sum, e) => sum + e.totalDuration, 0) / executions.length;
    const avgCost = executions.reduce((sum, e) => sum + (e.totalCost || 0), 0) / executions.length;
    const successRate = executions.filter(e => e.success).length / executions.length;

    // إحصائيات المراحل
    const stageStats: Record<string, { durations: number[]; successes: number; tokens: number[]; count: number }> = {};

    for (const execution of executions) {
      const stages = (execution.stageResults as any[]) || [];
      for (const stage of stages) {
        if (!stageStats[stage.stageId]) {
          stageStats[stage.stageId] = { durations: [], successes: 0, tokens: [], count: 0 };
        }
        stageStats[stage.stageId].durations.push(stage.duration || 0);
        stageStats[stage.stageId].tokens.push(stage.tokenUsage?.totalTokens || 0);
        stageStats[stage.stageId].count++;
        if (stage.success) {
          stageStats[stage.stageId].successes++;
        }
      }
    }

    const formattedStageStats: Record<string, any> = {};
    for (const [stageId, stats] of Object.entries(stageStats)) {
      formattedStageStats[stageId] = {
        avgDuration: stats.durations.reduce((a, b) => a + b, 0) / stats.count,
        successRate: stats.successes / stats.count,
        avgTokens: stats.tokens.reduce((a, b) => a + b, 0) / stats.count,
      };
    }

    // تحليل الاتجاهات
    const recentHalf = executions.slice(0, Math.floor(executions.length / 2));
    const olderHalf = executions.slice(Math.floor(executions.length / 2));

    const recentSuccessRate = recentHalf.filter(e => e.success).length / recentHalf.length;
    const olderSuccessRate = olderHalf.length > 0 ? olderHalf.filter(e => e.success).length / olderHalf.length : 0;

    const recentAvgCost = recentHalf.reduce((sum, e) => sum + (e.totalCost || 0), 0) / recentHalf.length;
    const olderAvgCost = olderHalf.length > 0 ? olderHalf.reduce((sum, e) => sum + (e.totalCost || 0), 0) / olderHalf.length : 0;

    const recentAvgDuration = recentHalf.reduce((sum, e) => sum + e.totalDuration, 0) / recentHalf.length;
    const olderAvgDuration = olderHalf.length > 0 ? olderHalf.reduce((sum, e) => sum + e.totalDuration, 0) / olderHalf.length : 0;

    return {
      avgDuration,
      avgCost,
      successRate,
      stageStats: formattedStageStats,
      trends: {
        improving: recentSuccessRate > olderSuccessRate,
        costTrend: recentAvgCost > olderAvgCost * 1.1 ? 'increasing' : recentAvgCost < olderAvgCost * 0.9 ? 'decreasing' : 'stable',
        durationTrend: recentAvgDuration > olderAvgDuration * 1.1 ? 'increasing' : recentAvgDuration < olderAvgDuration * 0.9 ? 'decreasing' : 'stable',
      },
    };
  }

  /**
   * إعادة تنفيذ مرحلة فاشلة
   */
  async retryFailedStage(
    executionId: string,
    stageId: string,
    overrideInput?: string
  ): Promise<StageExecutionResult> {
    const execution = await prisma.chainExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      throw new Error('Execution not found');
    }

    const stages = (execution.stageResults as any[]) || [];
    const failedStage = stages.find(s => s.stageId === stageId);

    if (!failedStage) {
      throw new Error('Stage not found in execution');
    }

    const chain = await prisma.promptChain.findUnique({
      where: { id: execution.chainId },
    });

    if (!chain) {
      throw new Error('Chain not found');
    }

    const chainStages = (chain.stages as any[]) as ChainStageConfig[];
    const stageConfig = chainStages.find(s => s.id === stageId);

    if (!stageConfig) {
      throw new Error('Stage config not found');
    }

    const prompt = overrideInput || failedStage.input;
    const result = await this.executeStage(stageConfig, prompt);

    // تحديث التنفيذ
    const updatedStages = stages.map(s =>
      s.stageId === stageId ? { ...result } : s
    );

    await prisma.chainExecution.update({
      where: { id: executionId },
      data: {
        stageResults: updatedStages as any,
        success: updatedStages.every((s: any) => s.success),
      },
    });

    return result;
  }
}

export const chainExecutorService = new ChainExecutorService();
export default chainExecutorService;
