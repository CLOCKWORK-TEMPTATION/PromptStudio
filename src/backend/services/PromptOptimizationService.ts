import { PromptService } from './PromptService';

export interface OptimizationCandidate {
  id: string;
  prompt: string;
  score: number;
  metrics: {
    quality: number;
    cost: number;
    speed: number;
  };
  generation: number;
}

export interface OptimizationResult {
  bestPrompt: string;
  bestScore: number;
  history: OptimizationCandidate[];
  iterations: number;
  improvement: number;
}

export class PromptOptimizationService {
  /**
   * Bayesian optimization for prompt search
   */
  static async bayesianOptimization(
    basePrompt: string,
    options: {
      iterations?: number;
      populationSize?: number;
      acquisitionFunction?: 'ucb' | 'ei' | 'poi';
    } = {}
  ): Promise<OptimizationResult> {
    const {
      iterations = 10,
      populationSize = 5,
      acquisitionFunction = 'ucb',
    } = options;

    const history: OptimizationCandidate[] = [];
    let bestCandidate: OptimizationCandidate | null = null;

    // Initialize with base prompt
    const initialCandidate = await this.evaluatePrompt(basePrompt, 0);
    history.push(initialCandidate);
    bestCandidate = initialCandidate;

    for (let i = 0; i < iterations; i++) {
      // Generate new candidates
      const candidates = await this.generateCandidates(
        bestCandidate.prompt,
        populationSize,
        i + 1
      );

      // Evaluate candidates
      for (const candidate of candidates) {
        const evaluated = await this.evaluatePrompt(candidate, i + 1);
        history.push(evaluated);

        if (evaluated.score > bestCandidate.score) {
          bestCandidate = evaluated;
        }
      }

      // Apply acquisition function to select next exploration point
      const nextPrompt = this.selectNextPrompt(
        history,
        acquisitionFunction
      );

      if (nextPrompt) {
        const evaluated = await this.evaluatePrompt(nextPrompt, i + 1);
        history.push(evaluated);

        if (evaluated.score > bestCandidate.score) {
          bestCandidate = evaluated;
        }
      }
    }

    const improvement = ((bestCandidate.score - initialCandidate.score) / initialCandidate.score) * 100;

    return {
      bestPrompt: bestCandidate.prompt,
      bestScore: bestCandidate.score,
      history,
      iterations,
      improvement,
    };
  }

  /**
   * Evolutionary/Genetic Algorithm for prompt optimization
   */
  static async evolutionaryOptimization(
    basePrompt: string,
    options: {
      generations?: number;
      populationSize?: number;
      mutationRate?: number;
      crossoverRate?: number;
    } = {}
  ): Promise<OptimizationResult> {
    const {
      generations = 10,
      populationSize = 10,
      mutationRate = 0.2,
      crossoverRate = 0.7,
    } = options;

    const history: OptimizationCandidate[] = [];

    // Initialize population
    let population = await this.initializePopulation(basePrompt, populationSize);

    for (let gen = 0; gen < generations; gen++) {
      // Evaluate population
      const evaluated = await Promise.all(
        population.map(p => this.evaluatePrompt(p, gen))
      );

      history.push(...evaluated);

      // Selection
      const selected = this.tournamentSelection(evaluated, populationSize);

      // Crossover
      const offspring: string[] = [];
      for (let i = 0; i < selected.length; i += 2) {
        if (Math.random() < crossoverRate && i + 1 < selected.length) {
          const [child1, child2] = this.crossover(
            selected[i].prompt,
            selected[i + 1].prompt
          );
          offspring.push(child1, child2);
        } else {
          offspring.push(selected[i].prompt);
          if (i + 1 < selected.length) {
            offspring.push(selected[i + 1].prompt);
          }
        }
      }

      // Mutation
      population = offspring.map(prompt =>
        Math.random() < mutationRate ? this.mutate(prompt) : prompt
      );
    }

    // Final evaluation
    const finalEvaluation = await Promise.all(
      population.map(p => this.evaluatePrompt(p, generations))
    );

    const bestCandidate = finalEvaluation.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    const initialScore = history[0]?.score || 0;
    const improvement = ((bestCandidate.score - initialScore) / initialScore) * 100;

    return {
      bestPrompt: bestCandidate.prompt,
      bestScore: bestCandidate.score,
      history,
      iterations: generations,
      improvement,
    };
  }

  /**
   * Evaluate a prompt candidate
   */
  private static async evaluatePrompt(
    prompt: string,
    generation: number
  ): Promise<OptimizationCandidate> {
    // Quality metrics
    const tokens = PromptService.estimateTokens(prompt);
    const cost = PromptService.estimateCost(tokens);
    const successProb = await PromptService.calculateSuccessProbability(prompt);

    // Calculate quality score
    const quality = successProb;

    // Calculate cost score (lower cost is better, normalize to 0-1)
    const maxAcceptableCost = 1.0;
    const costScore = Math.max(0, 1 - cost / maxAcceptableCost);

    // Calculate speed score (fewer tokens = faster)
    const maxTokens = 4000;
    const speedScore = Math.max(0, 1 - tokens / maxTokens);

    // Weighted overall score
    const score = quality * 0.6 + costScore * 0.2 + speedScore * 0.2;

    return {
      id: `gen${generation}-${Math.random().toString(36).substr(2, 9)}`,
      prompt,
      score,
      metrics: {
        quality,
        cost: costScore,
        speed: speedScore,
      },
      generation,
    };
  }

  /**
   * Generate candidate prompts
   */
  private static async generateCandidates(
    basePrompt: string,
    count: number,
    generation: number
  ): Promise<string[]> {
    const candidates: string[] = [];
    const variations = [
      'more detailed',
      'more concise',
      'with examples',
      'with constraints',
      'step-by-step',
    ];

    for (let i = 0; i < count; i++) {
      const variation = variations[i % variations.length];
      candidates.push(this.applyVariation(basePrompt, variation));
    }

    return candidates;
  }

  /**
   * Apply a variation to a prompt
   */
  private static applyVariation(prompt: string, variation: string): string {
    switch (variation) {
      case 'more detailed':
        return `${prompt}\n\nProvide comprehensive details and explanations.`;
      case 'more concise':
        return `${prompt}\n\nBe brief and to the point.`;
      case 'with examples':
        return `${prompt}\n\nInclude specific examples.`;
      case 'with constraints':
        return `${prompt}\n\nStrictly follow these constraints: accuracy, clarity, completeness.`;
      case 'step-by-step':
        return `${prompt}\n\nBreak down your response into clear steps.`;
      default:
        return prompt;
    }
  }

  /**
   * Select next prompt using acquisition function
   */
  private static selectNextPrompt(
    history: OptimizationCandidate[],
    acquisitionFunction: 'ucb' | 'ei' | 'poi'
  ): string | null {
    if (history.length === 0) return null;

    // Simple implementation: return a variation of the best so far
    const best = history.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    return this.applyVariation(best.prompt, 'with examples');
  }

  /**
   * Initialize population for evolutionary algorithm
   */
  private static async initializePopulation(
    basePrompt: string,
    size: number
  ): Promise<string[]> {
    const population = [basePrompt];

    while (population.length < size) {
      const variation = ['more detailed', 'more concise', 'with examples', 'step-by-step'][
        population.length % 4
      ];
      population.push(this.applyVariation(basePrompt, variation));
    }

    return population;
  }

  /**
   * Tournament selection
   */
  private static tournamentSelection(
    population: OptimizationCandidate[],
    count: number,
    tournamentSize: number = 3
  ): OptimizationCandidate[] {
    const selected: OptimizationCandidate[] = [];

    for (let i = 0; i < count; i++) {
      const tournament: OptimizationCandidate[] = [];

      for (let j = 0; j < tournamentSize; j++) {
        const randomIndex = Math.floor(Math.random() * population.length);
        tournament.push(population[randomIndex]);
      }

      const winner = tournament.reduce((best, current) =>
        current.score > best.score ? current : best
      );

      selected.push(winner);
    }

    return selected;
  }

  /**
   * Crossover two prompts
   */
  private static crossover(prompt1: string, prompt2: string): [string, string] {
    const lines1 = prompt1.split('\n');
    const lines2 = prompt2.split('\n');

    const crossoverPoint = Math.floor(Math.random() * Math.min(lines1.length, lines2.length));

    const child1 = [
      ...lines1.slice(0, crossoverPoint),
      ...lines2.slice(crossoverPoint),
    ].join('\n');

    const child2 = [
      ...lines2.slice(0, crossoverPoint),
      ...lines1.slice(crossoverPoint),
    ].join('\n');

    return [child1, child2];
  }

  /**
   * Mutate a prompt
   */
  private static mutate(prompt: string): string {
    const mutations = [
      (p: string) => p + '\n\nBe more specific.',
      (p: string) => p.replace(/\n\n/g, '\n'),
      (p: string) => `Enhanced version:\n${p}`,
      (p: string) => p + '\n\nProvide evidence.',
    ];

    const mutation = mutations[Math.floor(Math.random() * mutations.length)];
    return mutation(prompt);
  }

  /**
   * A/B test two prompts
   */
  static async abTest(
    promptA: string,
    promptB: string,
    iterations: number = 10
  ): Promise<{
    winner: 'A' | 'B' | 'tie';
    scoreA: number;
    scoreB: number;
    confidence: number;
  }> {
    let scoreA = 0;
    let scoreB = 0;

    for (let i = 0; i < iterations; i++) {
      const evalA = await this.evaluatePrompt(promptA, i);
      const evalB = await this.evaluatePrompt(promptB, i);

      scoreA += evalA.score;
      scoreB += evalB.score;
    }

    const avgA = scoreA / iterations;
    const avgB = scoreB / iterations;
    const diff = Math.abs(avgA - avgB);

    // Simple confidence calculation
    const confidence = Math.min(diff * 100, 100);

    let winner: 'A' | 'B' | 'tie' = 'tie';
    if (avgA > avgB + 0.05) winner = 'A';
    else if (avgB > avgA + 0.05) winner = 'B';

    return {
      winner,
      scoreA: avgA,
      scoreB: avgB,
      confidence,
    };
  }
}
