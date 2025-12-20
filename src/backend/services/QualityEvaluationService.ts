import { z } from 'zod';

// Evaluation Schemas
const EvaluationMetricsSchema = z.object({
  relevance: z.number().min(0).max(1),
  coherence: z.number().min(0).max(1),
  groundedness: z.number().min(0).max(1),
  context_recall: z.number().min(0).max(1),
  context_precision: z.number().min(0).max(1),
  answer_similarity: z.number().min(0).max(1),
  overall_score: z.number().min(0).max(1)
});

const EvaluationResultSchema = z.object({
  id: z.string(),
  prompt_id: z.string(),
  version: z.number(),
  metrics: EvaluationMetricsSchema,
  feedback: z.string(),
  timestamp: z.date(),
  test_case: z.string(),
  expected_output: z.string().optional(),
  actual_output: z.string()
});

export type EvaluationMetrics = z.infer<typeof EvaluationMetricsSchema>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

export class QualityEvaluationService {
  private openai: any;

  constructor() {
    // Initialize OpenAI for evaluation
    this.openai = new (require('openai').OpenAI)({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  // Evaluate prompt quality using multiple metrics
  async evaluatePrompt(
    prompt: string,
    testCases: Array<{ input: string; expected?: string }>,
    context?: string
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const testCase of testCases) {
      const actualOutput = await this.executePrompt(prompt, testCase.input);
      const metrics = await this.calculateMetrics(
        prompt,
        testCase.input,
        actualOutput,
        testCase.expected,
        context
      );

      results.push({
        id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        prompt_id: 'temp_id',
        version: 1,
        metrics,
        feedback: this.generateFeedback(metrics),
        timestamp: new Date(),
        test_case: testCase.input,
        expected_output: testCase.expected,
        actual_output: actualOutput
      });
    }

    return results;
  }

  // Calculate evaluation metrics
  private async calculateMetrics(
    prompt: string,
    input: string,
    output: string,
    expected?: string,
    context?: string
  ): Promise<EvaluationMetrics> {
    const [relevance, coherence, groundedness] = await Promise.all([
      this.evaluateRelevance(input, output),
      this.evaluateCoherence(output),
      this.evaluateGroundedness(output, context)
    ]);

    let contextRecall = 0.8; // Default if no context
    let contextPrecision = 0.8;
    let answerSimilarity = 0.7;

    if (context) {
      [contextRecall, contextPrecision] = await Promise.all([
        this.evaluateContextRecall(output, context),
        this.evaluateContextPrecision(output, context)
      ]);
    }

    if (expected) {
      answerSimilarity = await this.evaluateAnswerSimilarity(output, expected);
    }

    const overallScore = (relevance + coherence + groundedness + contextRecall + contextPrecision + answerSimilarity) / 6;

    return {
      relevance,
      coherence,
      groundedness,
      context_recall: contextRecall,
      context_precision: contextPrecision,
      answer_similarity: answerSimilarity,
      overall_score: overallScore
    };
  }

  // Execute prompt with input
  private async executePrompt(prompt: string, input: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: input }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error executing prompt:', error);
      return '';
    }
  }

  // Evaluate relevance
  private async evaluateRelevance(input: string, output: string): Promise<number> {
    const evaluationPrompt = `
Rate the relevance of the response to the input on a scale of 0-1.
Input: ${input}
Output: ${output}
Return only a number between 0 and 1.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: evaluationPrompt }],
        max_tokens: 10,
        temperature: 0
      });

      const score = parseFloat(response.choices[0]?.message?.content || '0.5');
      return Math.max(0, Math.min(1, score));
    } catch {
      return 0.5;
    }
  }

  // Evaluate coherence
  private async evaluateCoherence(output: string): Promise<number> {
    const evaluationPrompt = `
Rate the coherence and logical flow of this text on a scale of 0-1.
Text: ${output}
Return only a number between 0 and 1.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: evaluationPrompt }],
        max_tokens: 10,
        temperature: 0
      });

      const score = parseFloat(response.choices[0]?.message?.content || '0.5');
      return Math.max(0, Math.min(1, score));
    } catch {
      return 0.5;
    }
  }

  // Evaluate groundedness
  private async evaluateGroundedness(output: string, context?: string): Promise<number> {
    if (!context) return 0.8;

    const evaluationPrompt = `
Rate how well the response is grounded in the provided context on a scale of 0-1.
Context: ${context}
Response: ${output}
Return only a number between 0 and 1.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: evaluationPrompt }],
        max_tokens: 10,
        temperature: 0
      });

      const score = parseFloat(response.choices[0]?.message?.content || '0.5');
      return Math.max(0, Math.min(1, score));
    } catch {
      return 0.5;
    }
  }

  // Evaluate context recall
  private async evaluateContextRecall(output: string, context: string): Promise<number> {
    // Simplified implementation - in production, use more sophisticated methods
    const contextWords = new Set(context.toLowerCase().split(/\s+/));
    const outputWords = new Set(output.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...contextWords].filter(x => outputWords.has(x)));
    return Math.min(1, intersection.size / Math.max(1, contextWords.size * 0.3));
  }

  // Evaluate context precision
  private async evaluateContextPrecision(output: string, context: string): Promise<number> {
    // Simplified implementation
    const contextWords = new Set(context.toLowerCase().split(/\s+/));
    const outputWords = new Set(output.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...outputWords].filter(x => contextWords.has(x)));
    return Math.min(1, intersection.size / Math.max(1, outputWords.size * 0.5));
  }

  // Evaluate answer similarity
  private async evaluateAnswerSimilarity(actual: string, expected: string): Promise<number> {
    const evaluationPrompt = `
Rate the semantic similarity between these two texts on a scale of 0-1.
Text 1: ${expected}
Text 2: ${actual}
Return only a number between 0 and 1.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: evaluationPrompt }],
        max_tokens: 10,
        temperature: 0
      });

      const score = parseFloat(response.choices[0]?.message?.content || '0.5');
      return Math.max(0, Math.min(1, score));
    } catch {
      return 0.5;
    }
  }

  // Generate feedback based on metrics
  private generateFeedback(metrics: EvaluationMetrics): string {
    const issues: string[] = [];
    const strengths: string[] = [];

    if (metrics.relevance < 0.7) issues.push('Low relevance to input');
    else strengths.push('Good relevance');

    if (metrics.coherence < 0.7) issues.push('Poor coherence and flow');
    else strengths.push('Good coherence');

    if (metrics.groundedness < 0.7) issues.push('Not well grounded in context');
    else strengths.push('Well grounded');

    if (metrics.context_recall < 0.6) issues.push('Missing important context information');
    if (metrics.context_precision < 0.6) issues.push('Too much irrelevant information');

    let feedback = `Overall Score: ${(metrics.overall_score * 100).toFixed(1)}%\n`;
    
    if (strengths.length > 0) {
      feedback += `Strengths: ${strengths.join(', ')}\n`;
    }
    
    if (issues.length > 0) {
      feedback += `Areas for improvement: ${issues.join(', ')}`;
    }

    return feedback;
  }

  // A/B Test prompts
  async runABTest(
    promptA: string,
    promptB: string,
    testCases: Array<{ input: string; expected?: string }>,
    context?: string
  ): Promise<{ winner: 'A' | 'B' | 'tie'; resultsA: EvaluationResult[]; resultsB: EvaluationResult[] }> {
    const [resultsA, resultsB] = await Promise.all([
      this.evaluatePrompt(promptA, testCases, context),
      this.evaluatePrompt(promptB, testCases, context)
    ]);

    const avgScoreA = resultsA.reduce((sum, r) => sum + r.metrics.overall_score, 0) / resultsA.length;
    const avgScoreB = resultsB.reduce((sum, r) => sum + r.metrics.overall_score, 0) / resultsB.length;

    const threshold = 0.05; // 5% difference threshold
    let winner: 'A' | 'B' | 'tie';
    
    if (Math.abs(avgScoreA - avgScoreB) < threshold) {
      winner = 'tie';
    } else {
      winner = avgScoreA > avgScoreB ? 'A' : 'B';
    }

    return { winner, resultsA, resultsB };
  }
}

export const qualityEvaluationService = new QualityEvaluationService();