// ============================================================
// Metric Registry - Epic 2.2
// Unified evaluation metrics with LLM-as-a-Judge support
// ============================================================

import { Prisma } from '@prisma/client';

// ============================================================
// Types
// ============================================================

export interface MetricContext {
  example: {
    id: string;
    inputVariables: Record<string, unknown>;
    expectedOutput?: string;
    metadata?: Record<string, unknown>;
  };
  rubric?: JudgeRubricConfig;
  modelConfig?: JudgeModelConfig;
  // For pairwise comparison
  outputA?: string;
  outputB?: string;
}

export interface MetricResult {
  passed: boolean;
  score: number; // 0.0 to 1.0
  reason?: string;
  details?: Record<string, unknown>;
}

export interface JudgeRubricConfig {
  criteria: Array<{
    name: string;
    description: string;
    weight: number;
    scoringGuide?: string;
  }>;
  instructions?: string;
  outputFormat?: 'json' | 'text';
}

export interface JudgeModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export type MetricFunction = (
  outputText: string,
  context: MetricContext
) => Promise<MetricResult>;

export type MetricType =
  | 'exact_match'
  | 'contains'
  | 'json_valid'
  | 'judge_rubric'
  | 'pairwise_judge';

// ============================================================
// Metric Registry
// ============================================================

const metricRegistry = new Map<MetricType, MetricFunction>();

export function registerMetric(name: MetricType, fn: MetricFunction): void {
  metricRegistry.set(name, fn);
}

export function getMetric(name: MetricType): MetricFunction | undefined {
  return metricRegistry.get(name);
}

export function getAllMetricNames(): MetricType[] {
  return Array.from(metricRegistry.keys());
}

// ============================================================
// Built-in Metrics
// ============================================================

/**
 * Exact Match Metric
 * Requires labeled data with expectedOutput
 */
export const exactMatchMetric: MetricFunction = async (outputText, context) => {
  const expected = context.example.expectedOutput;

  if (!expected) {
    return {
      passed: false,
      score: 0,
      reason: 'No expected output provided for exact_match metric',
    };
  }

  const normalizedOutput = outputText.trim().toLowerCase();
  const normalizedExpected = expected.trim().toLowerCase();
  const passed = normalizedOutput === normalizedExpected;

  return {
    passed,
    score: passed ? 1 : 0,
    reason: passed ? 'Exact match' : `Expected "${expected.slice(0, 50)}..." but got "${outputText.slice(0, 50)}..."`,
  };
};

/**
 * Contains Metric
 * Checks if output contains the expected text
 */
export const containsMetric: MetricFunction = async (outputText, context) => {
  const expected = context.example.expectedOutput;

  if (!expected) {
    return {
      passed: false,
      score: 0,
      reason: 'No expected output provided for contains metric',
    };
  }

  const normalizedOutput = outputText.toLowerCase();
  const normalizedExpected = expected.toLowerCase();
  const passed = normalizedOutput.includes(normalizedExpected);

  return {
    passed,
    score: passed ? 1 : 0,
    reason: passed
      ? 'Output contains expected text'
      : `Output does not contain "${expected.slice(0, 50)}..."`,
  };
};

/**
 * JSON Valid Metric
 * Checks if output is valid JSON and optionally validates required keys
 */
export const jsonValidMetric: MetricFunction = async (outputText, context) => {
  try {
    const parsed = JSON.parse(outputText);

    // Check for required keys if specified in metadata
    const requiredKeys = context.example.metadata?.requiredKeys as string[] | undefined;

    if (requiredKeys && Array.isArray(requiredKeys)) {
      const missingKeys = requiredKeys.filter(key => !(key in parsed));

      if (missingKeys.length > 0) {
        return {
          passed: false,
          score: 1 - (missingKeys.length / requiredKeys.length),
          reason: `Missing required keys: ${missingKeys.join(', ')}`,
          details: { missingKeys, parsedKeys: Object.keys(parsed) },
        };
      }
    }

    return {
      passed: true,
      score: 1,
      reason: 'Valid JSON',
      details: { parsedKeys: Object.keys(parsed) },
    };
  } catch (error) {
    return {
      passed: false,
      score: 0,
      reason: `Invalid JSON: ${error instanceof Error ? error.message : 'Parse error'}`,
    };
  }
};

/**
 * Judge Rubric Metric
 * Uses LLM-as-a-Judge to evaluate output based on rubric criteria
 * Works with unlabeled datasets
 */
export const judgeRubricMetric: MetricFunction = async (outputText, context) => {
  if (!context.rubric) {
    return {
      passed: false,
      score: 0,
      reason: 'No rubric provided for judge_rubric metric',
    };
  }

  // Build judge prompt
  const judgePrompt = buildJudgeRubricPrompt(outputText, context);

  // Call LLM (will be injected via dependency)
  const judgeResult = await callJudgeLLM(judgePrompt, context.modelConfig);

  return judgeResult;
};

/**
 * Pairwise Judge Metric
 * Compares two outputs (Version A vs Version B) and picks a winner
 */
export const pairwiseJudgeMetric: MetricFunction = async (outputText, context) => {
  if (!context.outputA || !context.outputB) {
    return {
      passed: false,
      score: 0,
      reason: 'Missing outputA or outputB for pairwise comparison',
    };
  }

  // Build pairwise judge prompt
  const judgePrompt = buildPairwiseJudgePrompt(context);

  // Call LLM
  const judgeResult = await callPairwiseJudgeLLM(judgePrompt, context.modelConfig);

  return judgeResult;
};

// ============================================================
// Judge Prompt Builders
// ============================================================

function buildJudgeRubricPrompt(
  outputText: string,
  context: MetricContext
): string {
  const { rubric, example } = context;

  if (!rubric) {
    throw new Error('Rubric is required');
  }

  const criteriaList = rubric.criteria
    .map((c, i) => `${i + 1}. ${c.name} (weight: ${c.weight}): ${c.description}${c.scoringGuide ? `\n   Scoring guide: ${c.scoringGuide}` : ''}`)
    .join('\n');

  return `You are an expert evaluator. Evaluate the following AI response based on the given criteria.

## Task Context
Input: ${JSON.stringify(example.inputVariables)}
${example.expectedOutput ? `Expected Output (if available): ${example.expectedOutput}` : '(No expected output - evaluate based on quality)'}

## AI Response to Evaluate
${outputText}

## Evaluation Criteria
${criteriaList}

${rubric.instructions ? `## Additional Instructions\n${rubric.instructions}` : ''}

## Your Task
Evaluate the AI response and provide:
1. A score for each criterion (0.0 to 1.0)
2. An overall weighted score (0.0 to 1.0)
3. Brief reasoning for your evaluation

Respond in JSON format:
{
  "criteriaScores": {
    "criterion_name": { "score": 0.0-1.0, "reason": "brief explanation" }
  },
  "overallScore": 0.0-1.0,
  "passed": true/false,
  "reasoning": "overall evaluation summary"
}`;
}

function buildPairwiseJudgePrompt(context: MetricContext): string {
  const { example, outputA, outputB, rubric } = context;

  let criteriaSection = '';
  if (rubric) {
    criteriaSection = `\n## Evaluation Criteria\n${rubric.criteria
      .map((c, i) => `${i + 1}. ${c.name}: ${c.description}`)
      .join('\n')}`;
  }

  return `You are an expert evaluator. Compare the following two AI responses and determine which is better.

## Task Context
Input: ${JSON.stringify(example.inputVariables)}
${example.expectedOutput ? `Expected Output (if available): ${example.expectedOutput}` : ''}

## Response A
${outputA}

## Response B
${outputB}
${criteriaSection}

## Your Task
Compare both responses and determine:
1. Which response is better (A, B, or tie)
2. Why you chose that response

Respond in JSON format:
{
  "winner": "A" | "B" | "tie",
  "reasoning": "explanation of your choice",
  "scoreA": 0.0-1.0,
  "scoreB": 0.0-1.0
}`;
}

// ============================================================
// LLM Judge Callers (Dependency Injection Ready)
// ============================================================

let llmJudgeClient: LLMJudgeClient | null = null;

export interface LLMJudgeClient {
  call(prompt: string, config?: JudgeModelConfig): Promise<string>;
}

export function setLLMJudgeClient(client: LLMJudgeClient): void {
  llmJudgeClient = client;
}

async function callJudgeLLM(
  prompt: string,
  config?: JudgeModelConfig
): Promise<MetricResult> {
  if (!llmJudgeClient) {
    // Return mock result for testing
    return {
      passed: true,
      score: 0.75,
      reason: 'Mock judge result (LLM client not configured)',
      details: { mock: true },
    };
  }

  try {
    const response = await llmJudgeClient.call(prompt, config);
    const parsed = JSON.parse(response);

    return {
      passed: parsed.passed ?? (parsed.overallScore >= 0.5),
      score: parsed.overallScore ?? 0.5,
      reason: parsed.reasoning,
      details: {
        criteriaScores: parsed.criteriaScores,
        rawResponse: response,
      },
    };
  } catch (error) {
    return {
      passed: false,
      score: 0,
      reason: `Judge LLM error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: true },
    };
  }
}

async function callPairwiseJudgeLLM(
  prompt: string,
  config?: JudgeModelConfig
): Promise<MetricResult> {
  if (!llmJudgeClient) {
    // Return mock result for testing
    return {
      passed: true,
      score: 0.5,
      reason: 'Mock pairwise result (LLM client not configured)',
      details: { mock: true, winner: 'tie' },
    };
  }

  try {
    const response = await llmJudgeClient.call(prompt, config);
    const parsed = JSON.parse(response);

    return {
      passed: true,
      score: parsed.scoreA ?? 0.5,
      reason: parsed.reasoning,
      details: {
        winner: parsed.winner,
        scoreA: parsed.scoreA,
        scoreB: parsed.scoreB,
        rawResponse: response,
      },
    };
  } catch (error) {
    return {
      passed: false,
      score: 0,
      reason: `Pairwise judge error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: true },
    };
  }
}

// ============================================================
// Register Built-in Metrics
// ============================================================

registerMetric('exact_match', exactMatchMetric);
registerMetric('contains', containsMetric);
registerMetric('json_valid', jsonValidMetric);
registerMetric('judge_rubric', judgeRubricMetric);
registerMetric('pairwise_judge', pairwiseJudgeMetric);

// ============================================================
// Exports
// ============================================================

export {
  registerMetric as register,
  getMetric as get,
  getAllMetricNames as getAll,
};
