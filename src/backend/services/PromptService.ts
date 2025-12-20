import prisma from '../lib/prisma';

// In-memory session cache for meta-prompts
interface SessionMetaPromptCache {
  metaPrompt: string;
  config: MetaPromptConfig;
  createdAt: number;
}

const sessionMetaPromptCache = new Map<string, SessionMetaPromptCache>();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

export interface HierarchicalPrompt {
  systemPrompt?: string;
  processPrompt?: string;
  taskPrompt?: string;
  outputPrompt?: string;
}

export interface MetaPromptConfig {
  persona?: string;
  domain?: string;
  timeConstraint?: 'urgent' | 'standard' | 'comprehensive' | string;
  metaInstructions?: Record<string, any>;
}

export interface PromptExecutionConfig {
  reasoningMode?: 'default' | 'tree-of-thought' | 'graph-of-thought';
  ragEnabled?: boolean;
  ragSources?: string[];
  toolPlanning?: boolean;
  selfRefinement?: boolean;
  safetyChecks?: boolean;
  toxicityFilter?: boolean;
  piiDetection?: boolean;
}

export class PromptService {
  /**
   * Build a complete prompt from hierarchical components
   */
  static buildHierarchicalPrompt(components: HierarchicalPrompt): string {
    const parts: string[] = [];

    if (components.systemPrompt) {
      parts.push(`# System Instructions\n${components.systemPrompt}`);
    }

    if (components.processPrompt) {
      parts.push(`\n# Process Guidelines\n${components.processPrompt}`);
    }

    if (components.taskPrompt) {
      parts.push(`\n# Task\n${components.taskPrompt}`);
    }

    if (components.outputPrompt) {
      parts.push(`\n# Output Format\n${components.outputPrompt}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Generate meta-prompt based on persona, domain, and time constraints
   */
  static generateMetaPrompt(config: MetaPromptConfig): string {
    const parts: string[] = [];

    // Persona-based instructions
    if (config.persona) {
      parts.push(`You are acting as a ${config.persona}.`);
    }

    // Domain-specific expertise
    if (config.domain) {
      parts.push(`You are an expert in the ${config.domain} domain.`);
    }

    // Time constraint handling
    if (config.timeConstraint) {
      const timeInstructions: Record<string, string> = {
        urgent: 'Provide a concise, direct response focusing on immediate action items. Prioritize speed and clarity over comprehensive details.',
        standard: 'Provide a balanced response with clear explanations and practical guidance.',
        comprehensive: 'Provide a thorough, detailed response with extensive context, examples, and considerations. Take time to explore edge cases and alternative approaches.',
      };

      const instruction = timeInstructions[config.timeConstraint] || timeInstructions.standard;
      parts.push(instruction);
    }

    // Additional meta-instructions
    if (config.metaInstructions) {
      const { tone, style, expertise, constraints, language, format } = config.metaInstructions as any;

      if (tone) {
        parts.push(`Use a ${tone} tone.`);
      }

      if (style) {
        parts.push(`Follow a ${style} style.`);
      }

      if (expertise) {
        parts.push(`Apply ${expertise} level expertise.`);
      }

      if (language) {
        parts.push(`Respond in ${language} language.`);
      }

      if (format) {
        parts.push(`Format output as ${format}.`);
      }

      if (constraints) {
        parts.push(`Constraints: ${constraints}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Generate and cache session-fixed meta-prompt
   * Ensures consistency across a user session by caching the generated meta-prompt
   */
  static generateSessionMetaPrompt(sessionId: string, config: MetaPromptConfig): string {
    // Check if cached meta-prompt exists and is still valid
    const cached = sessionMetaPromptCache.get(sessionId);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL) {
      // Verify config hasn't changed
      if (
        cached.config.persona === config.persona &&
        cached.config.domain === config.domain &&
        cached.config.timeConstraint === config.timeConstraint
      ) {
        return cached.metaPrompt;
      }
    }

    // Generate new meta-prompt
    const metaPrompt = this.generateMetaPrompt(config);

    // Cache for session
    sessionMetaPromptCache.set(sessionId, {
      metaPrompt,
      config,
      createdAt: Date.now(),
    });

    return metaPrompt;
  }

  /**
   * Clear session meta-prompt cache
   */
  static clearSessionMetaPrompt(sessionId: string): void {
    sessionMetaPromptCache.delete(sessionId);
  }

  /**
   * Clear expired cache entries
   */
  static cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [sessionId, cache] of sessionMetaPromptCache.entries()) {
      if (now - cache.createdAt >= CACHE_TTL) {
        sessionMetaPromptCache.delete(sessionId);
      }
    }
  }

  /**
   * Estimate token count for a prompt
   */
  static estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate cost based on model and tokens
   */
  static estimateCost(tokens: number, model: string = 'gpt-4'): number {
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4': { input: 0.03, output: 0.06 }, // per 1K tokens
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
    };

    const modelPricing = pricing[model] || pricing['gpt-4'];
    const avgCostPerToken = (modelPricing.input + modelPricing.output) / 2;

    return (tokens / 1000) * avgCostPerToken;
  }

  /**
   * Calculate success probability based on prompt quality metrics
   */
  static async calculateSuccessProbability(prompt: string): Promise<number> {
    // Simple heuristic-based scoring
    let score = 0.5; // base score

    // Check for clear structure
    if (prompt.includes('#') || prompt.includes('##')) {
      score += 0.1;
    }

    // Check for examples
    if (prompt.toLowerCase().includes('example') || prompt.includes('e.g.')) {
      score += 0.1;
    }

    // Check for output format specification
    if (prompt.toLowerCase().includes('format') || prompt.toLowerCase().includes('output')) {
      score += 0.1;
    }

    // Check length (not too short, not too long)
    const tokens = this.estimateTokens(prompt);
    if (tokens >= 50 && tokens <= 2000) {
      score += 0.1;
    }

    // Check for clear instructions
    const instructionKeywords = ['must', 'should', 'will', 'always', 'never'];
    const hasInstructions = instructionKeywords.some(kw =>
      prompt.toLowerCase().includes(kw)
    );
    if (hasInstructions) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Create a new prompt version for self-refinement
   */
  static async createPromptVersion(
    promptId: string,
    content: string,
    components: HierarchicalPrompt,
    refinementReason?: string,
    qualityScore?: number
  ) {
    // Get the latest version number
    const latestVersion = await prisma.promptVersion.findFirst({
      where: { promptId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const newVersion = (latestVersion?.version || 0) + 1;

    return await prisma.promptVersion.create({
      data: {
        promptId,
        version: newVersion,
        content,
        systemPrompt: components.systemPrompt,
        processPrompt: components.processPrompt,
        taskPrompt: components.taskPrompt,
        outputPrompt: components.outputPrompt,
        refinementReason,
        qualityScore,
      },
    });
  }

  /**
   * Get prompt version history
   */
  static async getPromptVersions(promptId: string) {
    return await prisma.promptVersion.findMany({
      where: { promptId },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Compare two prompt versions
   */
  static compareVersions(v1: string, v2: string): {
    similarity: number;
    changes: string[];
  } {
    const changes: string[] = [];

    // Simple line-by-line comparison
    const lines1 = v1.split('\n');
    const lines2 = v2.split('\n');

    let matchingLines = 0;
    const maxLines = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLines; i++) {
      if (lines1[i] === lines2[i]) {
        matchingLines++;
      } else {
        if (lines1[i] && !lines2[i]) {
          changes.push(`Removed line ${i + 1}: ${lines1[i]}`);
        } else if (!lines1[i] && lines2[i]) {
          changes.push(`Added line ${i + 1}: ${lines2[i]}`);
        } else {
          changes.push(`Modified line ${i + 1}`);
        }
      }
    }

    const similarity = matchingLines / maxLines;

    return { similarity, changes };
  }

  /**
   * Update prompt with pre-send analysis
   */
  static async updatePromptWithAnalysis(promptId: string, content: string) {
    const tokens = this.estimateTokens(content);
    const model = 'gpt-4'; // default
    const cost = this.estimateCost(tokens, model);
    const successProbability = await this.calculateSuccessProbability(content);

    return await prisma.marketplacePrompt.update({
      where: { id: promptId },
      data: {
        content,
        estimatedTokens: tokens,
        estimatedCost: cost,
        successProbability,
      },
    });
  }

  /**
   * Get prompt with all versions for refinement history
   */
  static async getPromptWithHistory(promptId: string) {
    return await prisma.marketplacePrompt.findUnique({
      where: { id: promptId },
      include: {
        promptVersions: {
          orderBy: { version: 'desc' },
        },
      },
    });
  }

  /**
   * Get version diff between two versions
   */
  static async getVersionDiff(promptId: string, fromVersion: number, toVersion: number) {
    const [from, to] = await Promise.all([
      prisma.promptVersion.findFirst({
        where: { promptId, version: fromVersion },
      }),
      prisma.promptVersion.findFirst({
        where: { promptId, version: toVersion },
      }),
    ]);

    if (!from || !to) {
      throw new Error('One or both versions not found');
    }

    const comparison = this.compareVersions(from.content, to.content);

    return {
      from: {
        version: from.version,
        content: from.content,
        qualityScore: from.qualityScore,
        createdAt: from.createdAt,
      },
      to: {
        version: to.version,
        content: to.content,
        qualityScore: to.qualityScore,
        createdAt: to.createdAt,
      },
      diff: comparison,
      improvement: (to.qualityScore || 0) - (from.qualityScore || 0),
    };
  }

  /**
   * Create initial version when enabling self-refinement
   */
  static async initializeVersionHistory(promptId: string) {
    const prompt = await prisma.marketplacePrompt.findUnique({
      where: { id: promptId },
    });

    if (!prompt) {
      throw new Error('Prompt not found');
    }

    // Check if version 1 already exists
    const existingVersion = await prisma.promptVersion.findFirst({
      where: { promptId, version: 1 },
    });

    if (existingVersion) {
      return existingVersion;
    }

    // Create initial version
    return await prisma.promptVersion.create({
      data: {
        promptId,
        version: 1,
        content: prompt.content,
        systemPrompt: prompt.systemPrompt,
        processPrompt: prompt.processPrompt,
        taskPrompt: prompt.taskPrompt,
        outputPrompt: prompt.outputPrompt,
        qualityScore: prompt.successProbability,
        refinementReason: 'Initial version',
      },
    });
  }

  /**
   * Get refinement analytics for a prompt
   */
  static async getRefinementAnalytics(promptId: string) {
    const versions = await prisma.promptVersion.findMany({
      where: { promptId },
      orderBy: { version: 'asc' },
    });

    if (versions.length === 0) {
      return null;
    }

    const firstVersion = versions[0];
    const latestVersion = versions[versions.length - 1];

    const totalImprovement = (latestVersion.qualityScore || 0) - (firstVersion.qualityScore || 0);
    const averageImprovement = versions.length > 1
      ? totalImprovement / (versions.length - 1)
      : 0;

    const scoreHistory = versions.map(v => ({
      version: v.version,
      score: v.qualityScore || 0,
      createdAt: v.createdAt,
    }));

    return {
      totalVersions: versions.length,
      initialScore: firstVersion.qualityScore || 0,
      currentScore: latestVersion.qualityScore || 0,
      totalImprovement,
      averageImprovement,
      scoreHistory,
      refinementReasons: versions
        .filter(v => v.refinementReason)
        .map(v => ({
          version: v.version,
          reason: v.refinementReason,
        })),
    };
  }
}
