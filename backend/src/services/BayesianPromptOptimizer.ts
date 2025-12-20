import { PromptService } from './PromptService';

/**
 * Experiment trial result
 */
export interface ExperimentTrial {
  id: string;
  iteration: number;
  variant: PromptVariant;
  metrics: TrialMetrics;
  timestamp: Date;
  parentId?: string;
}

/**
 * Prompt variant with mutation info
 */
export interface PromptVariant {
  id: string;
  content: string;
  mutationType: MutationType;
  mutationParams?: Record<string, any>;
}

/**
 * Trial metrics for quality/cost evaluation
 */
export interface TrialMetrics {
  quality: number;         // 0-1 quality score
  cost: number;            // Estimated cost in dollars
  latency: number;         // Estimated latency in ms
  tokens: number;          // Token count
  successProbability: number;
  qualityCostRatio: number;  // Quality gain per cost unit
  improvementOverBase: number; // % improvement over baseline
}

/**
 * Mutation types for generating variants
 */
export type MutationType =
  | 'original'
  | 'add_examples'
  | 'add_constraints'
  | 'simplify'
  | 'elaborate'
  | 'restructure'
  | 'add_chain_of_thought'
  | 'add_output_format'
  | 'crossover'
  | 'random_mutation';

/**
 * Acquisition function types for Bayesian optimization
 */
export type AcquisitionFunction = 'ucb' | 'ei' | 'poi' | 'thompson';

/**
 * Experiment configuration
 */
export interface ExperimentConfig {
  maxIterations: number;
  populationSize: number;
  acquisitionFunction: AcquisitionFunction;
  explorationWeight: number;  // Balance exploration vs exploitation
  earlyStopThreshold: number; // Stop if improvement < threshold
  earlyStopPatience: number;  // Number of iterations without improvement
  mutationProbability: number;
  crossoverProbability: number;
  eliteRatio: number;  // Top % to keep unchanged
}

/**
 * Experiment result
 */
export interface ExperimentResult {
  experimentId: string;
  basePrompt: string;
  bestPrompt: string;
  bestScore: number;
  improvement: number;
  trials: ExperimentTrial[];
  config: ExperimentConfig;
  summary: ExperimentSummary;
  startTime: Date;
  endTime: Date;
  status: 'completed' | 'early_stopped' | 'failed';
}

/**
 * Experiment summary statistics
 */
export interface ExperimentSummary {
  totalTrials: number;
  totalIterations: number;
  avgQuality: number;
  avgCost: number;
  bestQualityCostRatio: number;
  convergenceIteration: number;
  mutationEffectiveness: Record<MutationType, number>;
}

/**
 * Gaussian Process surrogate model for Bayesian optimization
 */
class GaussianProcessSurrogate {
  private observations: Array<{ features: number[]; value: number }> = [];
  private lengthScale: number = 1.0;
  private variance: number = 1.0;
  private noise: number = 0.1;

  /**
   * Add observation to the model
   */
  addObservation(features: number[], value: number): void {
    this.observations.push({ features, value });
  }

  /**
   * RBF kernel function
   */
  private rbfKernel(x1: number[], x2: number[]): number {
    let sqDist = 0;
    for (let i = 0; i < x1.length; i++) {
      sqDist += Math.pow(x1[i] - x2[i], 2);
    }
    return this.variance * Math.exp(-sqDist / (2 * this.lengthScale * this.lengthScale));
  }

  /**
   * Predict mean and variance at a point
   */
  predict(features: number[]): { mean: number; variance: number } {
    if (this.observations.length === 0) {
      return { mean: 0.5, variance: this.variance };
    }

    // Compute kernel vectors
    const K = this.observations.map(obs => this.rbfKernel(features, obs.features));
    const KK = this.observations.map((obs1, i) =>
      this.observations.map((obs2, j) =>
        this.rbfKernel(obs1.features, obs2.features) + (i === j ? this.noise : 0)
      )
    );

    // Simplified mean prediction (weighted average)
    const kSum = K.reduce((a, b) => a + b, 0);
    if (kSum === 0) {
      return { mean: 0.5, variance: this.variance };
    }

    const weights = K.map(k => k / kSum);
    const mean = this.observations.reduce(
      (sum, obs, i) => sum + weights[i] * obs.value, 0
    );

    // Simplified variance estimation
    const kSelf = this.rbfKernel(features, features);
    const variance = Math.max(0.01, kSelf - kSum / this.observations.length);

    return { mean, variance };
  }
}

/**
 * Bayesian Prompt Optimizer
 * Uses Bayesian optimization with Gaussian Process surrogate model
 */
export class BayesianPromptOptimizer {
  private surrogate: GaussianProcessSurrogate;
  private trials: ExperimentTrial[] = [];
  private config: ExperimentConfig;
  private basePrompt: string;
  private baselineMetrics: TrialMetrics | null = null;

  constructor(basePrompt: string, config?: Partial<ExperimentConfig>) {
    this.basePrompt = basePrompt;
    this.surrogate = new GaussianProcessSurrogate();
    this.config = {
      maxIterations: 10,
      populationSize: 5,
      acquisitionFunction: 'ucb',
      explorationWeight: 2.0,
      earlyStopThreshold: 0.01,
      earlyStopPatience: 3,
      mutationProbability: 0.3,
      crossoverProbability: 0.5,
      eliteRatio: 0.2,
      ...config,
    };
  }

  /**
   * Run the optimization experiment
   */
  async runExperiment(): Promise<ExperimentResult> {
    const experimentId = this.generateId('exp');
    const startTime = new Date();
    let status: 'completed' | 'early_stopped' | 'failed' = 'completed';
    let iterationsWithoutImprovement = 0;
    let bestScore = 0;
    let bestPrompt = this.basePrompt;

    try {
      // Evaluate baseline
      const baselineVariant: PromptVariant = {
        id: this.generateId('var'),
        content: this.basePrompt,
        mutationType: 'original',
      };
      this.baselineMetrics = await this.evaluateVariant(baselineVariant);

      const baselineTrial: ExperimentTrial = {
        id: this.generateId('trial'),
        iteration: 0,
        variant: baselineVariant,
        metrics: this.baselineMetrics,
        timestamp: new Date(),
      };
      this.trials.push(baselineTrial);
      this.addToSurrogate(baselineVariant, this.baselineMetrics.quality);
      bestScore = this.baselineMetrics.quality;

      // Main optimization loop
      for (let iter = 1; iter <= this.config.maxIterations; iter++) {
        // Generate population of variants
        const variants = await this.generateVariantPopulation(iter);

        // Evaluate each variant
        for (const variant of variants) {
          const metrics = await this.evaluateVariant(variant);

          const trial: ExperimentTrial = {
            id: this.generateId('trial'),
            iteration: iter,
            variant,
            metrics,
            timestamp: new Date(),
          };
          this.trials.push(trial);
          this.addToSurrogate(variant, metrics.quality);

          // Track best
          if (metrics.quality > bestScore) {
            bestScore = metrics.quality;
            bestPrompt = variant.content;
            iterationsWithoutImprovement = 0;
          }
        }

        // Select next exploration point using acquisition function
        const nextVariant = await this.selectNextVariant(iter);
        if (nextVariant) {
          const metrics = await this.evaluateVariant(nextVariant);
          const trial: ExperimentTrial = {
            id: this.generateId('trial'),
            iteration: iter,
            variant: nextVariant,
            metrics,
            timestamp: new Date(),
          };
          this.trials.push(trial);
          this.addToSurrogate(nextVariant, metrics.quality);

          if (metrics.quality > bestScore) {
            bestScore = metrics.quality;
            bestPrompt = nextVariant.content;
            iterationsWithoutImprovement = 0;
          }
        }

        // Check early stopping
        iterationsWithoutImprovement++;
        if (iterationsWithoutImprovement >= this.config.earlyStopPatience) {
          status = 'early_stopped';
          break;
        }
      }
    } catch (error) {
      status = 'failed';
      console.error('Experiment failed:', error);
    }

    const endTime = new Date();
    const improvement = this.baselineMetrics
      ? ((bestScore - this.baselineMetrics.quality) / this.baselineMetrics.quality) * 100
      : 0;

    return {
      experimentId,
      basePrompt: this.basePrompt,
      bestPrompt,
      bestScore,
      improvement,
      trials: this.trials,
      config: this.config,
      summary: this.generateSummary(),
      startTime,
      endTime,
      status,
    };
  }

  /**
   * Evaluate a prompt variant
   */
  private async evaluateVariant(variant: PromptVariant): Promise<TrialMetrics> {
    const tokens = PromptService.estimateTokens(variant.content);
    const cost = PromptService.estimateCost(tokens);
    const successProbability = await PromptService.calculateSuccessProbability(variant.content);

    // Calculate quality score based on multiple factors
    const quality = this.calculateQualityScore(variant.content, successProbability);

    // Estimate latency based on token count
    const latency = this.estimateLatency(tokens);

    // Calculate quality/cost ratio
    const qualityCostRatio = cost > 0 ? quality / cost : quality;

    // Calculate improvement over baseline
    const improvementOverBase = this.baselineMetrics
      ? ((quality - this.baselineMetrics.quality) / this.baselineMetrics.quality) * 100
      : 0;

    return {
      quality,
      cost,
      latency,
      tokens,
      successProbability,
      qualityCostRatio,
      improvementOverBase,
    };
  }

  /**
   * Calculate comprehensive quality score
   */
  private calculateQualityScore(content: string, successProbability: number): number {
    let score = successProbability * 0.5;

    // Structure bonus
    if (content.includes('##') || content.includes('**')) {
      score += 0.1;
    }

    // Examples bonus
    if (/example|e\.g\.|for instance|such as/i.test(content)) {
      score += 0.1;
    }

    // Clear instructions bonus
    if (/you (must|should|will)|step \d|first,|then,|finally/i.test(content)) {
      score += 0.1;
    }

    // Output format specification
    if (/format|output|response should|return/i.test(content)) {
      score += 0.1;
    }

    // Constraints/rules bonus
    if (/constraint|rule|requirement|must not|never|always/i.test(content)) {
      score += 0.05;
    }

    // Penalize very short or very long prompts
    const tokens = PromptService.estimateTokens(content);
    if (tokens < 20) {
      score -= 0.1;
    } else if (tokens > 3000) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Estimate latency based on token count
   */
  private estimateLatency(tokens: number): number {
    // Rough estimate: ~50ms per 100 tokens
    return Math.ceil(tokens / 100) * 50;
  }

  /**
   * Generate a population of variants
   */
  private async generateVariantPopulation(iteration: number): Promise<PromptVariant[]> {
    const variants: PromptVariant[] = [];
    const mutationTypes: MutationType[] = [
      'add_examples',
      'add_constraints',
      'simplify',
      'elaborate',
      'restructure',
      'add_chain_of_thought',
      'add_output_format',
    ];

    // Get elite (best) variants from previous trials
    const eliteCount = Math.ceil(this.trials.length * this.config.eliteRatio);
    const sortedTrials = [...this.trials].sort((a, b) => b.metrics.quality - a.metrics.quality);
    const elites = sortedTrials.slice(0, eliteCount);

    for (let i = 0; i < this.config.populationSize; i++) {
      let baseContent = this.basePrompt;

      // Use elite variant as base if available
      if (elites.length > 0 && Math.random() < 0.7) {
        const elite = elites[Math.floor(Math.random() * elites.length)];
        baseContent = elite.variant.content;
      }

      // Apply crossover
      if (elites.length >= 2 && Math.random() < this.config.crossoverProbability) {
        const parent1 = elites[Math.floor(Math.random() * elites.length)];
        const parent2 = elites[Math.floor(Math.random() * elites.length)];
        if (parent1.id !== parent2.id) {
          variants.push(this.crossover(parent1.variant, parent2.variant));
          continue;
        }
      }

      // Apply mutation
      const mutationType = mutationTypes[Math.floor(Math.random() * mutationTypes.length)];
      const mutatedContent = this.applyMutation(baseContent, mutationType);

      variants.push({
        id: this.generateId('var'),
        content: mutatedContent,
        mutationType,
      });
    }

    return variants;
  }

  /**
   * Apply mutation to generate variant
   */
  private applyMutation(content: string, type: MutationType): string {
    switch (type) {
      case 'add_examples':
        return `${content}\n\n## Examples\nHere are some examples to guide your response:\n- Example 1: [Specific scenario]\n- Example 2: [Another scenario]`;

      case 'add_constraints':
        return `${content}\n\n## Constraints\n- Be concise and focused\n- Provide accurate information only\n- If uncertain, acknowledge limitations`;

      case 'simplify':
        // Remove redundant phrases
        return content
          .replace(/\s+/g, ' ')
          .replace(/\. +/g, '. ')
          .replace(/please note that /gi, '')
          .replace(/it is important to /gi, '')
          .trim();

      case 'elaborate':
        return `${content}\n\nPlease provide a comprehensive and detailed response. Consider multiple perspectives and explain your reasoning step by step.`;

      case 'restructure':
        const lines = content.split('\n').filter(l => l.trim());
        const sections = ['## Context', '## Task', '## Requirements', '## Output'];
        let restructured = '';
        const linesPerSection = Math.ceil(lines.length / sections.length);
        sections.forEach((section, idx) => {
          const sectionLines = lines.slice(idx * linesPerSection, (idx + 1) * linesPerSection);
          if (sectionLines.length > 0) {
            restructured += `${section}\n${sectionLines.join('\n')}\n\n`;
          }
        });
        return restructured.trim() || content;

      case 'add_chain_of_thought':
        return `${content}\n\nThink through this step by step:\n1. First, understand the core question\n2. Then, gather relevant information\n3. Next, analyze the options\n4. Finally, provide your conclusion with reasoning`;

      case 'add_output_format':
        return `${content}\n\n## Output Format\nStructure your response as follows:\n- **Summary**: Brief overview\n- **Details**: Main content\n- **Conclusion**: Key takeaways`;

      case 'random_mutation':
        const mutations = [
          (c: string) => c + '\n\nBe specific and provide evidence.',
          (c: string) => c.replace('you should', 'you must'),
          (c: string) => `Important: ${c}`,
          (c: string) => c + '\n\nDouble-check your response for accuracy.',
        ];
        return mutations[Math.floor(Math.random() * mutations.length)](content);

      default:
        return content;
    }
  }

  /**
   * Crossover two variants
   */
  private crossover(parent1: PromptVariant, parent2: PromptVariant): PromptVariant {
    const lines1 = parent1.content.split('\n');
    const lines2 = parent2.content.split('\n');

    const crossoverPoint = Math.floor(Math.random() * Math.min(lines1.length, lines2.length));

    const childContent = [
      ...lines1.slice(0, crossoverPoint),
      ...lines2.slice(crossoverPoint),
    ].join('\n');

    return {
      id: this.generateId('var'),
      content: childContent,
      mutationType: 'crossover',
      mutationParams: {
        parent1Id: parent1.id,
        parent2Id: parent2.id,
        crossoverPoint,
      },
    };
  }

  /**
   * Select next variant using acquisition function
   */
  private async selectNextVariant(iteration: number): Promise<PromptVariant | null> {
    const candidates = await this.generateCandidates(5);
    let bestCandidate: PromptVariant | null = null;
    let bestAcquisitionValue = -Infinity;

    for (const candidate of candidates) {
      const features = this.extractFeatures(candidate.content);
      const { mean, variance } = this.surrogate.predict(features);

      const acquisitionValue = this.computeAcquisition(mean, variance);

      if (acquisitionValue > bestAcquisitionValue) {
        bestAcquisitionValue = acquisitionValue;
        bestCandidate = candidate;
      }
    }

    return bestCandidate;
  }

  /**
   * Generate candidate variants for acquisition function
   */
  private async generateCandidates(count: number): Promise<PromptVariant[]> {
    const candidates: PromptVariant[] = [];
    const types: MutationType[] = ['add_examples', 'add_constraints', 'elaborate', 'add_chain_of_thought'];

    for (let i = 0; i < count; i++) {
      const type = types[i % types.length];
      candidates.push({
        id: this.generateId('var'),
        content: this.applyMutation(this.basePrompt, type),
        mutationType: type,
      });
    }

    return candidates;
  }

  /**
   * Compute acquisition function value
   */
  private computeAcquisition(mean: number, variance: number): number {
    const std = Math.sqrt(variance);

    switch (this.config.acquisitionFunction) {
      case 'ucb':
        // Upper Confidence Bound
        return mean + this.config.explorationWeight * std;

      case 'ei':
        // Expected Improvement (simplified)
        const bestSoFar = Math.max(...this.trials.map(t => t.metrics.quality));
        const improvement = mean - bestSoFar;
        return improvement > 0 ? improvement * std : 0;

      case 'poi':
        // Probability of Improvement (simplified)
        const best = Math.max(...this.trials.map(t => t.metrics.quality));
        return mean > best ? 1 : 0;

      case 'thompson':
        // Thompson Sampling
        return mean + Math.random() * std * 2 - std;

      default:
        return mean;
    }
  }

  /**
   * Extract features from prompt for surrogate model
   */
  private extractFeatures(content: string): number[] {
    const tokens = PromptService.estimateTokens(content);

    return [
      tokens / 1000, // Normalized token count
      content.includes('##') ? 1 : 0, // Has structure
      content.includes('example') ? 1 : 0, // Has examples
      content.includes('step') ? 1 : 0, // Has steps
      (content.match(/\n/g) || []).length / 20, // Normalized line count
      content.includes('constraint') || content.includes('rule') ? 1 : 0, // Has constraints
    ];
  }

  /**
   * Add observation to surrogate model
   */
  private addToSurrogate(variant: PromptVariant, quality: number): void {
    const features = this.extractFeatures(variant.content);
    this.surrogate.addObservation(features, quality);
  }

  /**
   * Generate experiment summary
   */
  private generateSummary(): ExperimentSummary {
    const totalTrials = this.trials.length;
    const totalIterations = Math.max(...this.trials.map(t => t.iteration));

    const qualities = this.trials.map(t => t.metrics.quality);
    const costs = this.trials.map(t => t.metrics.cost);

    const avgQuality = qualities.reduce((a, b) => a + b, 0) / totalTrials;
    const avgCost = costs.reduce((a, b) => a + b, 0) / totalTrials;

    const bestQualityCostRatio = Math.max(...this.trials.map(t => t.metrics.qualityCostRatio));

    // Find when we converged
    let convergenceIteration = totalIterations;
    const bestQuality = Math.max(...qualities);
    for (let i = 0; i < this.trials.length; i++) {
      if (this.trials[i].metrics.quality >= bestQuality * 0.99) {
        convergenceIteration = this.trials[i].iteration;
        break;
      }
    }

    // Calculate mutation effectiveness
    const mutationEffectiveness: Record<MutationType, number> = {} as any;
    const mutationTrials: Record<MutationType, number[]> = {} as any;

    for (const trial of this.trials) {
      const type = trial.variant.mutationType;
      if (!mutationTrials[type]) {
        mutationTrials[type] = [];
      }
      mutationTrials[type].push(trial.metrics.quality);
    }

    for (const [type, qualities] of Object.entries(mutationTrials)) {
      mutationEffectiveness[type as MutationType] =
        qualities.reduce((a, b) => a + b, 0) / qualities.length;
    }

    return {
      totalTrials,
      totalIterations,
      avgQuality,
      avgCost,
      bestQualityCostRatio,
      convergenceIteration,
      mutationEffectiveness,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Quick optimization function for simple use cases
 */
export async function quickOptimize(
  prompt: string,
  options?: Partial<ExperimentConfig>
): Promise<ExperimentResult> {
  const optimizer = new BayesianPromptOptimizer(prompt, {
    maxIterations: 5,
    populationSize: 3,
    ...options,
  });
  return optimizer.runExperiment();
}

/**
 * Compare multiple prompts and select the best
 */
export async function comparePrompts(
  prompts: string[],
  evaluationRounds: number = 3
): Promise<{
  rankings: Array<{ prompt: string; avgScore: number; rank: number }>;
  winner: string;
  confidence: number;
}> {
  const scores: Map<string, number[]> = new Map();

  for (const prompt of prompts) {
    scores.set(prompt, []);

    for (let round = 0; round < evaluationRounds; round++) {
      const tokens = PromptService.estimateTokens(prompt);
      const successProb = await PromptService.calculateSuccessProbability(prompt);
      const cost = PromptService.estimateCost(tokens);

      // Composite score
      const score = successProb * 0.7 + (1 - cost) * 0.15 + (1 - tokens / 4000) * 0.15;
      scores.get(prompt)!.push(score);
    }
  }

  // Calculate average scores and rank
  const rankings = prompts.map(prompt => {
    const promptScores = scores.get(prompt)!;
    return {
      prompt,
      avgScore: promptScores.reduce((a, b) => a + b, 0) / promptScores.length,
      rank: 0,
    };
  });

  rankings.sort((a, b) => b.avgScore - a.avgScore);
  rankings.forEach((r, idx) => r.rank = idx + 1);

  const winner = rankings[0].prompt;
  const confidence = rankings.length > 1
    ? Math.min(100, (rankings[0].avgScore - rankings[1].avgScore) * 200)
    : 100;

  return { rankings, winner, confidence };
}
