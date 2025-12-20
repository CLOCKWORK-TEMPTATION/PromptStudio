import { z } from 'zod';
import { qualityEvaluationService, EvaluationResult } from './QualityEvaluationService';

// APO Schemas
const OptimizationConfigSchema = z.object({
  population_size: z.number().min(4).max(50).default(10),
  generations: z.number().min(5).max(100).default(20),
  mutation_rate: z.number().min(0.01).max(0.5).default(0.1),
  crossover_rate: z.number().min(0.1).max(0.9).default(0.7),
  elite_size: z.number().min(1).max(10).default(2),
  fitness_threshold: z.number().min(0.5).max(1).default(0.9)
});

const PromptGeneSchema = z.object({
  id: z.string(),
  content: z.string(),
  fitness: z.number().default(0),
  generation: z.number().default(0),
  parent_ids: z.array(z.string()).default([]),
  mutations: z.array(z.string()).default([])
});

export type OptimizationConfig = z.infer<typeof OptimizationConfigSchema>;
export type PromptGene = z.infer<typeof PromptGeneSchema>;

export class AutomaticPromptOptimizer {
  private config: OptimizationConfig;
  private testCases: Array<{ input: string; expected?: string }>;
  private context?: string;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = OptimizationConfigSchema.parse(config);
    this.testCases = [];
  }

  // Set test cases for optimization
  setTestCases(testCases: Array<{ input: string; expected?: string }>, context?: string) {
    this.testCases = testCases;
    this.context = context;
  }

  // Main optimization loop
  async optimize(initialPrompt: string): Promise<{
    bestPrompt: PromptGene;
    history: PromptGene[][];
    convergenceData: number[];
  }> {
    // Initialize population
    let population = await this.initializePopulation(initialPrompt);
    const history: PromptGene[][] = [];
    const convergenceData: number[] = [];

    for (let generation = 0; generation < this.config.generations; generation++) {
      console.log(`Generation ${generation + 1}/${this.config.generations}`);

      // Evaluate fitness
      population = await this.evaluateFitness(population, generation);
      
      // Track progress
      const bestFitness = Math.max(...population.map(p => p.fitness));
      convergenceData.push(bestFitness);
      history.push([...population]);

      // Check convergence
      if (bestFitness >= this.config.fitness_threshold) {
        console.log(`Converged at generation ${generation + 1} with fitness ${bestFitness}`);
        break;
      }

      // Create next generation
      population = await this.createNextGeneration(population, generation + 1);
    }

    // Return best result
    const bestPrompt = population.reduce((best, current) => 
      current.fitness > best.fitness ? current : best
    );

    return { bestPrompt, history, convergenceData };
  }

  // Initialize population with variations of the original prompt
  private async initializePopulation(basePrompt: string): Promise<PromptGene[]> {
    const population: PromptGene[] = [];

    // Add original prompt
    population.push({
      id: this.generateId(),
      content: basePrompt,
      fitness: 0,
      generation: 0,
      parent_ids: [],
      mutations: []
    });

    // Generate variations
    for (let i = 1; i < this.config.population_size; i++) {
      const variation = await this.mutatePrompt(basePrompt, ['initial_variation']);
      population.push({
        id: this.generateId(),
        content: variation,
        fitness: 0,
        generation: 0,
        parent_ids: [],
        mutations: ['initial_variation']
      });
    }

    return population;
  }

  // Evaluate fitness of all prompts in population
  private async evaluateFitness(population: PromptGene[], generation: number): Promise<PromptGene[]> {
    const evaluatedPopulation: PromptGene[] = [];

    for (const prompt of population) {
      if (prompt.fitness === 0) { // Only evaluate if not already evaluated
        const results = await qualityEvaluationService.evaluatePrompt(
          prompt.content,
          this.testCases,
          this.context
        );

        const avgFitness = results.reduce((sum, r) => sum + r.metrics.overall_score, 0) / results.length;
        
        evaluatedPopulation.push({
          ...prompt,
          fitness: avgFitness,
          generation
        });
      } else {
        evaluatedPopulation.push(prompt);
      }
    }

    return evaluatedPopulation.sort((a, b) => b.fitness - a.fitness);
  }

  // Create next generation using genetic operations
  private async createNextGeneration(population: PromptGene[], generation: number): Promise<PromptGene[]> {
    const nextGeneration: PromptGene[] = [];

    // Elitism - keep best performers
    const elite = population.slice(0, this.config.elite_size);
    nextGeneration.push(...elite.map(p => ({ ...p, generation })));

    // Generate offspring
    while (nextGeneration.length < this.config.population_size) {
      const parent1 = this.selectParent(population);
      const parent2 = this.selectParent(population);

      let offspring: PromptGene;

      if (Math.random() < this.config.crossover_rate) {
        // Crossover
        offspring = await this.crossover(parent1, parent2, generation);
      } else {
        // Clone parent
        offspring = {
          ...parent1,
          id: this.generateId(),
          generation,
          parent_ids: [parent1.id]
        };
      }

      // Mutation
      if (Math.random() < this.config.mutation_rate) {
        offspring = await this.mutate(offspring);
      }

      nextGeneration.push(offspring);
    }

    return nextGeneration;
  }

  // Tournament selection
  private selectParent(population: PromptGene[]): PromptGene {
    const tournamentSize = Math.min(3, population.length);
    const tournament = [];

    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * population.length);
      tournament.push(population[randomIndex]);
    }

    return tournament.reduce((best, current) => 
      current.fitness > best.fitness ? current : best
    );
  }

  // Crossover two prompts
  private async crossover(parent1: PromptGene, parent2: PromptGene, generation: number): Promise<PromptGene> {
    const crossoverPrompt = `
Create a new prompt by combining the best elements of these two prompts:

Prompt 1: ${parent1.content}
Prompt 2: ${parent2.content}

Create a hybrid that maintains clarity and effectiveness. Return only the new prompt.`;

    try {
      const openai = new (require('openai').OpenAI)({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: crossoverPrompt }],
        max_tokens: 500,
        temperature: 0.7
      });

      const newContent = response.choices[0]?.message?.content || parent1.content;

      return {
        id: this.generateId(),
        content: newContent,
        fitness: 0,
        generation,
        parent_ids: [parent1.id, parent2.id],
        mutations: ['crossover']
      };
    } catch (error) {
      console.error('Crossover failed:', error);
      return {
        ...parent1,
        id: this.generateId(),
        generation,
        parent_ids: [parent1.id, parent2.id]
      };
    }
  }

  // Mutate a prompt
  private async mutate(prompt: PromptGene): Promise<PromptGene> {
    const mutationTypes = [
      'add_detail',
      'simplify',
      'reorder',
      'add_example',
      'change_tone',
      'add_constraint'
    ];

    const mutationType = mutationTypes[Math.floor(Math.random() * mutationTypes.length)];
    const mutatedContent = await this.mutatePrompt(prompt.content, [mutationType]);

    return {
      ...prompt,
      id: this.generateId(),
      content: mutatedContent,
      fitness: 0,
      mutations: [...prompt.mutations, mutationType]
    };
  }

  // Apply specific mutation to prompt
  private async mutatePrompt(prompt: string, mutations: string[]): Promise<string> {
    const mutation = mutations[mutations.length - 1];
    
    const mutationPrompts = {
      add_detail: `Add more specific details to this prompt while keeping it concise: ${prompt}`,
      simplify: `Simplify this prompt while maintaining its core purpose: ${prompt}`,
      reorder: `Reorder the elements of this prompt for better flow: ${prompt}`,
      add_example: `Add a brief example to this prompt: ${prompt}`,
      change_tone: `Adjust the tone of this prompt to be more engaging: ${prompt}`,
      add_constraint: `Add a helpful constraint or guideline to this prompt: ${prompt}`,
      initial_variation: `Create a variation of this prompt with similar intent: ${prompt}`
    };

    const mutationPrompt = mutationPrompts[mutation as keyof typeof mutationPrompts] || 
                          `Improve this prompt: ${prompt}`;

    try {
      const openai = new (require('openai').OpenAI)({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: mutationPrompt }],
        max_tokens: 500,
        temperature: 0.8
      });

      return response.choices[0]?.message?.content || prompt;
    } catch (error) {
      console.error('Mutation failed:', error);
      return prompt;
    }
  }

  // Generate unique ID
  private generateId(): string {
    return `gene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get optimization statistics
  getOptimizationStats(history: PromptGene[][], convergenceData: number[]) {
    return {
      totalGenerations: history.length,
      finalFitness: convergenceData[convergenceData.length - 1],
      improvementRate: convergenceData[convergenceData.length - 1] - convergenceData[0],
      convergenceGeneration: convergenceData.findIndex(fitness => fitness >= this.config.fitness_threshold) + 1,
      diversityMetrics: this.calculateDiversity(history[history.length - 1])
    };
  }

  // Calculate population diversity
  private calculateDiversity(population: PromptGene[]): number {
    const lengths = population.map(p => p.content.length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    return Math.sqrt(variance) / avgLength;
  }
}

export const automaticPromptOptimizer = new AutomaticPromptOptimizer();