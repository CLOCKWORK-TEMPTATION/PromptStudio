import OpenAI from 'openai';
import { config } from '../config/index.js';
import prisma from '../lib/prisma.js';
import {
  OutputEvaluationService,
  EvaluationResult,
  RefinementSuggestion,
} from './OutputEvaluationService.js';
import { PromptService, HierarchicalPrompt } from './PromptService.js';

export interface RefinementConfig {
  maxIterations: number;
  targetScore: number;
  autoApply: boolean;
  preserveIntent: boolean;
  evaluateSafety: boolean;
  evaluateStyle: boolean;
  evaluateAccuracy: boolean;
}

export interface RefinementIteration {
  iteration: number;
  originalPrompt: string;
  refinedPrompt: string;
  evaluation: EvaluationResult;
  appliedSuggestions: RefinementSuggestion[];
  improvementDelta: number;
  timestamp: Date;
}

export interface RefinementResult {
  success: boolean;
  originalPrompt: string;
  finalPrompt: string;
  iterations: RefinementIteration[];
  totalImprovement: number;
  finalScore: number;
  versionId?: string;
  executionTimeMs: number;
}

export interface RefinementHistoryEntry {
  id: string;
  promptId: string;
  version: number;
  originalContent: string;
  refinedContent: string;
  originalScore: number;
  refinedScore: number;
  refinementReason: string;
  appliedSuggestions: RefinementSuggestion[];
  createdAt: Date;
}

export class SelfRefinementService {
  private static openai: OpenAI | null = null;

  private static getOpenAI(): OpenAI {
    if (!this.openai) {
      if (!config.openai.apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    }
    return this.openai;
  }

  private static defaultConfig: RefinementConfig = {
    maxIterations: 3,
    targetScore: 0.85,
    autoApply: false,
    preserveIntent: true,
    evaluateSafety: true,
    evaluateStyle: true,
    evaluateAccuracy: true,
  };

  /**
   * Execute self-refinement loop for a prompt
   */
  static async refinePrompt(
    promptId: string,
    testOutput: string,
    config: Partial<RefinementConfig> = {}
  ): Promise<RefinementResult> {
    const startTime = Date.now();
    const refinementConfig = { ...this.defaultConfig, ...config };

    // Get the current prompt
    const prompt = await prisma.marketplacePrompt.findUnique({
      where: { id: promptId },
      include: { promptVersions: { orderBy: { version: 'desc' }, take: 1 } },
    });

    if (!prompt) {
      throw new Error('Prompt not found');
    }

    const iterations: RefinementIteration[] = [];
    let currentPrompt = prompt.content;
    let currentScore = 0;
    let bestPrompt = currentPrompt;
    let bestScore = 0;

    // Initial evaluation
    const initialEvaluation = await OutputEvaluationService.evaluateOutput(
      { prompt: currentPrompt, output: testOutput },
      {
        accuracy: refinementConfig.evaluateAccuracy,
        style: refinementConfig.evaluateStyle,
        safety: refinementConfig.evaluateSafety,
      }
    );

    currentScore = initialEvaluation.overallScore;
    bestScore = currentScore;

    // Refinement loop
    for (let i = 0; i < refinementConfig.maxIterations; i++) {
      // Check if target score reached
      if (currentScore >= refinementConfig.targetScore) {
        break;
      }

      // Get current evaluation for suggestions
      const evaluation = i === 0 ? initialEvaluation : await OutputEvaluationService.evaluateOutput(
        { prompt: currentPrompt, output: testOutput },
        {
          accuracy: refinementConfig.evaluateAccuracy,
          style: refinementConfig.evaluateStyle,
          safety: refinementConfig.evaluateSafety,
        }
      );

      // Apply refinements based on suggestions
      const refinedPrompt = await this.applyRefinements(
        currentPrompt,
        evaluation.suggestedRefinements,
        refinementConfig.preserveIntent
      );

      // Evaluate the refined prompt
      const refinedEvaluation = await OutputEvaluationService.evaluateOutput(
        { prompt: refinedPrompt, output: testOutput },
        {
          accuracy: refinementConfig.evaluateAccuracy,
          style: refinementConfig.evaluateStyle,
          safety: refinementConfig.evaluateSafety,
        }
      );

      const improvement = refinedEvaluation.overallScore - currentScore;

      iterations.push({
        iteration: i + 1,
        originalPrompt: currentPrompt,
        refinedPrompt,
        evaluation: refinedEvaluation,
        appliedSuggestions: evaluation.suggestedRefinements,
        improvementDelta: improvement,
        timestamp: new Date(),
      });

      // Update best if improved
      if (refinedEvaluation.overallScore > bestScore) {
        bestPrompt = refinedPrompt;
        bestScore = refinedEvaluation.overallScore;
      }

      // Update current for next iteration
      currentPrompt = refinedPrompt;
      currentScore = refinedEvaluation.overallScore;

      // Stop if no improvement
      if (improvement <= 0) {
        break;
      }
    }

    const totalImprovement = bestScore - initialEvaluation.overallScore;

    // Store the refined version
    let versionId: string | undefined;
    if (totalImprovement > 0) {
      const version = await this.storeRefinedVersion(
        promptId,
        bestPrompt,
        prompt,
        iterations,
        bestScore
      );
      versionId = version.id;
    }

    return {
      success: totalImprovement > 0,
      originalPrompt: prompt.content,
      finalPrompt: bestPrompt,
      iterations,
      totalImprovement,
      finalScore: bestScore,
      versionId,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Apply refinement suggestions to a prompt
   */
  private static async applyRefinements(
    prompt: string,
    suggestions: RefinementSuggestion[],
    preserveIntent: boolean
  ): Promise<string> {
    if (suggestions.length === 0) {
      return prompt;
    }

    try {
      const openai = this.getOpenAI();

      const suggestionsList = suggestions
        .map((s, i) => `${i + 1}. [${s.type}] ${s.description}: "${s.suggestedChange}"`)
        .join('\n');

      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert prompt engineer. Your task is to refine the given prompt by applying the suggested improvements.

Guidelines:
- ${preserveIntent ? 'Preserve the original intent and core purpose of the prompt' : 'Focus on maximum improvement even if intent shifts slightly'}
- Apply suggestions thoughtfully, not mechanically
- Maintain coherence and readability
- Do not add unnecessary complexity
- Keep the same general structure unless improvement requires restructuring

Return ONLY the refined prompt text, nothing else.`,
          },
          {
            role: 'user',
            content: `Original Prompt:
${prompt}

Suggestions to apply:
${suggestionsList}

Please refine the prompt by incorporating these suggestions.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      });

      return response.choices[0]?.message?.content?.trim() || prompt;
    } catch (error) {
      console.error('Failed to apply refinements:', error);
      return prompt;
    }
  }

  /**
   * Store refined version in database
   */
  private static async storeRefinedVersion(
    promptId: string,
    refinedContent: string,
    originalPrompt: any,
    iterations: RefinementIteration[],
    finalScore: number
  ) {
    const refinementReasons = iterations
      .flatMap(i => i.appliedSuggestions.map(s => s.description))
      .join('; ');

    // Parse hierarchical components from refined content
    const components = this.parseHierarchicalComponents(refinedContent);

    return await PromptService.createPromptVersion(
      promptId,
      refinedContent,
      components,
      refinementReasons,
      finalScore
    );
  }

  /**
   * Parse hierarchical prompt components from text
   */
  private static parseHierarchicalComponents(content: string): HierarchicalPrompt {
    const components: HierarchicalPrompt = {};

    // Try to extract sections based on common patterns
    const systemMatch = content.match(/# System Instructions?\n([\s\S]*?)(?=\n# |$)/i);
    const processMatch = content.match(/# Process Guidelines?\n([\s\S]*?)(?=\n# |$)/i);
    const taskMatch = content.match(/# Task\n([\s\S]*?)(?=\n# |$)/i);
    const outputMatch = content.match(/# Output Format?\n([\s\S]*?)(?=\n# |$)/i);

    if (systemMatch) components.systemPrompt = systemMatch[1].trim();
    if (processMatch) components.processPrompt = processMatch[1].trim();
    if (taskMatch) components.taskPrompt = taskMatch[1].trim();
    if (outputMatch) components.outputPrompt = outputMatch[1].trim();

    // If no sections found, put everything in taskPrompt
    if (Object.keys(components).length === 0) {
      components.taskPrompt = content;
    }

    return components;
  }

  /**
   * Get refinement history for a prompt
   */
  static async getRefinementHistory(promptId: string): Promise<RefinementHistoryEntry[]> {
    const versions = await prisma.promptVersion.findMany({
      where: { promptId },
      orderBy: { version: 'desc' },
    });

    const history: RefinementHistoryEntry[] = [];

    for (let i = 0; i < versions.length - 1; i++) {
      const current = versions[i];
      const previous = versions[i + 1];

      history.push({
        id: current.id,
        promptId: current.promptId,
        version: current.version,
        originalContent: previous.content,
        refinedContent: current.content,
        originalScore: previous.qualityScore || 0,
        refinedScore: current.qualityScore || 0,
        refinementReason: current.refinementReason || '',
        appliedSuggestions: [],
        createdAt: current.createdAt,
      });
    }

    return history;
  }

  /**
   * Compare two versions and get diff
   */
  static async compareVersions(
    promptId: string,
    version1: number,
    version2: number
  ): Promise<{
    version1Content: string;
    version2Content: string;
    similarity: number;
    changes: string[];
    improvement: number;
  }> {
    const [v1, v2] = await Promise.all([
      prisma.promptVersion.findFirst({
        where: { promptId, version: version1 },
      }),
      prisma.promptVersion.findFirst({
        where: { promptId, version: version2 },
      }),
    ]);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const comparison = PromptService.compareVersions(v1.content, v2.content);

    return {
      version1Content: v1.content,
      version2Content: v2.content,
      similarity: comparison.similarity,
      changes: comparison.changes,
      improvement: (v2.qualityScore || 0) - (v1.qualityScore || 0),
    };
  }

  /**
   * Suggest refinements without applying them
   */
  static async suggestRefinements(
    promptContent: string,
    testOutput: string
  ): Promise<{
    currentScore: number;
    suggestions: RefinementSuggestion[];
    estimatedImprovement: number;
  }> {
    const evaluation = await OutputEvaluationService.evaluateOutput({
      prompt: promptContent,
      output: testOutput,
    });

    // Estimate improvement based on suggestion types
    let estimatedImprovement = 0;
    for (const suggestion of evaluation.suggestedRefinements) {
      switch (suggestion.priority) {
        case 'high':
          estimatedImprovement += 0.1;
          break;
        case 'medium':
          estimatedImprovement += 0.05;
          break;
        case 'low':
          estimatedImprovement += 0.02;
          break;
      }
    }

    estimatedImprovement = Math.min(estimatedImprovement, 1 - evaluation.overallScore);

    return {
      currentScore: evaluation.overallScore,
      suggestions: evaluation.suggestedRefinements,
      estimatedImprovement,
    };
  }

  /**
   * Run continuous refinement in background
   */
  static async startContinuousRefinement(
    promptId: string,
    testOutputs: string[],
    config: Partial<RefinementConfig> = {}
  ): Promise<{
    jobId: string;
    estimatedDuration: number;
  }> {
    // In a production environment, this would use a job queue
    // For now, we'll run it synchronously
    const jobId = `refinement_${promptId}_${Date.now()}`;

    // Run refinement for each test output
    const results: RefinementResult[] = [];
    for (const output of testOutputs) {
      const result = await this.refinePrompt(promptId, output, config);
      results.push(result);
    }

    return {
      jobId,
      estimatedDuration: testOutputs.length * 5000, // Estimate 5 seconds per output
    };
  }

  /**
   * Apply a specific version as the active version
   */
  static async applyVersion(promptId: string, versionId: string): Promise<boolean> {
    const version = await prisma.promptVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.promptId !== promptId) {
      throw new Error('Version not found or does not belong to this prompt');
    }

    await prisma.marketplacePrompt.update({
      where: { id: promptId },
      data: {
        content: version.content,
        systemPrompt: version.systemPrompt,
        processPrompt: version.processPrompt,
        taskPrompt: version.taskPrompt,
        outputPrompt: version.outputPrompt,
        successProbability: version.qualityScore,
      },
    });

    return true;
  }

  /**
   * Rollback to a previous version
   */
  static async rollbackToVersion(promptId: string, version: number): Promise<boolean> {
    const targetVersion = await prisma.promptVersion.findFirst({
      where: { promptId, version },
    });

    if (!targetVersion) {
      throw new Error('Target version not found');
    }

    await prisma.marketplacePrompt.update({
      where: { id: promptId },
      data: {
        content: targetVersion.content,
        systemPrompt: targetVersion.systemPrompt,
        processPrompt: targetVersion.processPrompt,
        taskPrompt: targetVersion.taskPrompt,
        outputPrompt: targetVersion.outputPrompt,
        successProbability: targetVersion.qualityScore,
      },
    });

    return true;
  }
}
