import OpenAI from 'openai';
import { config } from '../config/index.js';
import { ReasoningPath, ThoughtNode } from './LLMServiceAdapter.js';

export interface PathEvaluation {
  pathId: string;
  score: number;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  criteria: {
    coherence: number;
    completeness: number;
    accuracy: number;
    creativity: number;
  };
}

export interface BestPathSelection {
  selectedPath: ReasoningPath;
  allEvaluations: PathEvaluation[];
  selectionReasoning: string;
  confidenceScore: number;
  timestamp: string;
}

export class AnalysisService {
  /**
   * Evaluate multiple reasoning paths and select the best one
   */
  static async evaluateAndSelectBestPath(
    paths: ReasoningPath[],
    originalPrompt: string,
    evaluationCriteria: string[] = ['coherence', 'completeness', 'accuracy', 'creativity']
  ): Promise<BestPathSelection> {
    if (paths.length === 0) {
      throw new Error('No paths to evaluate');
    }

    // Evaluate each path
    const evaluations: PathEvaluation[] = [];

    for (let i = 0; i < paths.length; i++) {
      const evaluation = await this.evaluatePath(paths[i], originalPrompt, evaluationCriteria);
      evaluations.push({
        pathId: `path-${i}`,
        ...evaluation,
      });
    }

    // Select the best path based on overall score
    const bestEvaluation = evaluations.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    const bestPathIndex = parseInt(bestEvaluation.pathId.split('-')[1]);
    const selectedPath = paths[bestPathIndex];

    // Generate selection reasoning
    const selectionReasoning = await this.generateSelectionReasoning(
      evaluations,
      bestEvaluation,
      originalPrompt
    );

    return {
      selectedPath,
      allEvaluations: evaluations,
      selectionReasoning,
      confidenceScore: bestEvaluation.score,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Evaluate a single reasoning path using LLM-as-a-Judge
   */
  private static async evaluatePath(
    path: ReasoningPath,
    originalPrompt: string,
    criteria: string[]
  ): Promise<Omit<PathEvaluation, 'pathId'>> {
    if (!config.openai.apiKey) {
      return this.heuristicEvaluatePath(path, criteria);
    }

    const openai = new OpenAI({ apiKey: config.openai.apiKey });

    const pathContent = path.nodes.map((node, i) =>
      `Step ${i + 1}: ${node.content}`
    ).join('\n\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are an expert evaluator analyzing reasoning paths. Evaluate the following reasoning path based on these criteria: ${criteria.join(', ')}.

Return a JSON object with:
- score: overall score from 0-1
- reasoning: detailed explanation of your evaluation
- strengths: array of strengths
- weaknesses: array of weaknesses
- criteria: object with scores for each criterion (coherence, completeness, accuracy, creativity)`,
        },
        {
          role: 'user',
          content: `Original Prompt: ${originalPrompt}

Reasoning Path:
${pathContent}

Final Answer: ${path.finalAnswer}

Evaluate this reasoning path.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    try {
      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        score: Math.min(Math.max(result.score || 0.5, 0), 1),
        reasoning: result.reasoning || 'No reasoning provided',
        strengths: Array.isArray(result.strengths) ? result.strengths : [],
        weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
        criteria: {
          coherence: result.criteria?.coherence || 0.5,
          completeness: result.criteria?.completeness || 0.5,
          accuracy: result.criteria?.accuracy || 0.5,
          creativity: result.criteria?.creativity || 0.5,
        },
      };
    } catch (error) {
      console.error('Error parsing evaluation result:', error);
      return this.heuristicEvaluatePath(path, criteria);
    }
  }

  /**
   * Fallback heuristic evaluation when LLM is not available
   */
  private static heuristicEvaluatePath(
    path: ReasoningPath,
    criteria: string[]
  ): Omit<PathEvaluation, 'pathId'> {
    const avgNodeScore = path.nodes.reduce((sum, node) => sum + node.score, 0) / path.nodes.length;
    const lengthScore = Math.min(path.nodes.length / 5, 1); // Prefer paths with multiple steps
    const finalAnswerScore = path.finalAnswer.length > 100 ? 0.8 : 0.5;

    const overallScore = (avgNodeScore * 0.4) + (lengthScore * 0.3) + (finalAnswerScore * 0.3);

    return {
      score: overallScore,
      reasoning: 'Heuristic evaluation based on node scores, path length, and answer completeness',
      strengths: ['Structured reasoning path', 'Multiple reasoning steps'],
      weaknesses: ['Limited depth analysis', 'Heuristic-based evaluation'],
      criteria: {
        coherence: avgNodeScore,
        completeness: lengthScore,
        accuracy: finalAnswerScore,
        creativity: 0.5,
      },
    };
  }

  /**
   * Generate reasoning for why a specific path was selected
   */
  private static async generateSelectionReasoning(
    allEvaluations: PathEvaluation[],
    bestEvaluation: PathEvaluation,
    originalPrompt: string
  ): Promise<string> {
    if (!config.openai.apiKey) {
      return `Selected path ${bestEvaluation.pathId} with score ${bestEvaluation.score.toFixed(2)} as it scored highest across evaluation criteria.`;
    }

    const openai = new OpenAI({ apiKey: config.openai.apiKey });

    const evaluationsSummary = allEvaluations.map(eval =>
      `${eval.pathId}: Score ${eval.score.toFixed(2)} - ${eval.reasoning}`
    ).join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at explaining decision-making processes. Provide a clear, concise explanation of why a specific path was selected as the best.',
        },
        {
          role: 'user',
          content: `Original Prompt: ${originalPrompt}

All Path Evaluations:
${evaluationsSummary}

Selected Best Path: ${bestEvaluation.pathId}

Explain why this path was selected as the best choice.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    return response.choices[0]?.message?.content?.trim() ||
      `Selected ${bestEvaluation.pathId} with score ${bestEvaluation.score.toFixed(2)}`;
  }

  /**
   * Compare two paths side-by-side
   */
  static async comparePaths(
    path1: ReasoningPath,
    path2: ReasoningPath,
    originalPrompt: string
  ): Promise<{
    comparison: string;
    winner: 'path1' | 'path2' | 'tie';
    differenceScore: number;
  }> {
    if (!config.openai.apiKey) {
      const score1 = path1.totalScore;
      const score2 = path2.totalScore;
      return {
        comparison: 'Heuristic comparison based on path scores',
        winner: score1 > score2 ? 'path1' : score2 > score1 ? 'path2' : 'tie',
        differenceScore: Math.abs(score1 - score2),
      };
    }

    const openai = new OpenAI({ apiKey: config.openai.apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at comparing reasoning paths. Provide a detailed comparison and determine which path is better. Return a JSON object with comparison, winner (path1/path2/tie), and differenceScore (0-1).',
        },
        {
          role: 'user',
          content: `Original Prompt: ${originalPrompt}

Path 1:
${path1.nodes.map((n, i) => `Step ${i + 1}: ${n.content}`).join('\n')}
Final: ${path1.finalAnswer}

Path 2:
${path2.nodes.map((n, i) => `Step ${i + 1}: ${n.content}`).join('\n')}
Final: ${path2.finalAnswer}

Compare these paths.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    try {
      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        comparison: result.comparison || 'Comparison not available',
        winner: result.winner || 'tie',
        differenceScore: result.differenceScore || 0,
      };
    } catch {
      return {
        comparison: 'Error comparing paths',
        winner: 'tie',
        differenceScore: 0,
      };
    }
  }

  /**
   * Generate quality metrics for a reasoning path
   */
  static async generateQualityMetrics(
    path: ReasoningPath,
    originalPrompt: string
  ): Promise<{
    accuracy: number;
    completeness: number;
    efficiency: number;
    novelty: number;
    overallQuality: number;
  }> {
    const evaluation = await this.evaluatePath(path, originalPrompt, [
      'accuracy', 'completeness', 'efficiency', 'novelty'
    ]);

    return {
      accuracy: evaluation.criteria.accuracy,
      completeness: evaluation.criteria.completeness,
      efficiency: 1 - (path.nodes.length / 10), // Penalize overly long paths
      novelty: evaluation.criteria.creativity,
      overallQuality: evaluation.score,
    };
  }
}
