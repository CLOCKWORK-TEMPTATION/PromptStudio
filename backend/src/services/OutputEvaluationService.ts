import OpenAI from 'openai';
import { config } from '../config/index.js';
import { SafetyService, SafetyCheckResult } from './SafetyService.js';

export interface EvaluationCriteria {
  accuracy: boolean;
  style: boolean;
  safety: boolean;
  relevance: boolean;
  completeness: boolean;
}

export interface AccuracyScore {
  score: number;
  factualCorrectness: number;
  logicalConsistency: number;
  relevanceToPrompt: number;
  issues: string[];
}

export interface StyleScore {
  score: number;
  clarity: number;
  coherence: number;
  toneMatch: number;
  formatting: number;
  issues: string[];
}

export interface EvaluationResult {
  overallScore: number;
  accuracy: AccuracyScore;
  style: StyleScore;
  safety: SafetyCheckResult;
  relevance: {
    score: number;
    issues: string[];
  };
  completeness: {
    score: number;
    missingElements: string[];
  };
  improvements: string[];
  suggestedRefinements: RefinementSuggestion[];
  evaluatedAt: Date;
}

export interface RefinementSuggestion {
  type: 'add_clarity' | 'improve_structure' | 'add_examples' | 'specify_output' | 'add_constraints' | 'safety_improvement';
  priority: 'high' | 'medium' | 'low';
  description: string;
  suggestedChange: string;
  affectedSection: 'system' | 'process' | 'task' | 'output' | 'general';
}

export interface OutputExecutionContext {
  prompt: string;
  output: string;
  expectedOutput?: string;
  model?: string;
  executionTime?: number;
  tokenCount?: number;
}

export class OutputEvaluationService {
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

  /**
   * Perform comprehensive evaluation of prompt output
   */
  static async evaluateOutput(
    context: OutputExecutionContext,
    criteria: Partial<EvaluationCriteria> = {}
  ): Promise<EvaluationResult> {
    const {
      accuracy = true,
      style = true,
      safety = true,
      relevance = true,
      completeness = true,
    } = criteria;

    // Run evaluations in parallel
    const [accuracyResult, styleResult, safetyResult, relevanceResult, completenessResult] =
      await Promise.all([
        accuracy ? this.evaluateAccuracy(context) : this.getDefaultAccuracyScore(),
        style ? this.evaluateStyle(context) : this.getDefaultStyleScore(),
        safety ? SafetyService.performSafetyCheck(context.output) : this.getDefaultSafetyResult(),
        relevance ? this.evaluateRelevance(context) : { score: 1, issues: [] },
        completeness ? this.evaluateCompleteness(context) : { score: 1, missingElements: [] },
      ]);

    // Calculate overall score
    const overallScore = this.calculateOverallScore({
      accuracy: accuracyResult.score,
      style: styleResult.score,
      safety: safetyResult.passed ? 1 : 0.5,
      relevance: relevanceResult.score,
      completeness: completenessResult.score,
    });

    // Generate improvement suggestions
    const improvements = this.generateImprovements(
      accuracyResult,
      styleResult,
      safetyResult,
      relevanceResult,
      completenessResult
    );

    // Generate refinement suggestions for the prompt
    const suggestedRefinements = await this.generateRefinementSuggestions(
      context,
      accuracyResult,
      styleResult,
      safetyResult
    );

    return {
      overallScore,
      accuracy: accuracyResult,
      style: styleResult,
      safety: safetyResult,
      relevance: relevanceResult,
      completeness: completenessResult,
      improvements,
      suggestedRefinements,
      evaluatedAt: new Date(),
    };
  }

  /**
   * Evaluate accuracy of the output
   */
  private static async evaluateAccuracy(context: OutputExecutionContext): Promise<AccuracyScore> {
    try {
      const openai = this.getOpenAI();

      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert evaluator. Analyze the output for accuracy based on the given prompt.
Return a JSON object with:
- factualCorrectness: 0-1 score for factual accuracy
- logicalConsistency: 0-1 score for logical flow
- relevanceToPrompt: 0-1 score for how well it addresses the prompt
- issues: array of specific accuracy issues found

Be strict and objective.`,
          },
          {
            role: 'user',
            content: `Prompt: ${context.prompt}\n\nOutput: ${context.output}${
              context.expectedOutput ? `\n\nExpected Output: ${context.expectedOutput}` : ''
            }`,
          },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      const score = (
        (result.factualCorrectness || 0.7) +
        (result.logicalConsistency || 0.7) +
        (result.relevanceToPrompt || 0.7)
      ) / 3;

      return {
        score,
        factualCorrectness: result.factualCorrectness || 0.7,
        logicalConsistency: result.logicalConsistency || 0.7,
        relevanceToPrompt: result.relevanceToPrompt || 0.7,
        issues: result.issues || [],
      };
    } catch (error) {
      console.error('Accuracy evaluation failed:', error);
      return this.getDefaultAccuracyScore();
    }
  }

  /**
   * Evaluate style of the output
   */
  private static async evaluateStyle(context: OutputExecutionContext): Promise<StyleScore> {
    try {
      const openai = this.getOpenAI();

      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert writing evaluator. Analyze the output for style quality.
Return a JSON object with:
- clarity: 0-1 score for how clear and understandable the text is
- coherence: 0-1 score for logical flow and structure
- toneMatch: 0-1 score for appropriate tone based on context
- formatting: 0-1 score for proper formatting and organization
- issues: array of specific style issues found

Be objective and constructive.`,
          },
          {
            role: 'user',
            content: `Prompt: ${context.prompt}\n\nOutput: ${context.output}`,
          },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      const score = (
        (result.clarity || 0.7) +
        (result.coherence || 0.7) +
        (result.toneMatch || 0.7) +
        (result.formatting || 0.7)
      ) / 4;

      return {
        score,
        clarity: result.clarity || 0.7,
        coherence: result.coherence || 0.7,
        toneMatch: result.toneMatch || 0.7,
        formatting: result.formatting || 0.7,
        issues: result.issues || [],
      };
    } catch (error) {
      console.error('Style evaluation failed:', error);
      return this.getDefaultStyleScore();
    }
  }

  /**
   * Evaluate relevance to prompt
   */
  private static async evaluateRelevance(
    context: OutputExecutionContext
  ): Promise<{ score: number; issues: string[] }> {
    try {
      const openai = this.getOpenAI();

      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `Evaluate how relevant the output is to the given prompt.
Return JSON: { "score": 0-1, "issues": ["issue1", "issue2"] }`,
          },
          {
            role: 'user',
            content: `Prompt: ${context.prompt}\n\nOutput: ${context.output}`,
          },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        score: result.score || 0.7,
        issues: result.issues || [],
      };
    } catch (error) {
      console.error('Relevance evaluation failed:', error);
      return { score: 0.7, issues: [] };
    }
  }

  /**
   * Evaluate completeness of the output
   */
  private static async evaluateCompleteness(
    context: OutputExecutionContext
  ): Promise<{ score: number; missingElements: string[] }> {
    try {
      const openai = this.getOpenAI();

      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `Evaluate how complete the output is in addressing all aspects of the prompt.
Return JSON: { "score": 0-1, "missingElements": ["element1", "element2"] }`,
          },
          {
            role: 'user',
            content: `Prompt: ${context.prompt}\n\nOutput: ${context.output}`,
          },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        score: result.score || 0.7,
        missingElements: result.missingElements || [],
      };
    } catch (error) {
      console.error('Completeness evaluation failed:', error);
      return { score: 0.7, missingElements: [] };
    }
  }

  /**
   * Generate refinement suggestions based on evaluation results
   */
  private static async generateRefinementSuggestions(
    context: OutputExecutionContext,
    accuracy: AccuracyScore,
    style: StyleScore,
    safety: SafetyCheckResult
  ): Promise<RefinementSuggestion[]> {
    const suggestions: RefinementSuggestion[] = [];

    // Accuracy-based suggestions
    if (accuracy.score < 0.7) {
      if (accuracy.factualCorrectness < 0.7) {
        suggestions.push({
          type: 'add_constraints',
          priority: 'high',
          description: 'Add explicit constraints for factual accuracy',
          suggestedChange: 'Add instruction: "Ensure all facts are verified and accurate. Cite sources when possible."',
          affectedSection: 'system',
        });
      }
      if (accuracy.logicalConsistency < 0.7) {
        suggestions.push({
          type: 'improve_structure',
          priority: 'high',
          description: 'Improve logical flow requirements',
          suggestedChange: 'Add instruction: "Present information in a logical, step-by-step manner."',
          affectedSection: 'process',
        });
      }
    }

    // Style-based suggestions
    if (style.score < 0.7) {
      if (style.clarity < 0.7) {
        suggestions.push({
          type: 'add_clarity',
          priority: 'medium',
          description: 'Add clarity requirements',
          suggestedChange: 'Add instruction: "Use clear, simple language. Avoid jargon unless necessary."',
          affectedSection: 'system',
        });
      }
      if (style.formatting < 0.7) {
        suggestions.push({
          type: 'specify_output',
          priority: 'medium',
          description: 'Specify output format requirements',
          suggestedChange: 'Add instruction: "Format output with clear headings, bullet points, and proper spacing."',
          affectedSection: 'output',
        });
      }
    }

    // Safety-based suggestions
    if (!safety.passed) {
      suggestions.push({
        type: 'safety_improvement',
        priority: 'high',
        description: 'Add safety constraints',
        suggestedChange: 'Add instruction: "Avoid harmful, biased, or sensitive content. Use inclusive language."',
        affectedSection: 'system',
      });
    }

    // Try to get AI-generated refinement suggestions
    try {
      const openai = this.getOpenAI();

      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `You are a prompt engineering expert. Analyze the prompt and its output, then suggest specific improvements to the prompt.
Return a JSON array of suggestions:
[{
  "type": "add_clarity" | "improve_structure" | "add_examples" | "specify_output" | "add_constraints",
  "priority": "high" | "medium" | "low",
  "description": "brief description",
  "suggestedChange": "specific text to add or modify",
  "affectedSection": "system" | "process" | "task" | "output" | "general"
}]
Return max 3 most impactful suggestions.`,
          },
          {
            role: 'user',
            content: `Original Prompt: ${context.prompt}\n\nOutput: ${context.output.slice(0, 1000)}...`,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      if (Array.isArray(result.suggestions)) {
        suggestions.push(...result.suggestions);
      } else if (Array.isArray(result)) {
        suggestions.push(...result);
      }
    } catch (error) {
      console.error('Failed to generate AI refinement suggestions:', error);
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return suggestions.slice(0, 5); // Limit to top 5 suggestions
  }

  /**
   * Calculate overall score from individual scores
   */
  private static calculateOverallScore(scores: {
    accuracy: number;
    style: number;
    safety: number;
    relevance: number;
    completeness: number;
  }): number {
    // Weighted average with safety having higher weight
    const weights = {
      accuracy: 0.25,
      style: 0.15,
      safety: 0.25,
      relevance: 0.20,
      completeness: 0.15,
    };

    return (
      scores.accuracy * weights.accuracy +
      scores.style * weights.style +
      scores.safety * weights.safety +
      scores.relevance * weights.relevance +
      scores.completeness * weights.completeness
    );
  }

  /**
   * Generate improvement suggestions
   */
  private static generateImprovements(
    accuracy: AccuracyScore,
    style: StyleScore,
    safety: SafetyCheckResult,
    relevance: { score: number; issues: string[] },
    completeness: { score: number; missingElements: string[] }
  ): string[] {
    const improvements: string[] = [];

    // Accuracy improvements
    if (accuracy.issues.length > 0) {
      improvements.push(...accuracy.issues.map(i => `Accuracy: ${i}`));
    }

    // Style improvements
    if (style.issues.length > 0) {
      improvements.push(...style.issues.map(i => `Style: ${i}`));
    }

    // Safety recommendations
    if (safety.recommendations.length > 0) {
      improvements.push(...safety.recommendations.map(r => `Safety: ${r}`));
    }

    // Relevance improvements
    if (relevance.issues.length > 0) {
      improvements.push(...relevance.issues.map(i => `Relevance: ${i}`));
    }

    // Completeness improvements
    if (completeness.missingElements.length > 0) {
      improvements.push(
        `Completeness: Missing elements - ${completeness.missingElements.join(', ')}`
      );
    }

    return improvements;
  }

  /**
   * Quick evaluation for real-time feedback
   */
  static async quickEvaluate(output: string): Promise<{
    score: number;
    category: 'excellent' | 'good' | 'fair' | 'poor';
    quickFeedback: string;
  }> {
    const safetyResult = await SafetyService.performSafetyCheck(output);
    const safetyScore = await SafetyService.calculateSafetyScore(output);

    // Simple heuristics for quick evaluation
    let score = safetyScore;

    // Check length (not too short, not too long)
    const wordCount = output.split(/\s+/).length;
    if (wordCount < 10) {
      score -= 0.2;
    } else if (wordCount > 5000) {
      score -= 0.1;
    }

    // Check for structure
    if (output.includes('\n') || output.includes('- ') || output.includes('1.')) {
      score += 0.1;
    }

    score = Math.max(0, Math.min(1, score));

    let category: 'excellent' | 'good' | 'fair' | 'poor';
    if (score >= 0.9) category = 'excellent';
    else if (score >= 0.7) category = 'good';
    else if (score >= 0.5) category = 'fair';
    else category = 'poor';

    let quickFeedback = '';
    if (!safetyResult.passed) {
      quickFeedback = 'Safety concerns detected';
    } else if (wordCount < 10) {
      quickFeedback = 'Output seems too brief';
    } else if (score >= 0.8) {
      quickFeedback = 'Output quality looks good';
    } else {
      quickFeedback = 'Consider reviewing for improvements';
    }

    return { score, category, quickFeedback };
  }

  // Default scores for fallback
  private static getDefaultAccuracyScore(): AccuracyScore {
    return {
      score: 0.7,
      factualCorrectness: 0.7,
      logicalConsistency: 0.7,
      relevanceToPrompt: 0.7,
      issues: [],
    };
  }

  private static getDefaultStyleScore(): StyleScore {
    return {
      score: 0.7,
      clarity: 0.7,
      coherence: 0.7,
      toneMatch: 0.7,
      formatting: 0.7,
      issues: [],
    };
  }

  private static getDefaultSafetyResult(): SafetyCheckResult {
    return {
      passed: true,
      issues: [],
      recommendations: [],
    };
  }
}
