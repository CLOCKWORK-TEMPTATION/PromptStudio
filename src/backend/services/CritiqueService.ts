// ============================================================
// Critique Service - Epic 4.4
// LLM-based prompt critique with async job execution
// ============================================================

import { prisma } from '../lib/prisma.js';
import { lintPrompt, LintResult } from '../lib/lint/index.js';
import { techniquesService } from './TechniquesService.js';
import { budgetService } from './BudgetEnforcementService.js';

// ============================================================
// Types
// ============================================================

export type CritiqueMode = 'quick' | 'full' | 'deep';

export interface CritiqueIssue {
  id: string;
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  category: string;
  title: string;
  description: string;
  location?: {
    section: 'system' | 'developer' | 'user' | 'context';
    excerpt?: string;
  };
  recommendation?: string;
}

export interface CritiqueSuggestion {
  id: string;
  techniqueId?: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'minimal' | 'moderate' | 'significant';
  impact: string;
}

export interface CritiqueResultData {
  summary: string;
  overallScore: number;
  issues: CritiqueIssue[];
  suggestions: CritiqueSuggestion[];
  proposedPrompt?: {
    system?: string;
    developer?: string;
    user?: string;
    context?: string;
  };
  lintResults?: LintResult;
  analysisMetadata: {
    executionTimeMs: number;
    tokensUsed?: number;
    llmModel?: string;
    mode: CritiqueMode;
  };
}

export interface StartCritiqueInput {
  templateId: string;
  versionId?: string;
  mode?: CritiqueMode;
  workspaceId?: string;
  createdById?: string;
  budget?: {
    maxCalls?: number;
    maxTokens?: number;
    maxUSD?: number;
  };
}

interface PromptSnapshot {
  system?: string;
  developer?: string;
  user?: string;
  context?: string;
}

// ============================================================
// LLM Client Interface (to be injected)
// ============================================================

export interface LLMCritiqueClient {
  call(systemPrompt: string, userPrompt: string): Promise<string>;
  getTokenCount?(text: string): number;
}

let llmClient: LLMCritiqueClient | null = null;

export function setLLMCritiqueClient(client: LLMCritiqueClient): void {
  llmClient = client;
}

// ============================================================
// Critique Service
// ============================================================

export class CritiqueService {
  /**
   * Start a new critique run
   */
  async startCritique(input: StartCritiqueInput): Promise<{ runId: string }> {
    // Check budget if workspace specified
    if (input.workspaceId) {
      const budgetCheck = await budgetService.canStartOptimizationRun(input.workspaceId);
      if (!budgetCheck.allowed) {
        throw new Error(budgetCheck.reason || 'Budget exceeded');
      }
    }

    // Create the critique run
    const run = await prisma.critiqueRun.create({
      data: {
        templateId: input.templateId,
        versionId: input.versionId,
        mode: input.mode || 'full',
        status: 'queued',
        budget: input.budget || {},
        workspaceId: input.workspaceId,
        createdById: input.createdById,
      },
    });

    // Start async processing
    this.processCritiqueAsync(run.id).catch(err => {
      console.error('Error processing critique:', err);
    });

    return { runId: run.id };
  }

  /**
   * Get critique run status
   */
  async getCritiqueRun(runId: string) {
    const run = await prisma.critiqueRun.findUnique({
      where: { id: runId },
      include: { result: true },
    });

    return run;
  }

  /**
   * Get all critique runs for a template
   */
  async getCritiqueRunsForTemplate(templateId: string, limit = 10) {
    return prisma.critiqueRun.findMany({
      where: { templateId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { result: true },
    });
  }

  /**
   * Cancel a running critique
   */
  async cancelCritique(runId: string): Promise<void> {
    await prisma.critiqueRun.update({
      where: { id: runId },
      data: {
        status: 'canceled',
        finishedAt: new Date(),
      },
    });
  }

  /**
   * Process critique asynchronously
   */
  private async processCritiqueAsync(runId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Update status to running
      await prisma.critiqueRun.update({
        where: { id: runId },
        data: {
          status: 'running',
          startedAt: new Date(),
          progress: 10,
          stage: 'Loading template',
        },
      });

      // Get the run with template info
      const run = await prisma.critiqueRun.findUnique({
        where: { id: runId },
      });

      if (!run) {
        throw new Error('Run not found');
      }

      // Get the template version content
      const promptSnapshot = await this.getPromptSnapshot(run.templateId, run.versionId);

      // Update progress
      await prisma.critiqueRun.update({
        where: { id: runId },
        data: {
          progress: 20,
          stage: 'Running static analysis',
        },
      });

      // Step 1: Run static lint analysis
      const lintResults = lintPrompt(promptSnapshot);

      // Update progress
      await prisma.critiqueRun.update({
        where: { id: runId },
        data: {
          progress: 40,
          stage: 'Performing LLM critique',
        },
      });

      // Step 2: Run LLM critique
      const critiqueData = await this.performLLMCritique(
        promptSnapshot,
        run.mode as CritiqueMode,
        lintResults
      );

      // Update progress
      await prisma.critiqueRun.update({
        where: { id: runId },
        data: {
          progress: 70,
          stage: 'Generating suggestions',
        },
      });

      // Step 3: Match suggestions to techniques
      const suggestions = await this.matchTechniques(critiqueData.issues, run.workspaceId);

      // Update progress
      await prisma.critiqueRun.update({
        where: { id: runId },
        data: {
          progress: 90,
          stage: 'Generating improved prompt',
        },
      });

      // Step 4: Generate proposed improved prompt
      const proposedPrompt = await this.generateImprovedPrompt(
        promptSnapshot,
        critiqueData.issues,
        suggestions
      );

      // Calculate execution time
      const executionTimeMs = Date.now() - startTime;

      // Create the result
      await prisma.critiqueResult.create({
        data: {
          runId,
          summary: critiqueData.summary,
          overallScore: critiqueData.overallScore,
          issuesJson: critiqueData.issues,
          suggestionsJson: [...critiqueData.suggestions, ...suggestions],
          proposedPromptSnapshot: proposedPrompt,
          analysisMetadata: {
            executionTimeMs,
            tokensUsed: critiqueData.tokensUsed,
            llmModel: critiqueData.llmModel,
            mode: run.mode,
            lintScore: lintResults.score,
          },
        },
      });

      // Update run status to completed
      await prisma.critiqueRun.update({
        where: { id: runId },
        data: {
          status: 'completed',
          progress: 100,
          stage: 'Complete',
          finishedAt: new Date(),
          cost: {
            calls: 1,
            tokens: critiqueData.tokensUsed || 0,
            usdEstimate: (critiqueData.tokensUsed || 0) * 0.00001, // Rough estimate
          },
        },
      });

      // Record cost if workspace specified
      if (run.workspaceId) {
        await budgetService.recordRunCost(run.workspaceId, {
          calls: 1,
          tokens: critiqueData.tokensUsed || 0,
          usd: (critiqueData.tokensUsed || 0) * 0.00001,
        });
      }
    } catch (error) {
      console.error('Critique processing error:', error);

      // Update run status to failed
      await prisma.critiqueRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          errorMessage: (error as Error).message,
          finishedAt: new Date(),
        },
      });
    }
  }

  /**
   * Get prompt snapshot from template/version
   */
  private async getPromptSnapshot(
    templateId: string,
    versionId?: string | null
  ): Promise<PromptSnapshot> {
    if (versionId) {
      const version = await prisma.templateVersion.findUnique({
        where: { id: versionId },
      });

      if (version) {
        const snapshot = version.contentSnapshot as Record<string, unknown>;
        return {
          system: (snapshot.system as string) || '',
          developer: (snapshot.developer as string) || '',
          user: (snapshot.user as string) || '',
          context: (snapshot.context as string) || '',
        };
      }
    }

    // Get active version from template
    const template = await prisma.promptTemplate.findUnique({
      where: { id: templateId },
      include: {
        versions: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (template?.versions[0]) {
      const snapshot = template.versions[0].contentSnapshot as Record<string, unknown>;
      return {
        system: (snapshot.system as string) || '',
        developer: (snapshot.developer as string) || '',
        user: (snapshot.user as string) || '',
        context: (snapshot.context as string) || '',
      };
    }

    return { system: '', developer: '', user: '', context: '' };
  }

  /**
   * Perform LLM-based critique
   */
  private async performLLMCritique(
    prompt: PromptSnapshot,
    mode: CritiqueMode,
    lintResults: LintResult
  ): Promise<{
    summary: string;
    overallScore: number;
    issues: CritiqueIssue[];
    suggestions: CritiqueSuggestion[];
    tokensUsed?: number;
    llmModel?: string;
  }> {
    // If no LLM client, return mock/basic results
    if (!llmClient) {
      return this.generateBasicCritique(prompt, lintResults);
    }

    const systemPrompt = this.buildCritiqueSystemPrompt(mode);
    const userPrompt = this.buildCritiqueUserPrompt(prompt, lintResults);

    try {
      const response = await llmClient.call(systemPrompt, userPrompt);
      const parsed = JSON.parse(response);

      return {
        summary: parsed.summary || 'Critique completed',
        overallScore: parsed.overallScore || lintResults.score,
        issues: (parsed.issues || []).map((issue: Record<string, unknown>, idx: number) => ({
          id: `llm-issue-${idx}`,
          severity: issue.severity || 'minor',
          category: issue.category || 'general',
          title: issue.title || 'Issue',
          description: issue.description || '',
          location: issue.location,
          recommendation: issue.recommendation,
        })),
        suggestions: (parsed.suggestions || []).map((sug: Record<string, unknown>, idx: number) => ({
          id: `llm-sug-${idx}`,
          title: sug.title || 'Suggestion',
          description: sug.description || '',
          priority: sug.priority || 'medium',
          effort: sug.effort || 'moderate',
          impact: sug.impact || 'Improves prompt quality',
        })),
        tokensUsed: llmClient.getTokenCount?.(systemPrompt + userPrompt + response) || 0,
        llmModel: 'gpt-4',
      };
    } catch (error) {
      console.error('LLM critique error:', error);
      return this.generateBasicCritique(prompt, lintResults);
    }
  }

  /**
   * Generate basic critique from lint results (when no LLM)
   */
  private generateBasicCritique(
    prompt: PromptSnapshot,
    lintResults: LintResult
  ): {
    summary: string;
    overallScore: number;
    issues: CritiqueIssue[];
    suggestions: CritiqueSuggestion[];
  } {
    const issues: CritiqueIssue[] = lintResults.issues.map((issue, idx) => ({
      id: `lint-${idx}`,
      severity: issue.severity === 'error' ? 'critical' : issue.severity === 'warning' ? 'major' : 'minor',
      category: issue.category,
      title: issue.message.split('.')[0],
      description: issue.message,
      location: issue.location,
      recommendation: issue.suggestion,
    }));

    const suggestions: CritiqueSuggestion[] = [];

    // Add suggestions based on analysis
    const totalLength = Object.values(prompt).filter(Boolean).join('').length;

    if (totalLength < 50) {
      suggestions.push({
        id: 'sug-length',
        title: 'Expand prompt detail',
        description: 'The prompt is quite short. Consider adding more context, examples, or constraints.',
        priority: 'high',
        effort: 'moderate',
        impact: 'Better model understanding and more accurate outputs',
      });
    }

    if (!prompt.system) {
      suggestions.push({
        id: 'sug-system',
        title: 'Add system prompt',
        description: 'Define a clear role and behavioral context in the system prompt.',
        priority: 'high',
        effort: 'minimal',
        impact: 'Consistent behavior across conversations',
      });
    }

    const summary = lintResults.valid
      ? `Prompt passes basic quality checks with a score of ${lintResults.score}/100. ${issues.length} areas for improvement identified.`
      : `Prompt has ${lintResults.summary.errors} critical issues that should be addressed. Overall score: ${lintResults.score}/100.`;

    return {
      summary,
      overallScore: lintResults.score,
      issues,
      suggestions,
    };
  }

  /**
   * Build system prompt for LLM critique
   */
  private buildCritiqueSystemPrompt(mode: CritiqueMode): string {
    const basePrompt = `You are an expert prompt engineer tasked with critiquing and improving AI prompts.
Analyze the provided prompt for:
1. Clarity and specificity
2. Structural organization
3. Safety and potential misuse
4. Performance optimization
5. Best practices adherence

Respond with valid JSON matching this schema:
{
  "summary": "Brief overall assessment",
  "overallScore": 0-100,
  "issues": [
    {
      "severity": "critical|major|minor|suggestion",
      "category": "clarity|structure|safety|performance|best_practice",
      "title": "Short issue title",
      "description": "Detailed description",
      "location": { "section": "system|developer|user", "excerpt": "relevant text" },
      "recommendation": "How to fix"
    }
  ],
  "suggestions": [
    {
      "title": "Suggestion title",
      "description": "What to improve",
      "priority": "high|medium|low",
      "effort": "minimal|moderate|significant",
      "impact": "Expected benefit"
    }
  ]
}`;

    if (mode === 'quick') {
      return basePrompt + '\n\nFocus on the most critical issues only. Limit to top 3 issues.';
    } else if (mode === 'deep') {
      return basePrompt + '\n\nPerform exhaustive analysis. Include all issues, even minor ones. Provide detailed recommendations.';
    }

    return basePrompt;
  }

  /**
   * Build user prompt for LLM critique
   */
  private buildCritiqueUserPrompt(prompt: PromptSnapshot, lintResults: LintResult): string {
    let userPrompt = 'Please critique the following prompt:\n\n';

    if (prompt.system) {
      userPrompt += `## System Prompt\n${prompt.system}\n\n`;
    }
    if (prompt.developer) {
      userPrompt += `## Developer/Assistant Prompt\n${prompt.developer}\n\n`;
    }
    if (prompt.user) {
      userPrompt += `## User Prompt Template\n${prompt.user}\n\n`;
    }
    if (prompt.context) {
      userPrompt += `## Context\n${prompt.context}\n\n`;
    }

    if (lintResults.issues.length > 0) {
      userPrompt += '## Static Analysis Results\n';
      userPrompt += `Score: ${lintResults.score}/100\n`;
      userPrompt += `Issues found:\n`;
      for (const issue of lintResults.issues.slice(0, 5)) {
        userPrompt += `- [${issue.severity.toUpperCase()}] ${issue.message}\n`;
      }
    }

    return userPrompt;
  }

  /**
   * Match issues to relevant techniques
   */
  private async matchTechniques(
    issues: CritiqueIssue[],
    workspaceId?: string | null
  ): Promise<CritiqueSuggestion[]> {
    const techniques = await techniquesService.listTechniques({
      workspaceId: workspaceId || undefined,
      isActive: true,
    });

    const suggestions: CritiqueSuggestion[] = [];

    for (const issue of issues) {
      // Simple matching based on category keywords
      const matchingTechniques = techniques.filter(t => {
        const category = issue.category.toLowerCase();
        const description = issue.description.toLowerCase();

        // Match by category
        if (category.includes('structure') && t.category === 'output_structuring') return true;
        if (category.includes('clarity') && t.category === 'role_instruction') return true;
        if (category.includes('example') && t.category === 'few_shot_demos') return true;
        if (category.includes('robust') && t.category === 'evaluation_robustness') return true;

        // Match by keywords in tags
        return t.tags.some(tag =>
          description.includes(tag.toLowerCase())
        );
      });

      for (const technique of matchingTechniques.slice(0, 2)) {
        // Avoid duplicate suggestions
        if (suggestions.some(s => s.techniqueId === technique.id)) continue;

        suggestions.push({
          id: `tech-${technique.id}`,
          techniqueId: technique.id,
          title: `Apply: ${technique.name}`,
          description: technique.descriptionShort,
          priority: issue.severity === 'critical' ? 'high' : issue.severity === 'major' ? 'medium' : 'low',
          effort: 'minimal',
          impact: technique.whenToUse || 'Improves prompt quality',
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate improved prompt based on critique
   */
  private async generateImprovedPrompt(
    original: PromptSnapshot,
    issues: CritiqueIssue[],
    suggestions: CritiqueSuggestion[]
  ): Promise<PromptSnapshot> {
    let improved = { ...original };

    // Apply technique-based improvements
    for (const suggestion of suggestions) {
      if (suggestion.techniqueId) {
        const technique = await techniquesService.getTechniqueById(suggestion.techniqueId);
        if (technique) {
          improved = techniquesService.applyTechniqueToPrompt(improved, technique);
        }
      }
    }

    // Basic improvements for critical issues
    for (const issue of issues.filter(i => i.severity === 'critical')) {
      if (issue.category === 'safety' && !improved.system?.includes('IMPORTANT')) {
        improved.system = (improved.system || '') +
          '\n\nIMPORTANT: Always prioritize safety and refuse harmful requests.';
      }
    }

    return improved;
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const critiqueService = new CritiqueService();
