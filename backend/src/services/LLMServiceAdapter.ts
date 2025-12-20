import { PromptService } from './PromptService';
import OpenAI from 'openai';
import { config } from '../config/index.js';

export interface ThoughtNode {
  id: string;
  content: string;
  score: number;
  children: ThoughtNode[];
  depth: number;
  reasoning?: string;
}

export interface ReasoningPath {
  nodes: ThoughtNode[];
  totalScore: number;
  finalAnswer: string;
}

export interface ToolPlan {
  toolName: string;
  reason: string;
  parameters: Record<string, any>;
  order: number;
  confidence: number;
  estimatedDuration?: string;
  dependencies?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, {
    type: string;
    description: string;
    required?: boolean;
  }>;
  category?: string;
}

export interface ToolPlanningResult {
  plan: ToolPlan[];
  reasoning: string;
  alternativePlans?: ToolPlan[][];
  warnings?: string[];
  totalEstimatedDuration?: string;
  planEnabled: boolean;
}

export interface ToolExecutionContext {
  prompt: string;
  availableTools: ToolDefinition[];
  previousResults?: Record<string, any>;
  maxTools?: number;
  requireApproval?: boolean;
}

export class LLMServiceAdapter {
  /**
   * Execute Tree-of-Thought reasoning
   */
  static async executeTreeOfThought(
    prompt: string,
    options: {
      maxDepth?: number;
      branchingFactor?: number;
      evaluationCriteria?: string[];
    } = {}
  ): Promise<ReasoningPath> {
    const { maxDepth = 3, branchingFactor = 3, evaluationCriteria = ['coherence', 'relevance', 'completeness'] } = options;

    // Build the reasoning tree
    const root: ThoughtNode = {
      id: 'root',
      content: prompt,
      score: 1.0,
      children: [],
      depth: 0,
    };

    await this.expandNode(root, maxDepth, branchingFactor);

    // Find the best path
    const bestPath = this.findBestPath(root, evaluationCriteria);

    return bestPath;
  }

  /**
   * Expand a thought node recursively
   */
  private static async expandNode(
    node: ThoughtNode,
    maxDepth: number,
    branchingFactor: number
  ): Promise<void> {
    if (node.depth >= maxDepth) {
      return;
    }

    // Generate child thoughts
    for (let i = 0; i < branchingFactor; i++) {
      const childThought = await this.generateThought(node.content, i);
      const childScore = await this.evaluateThought(childThought);

      const childNode: ThoughtNode = {
        id: `${node.id}-${i}`,
        content: childThought,
        score: childScore,
        children: [],
        depth: node.depth + 1,
      };

      node.children.push(childNode);

      // Recursively expand if promising
      if (childScore > 0.6) {
        await this.expandNode(childNode, maxDepth, branchingFactor);
      }
    }
  }

  /**
   * Generate a thought continuation using LLM
   */
  private static async generateThought(context: string, variant: number): Promise<string> {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const openai = new OpenAI({ apiKey: config.openai.apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert reasoning assistant. Generate a thoughtful continuation or reasoning step based on the given context. Be specific and analytical.',
        },
        {
          role: 'user',
          content: `Context: ${context}\n\nGenerate reasoning step variant ${variant + 1}. Explore a different angle or approach.`,
        },
      ],
      temperature: 0.7 + (variant * 0.1),
      max_tokens: 300,
    });

    return response.choices[0]?.message?.content?.trim() || `Thought continuation ${variant}`;
  }

  /**
   * Evaluate a thought using LLM-as-a-Judge
   */
  private static async evaluateThought(thought: string, criteria: string[] = ['coherence', 'relevance', 'completeness']): Promise<number> {
    if (!config.openai.apiKey) {
      // Fallback to heuristic evaluation
      return this.heuristicEvaluateThought(thought);
    }

    const openai = new OpenAI({ apiKey: config.openai.apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are an expert evaluator. Evaluate the following thought based on these criteria: ${criteria.join(', ')}. Return ONLY a JSON object with a 'score' field (0-1) and a 'reasoning' field explaining your evaluation.`,
        },
        {
          role: 'user',
          content: `Evaluate this thought:\n\n${thought}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    try {
      const result = JSON.parse(response.choices[0]?.message?.content || '{"score": 0.5}');
      return Math.min(Math.max(result.score || 0.5, 0), 1);
    } catch {
      return this.heuristicEvaluateThought(thought);
    }
  }

  /**
   * Fallback heuristic evaluation
   */
  private static heuristicEvaluateThought(thought: string): number {
    let score = 0.5;

    // Check for coherence (presence of connecting words)
    const connectingWords = ['therefore', 'thus', 'because', 'since', 'however', 'moreover'];
    const hasCoherence = connectingWords.some(word => thought.toLowerCase().includes(word));
    if (hasCoherence) score += 0.2;

    // Check for length (not too short)
    if (thought.length > 50) score += 0.1;

    // Check for specificity (numbers, facts)
    if (/\d+/.test(thought)) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Find the best reasoning path through the tree
   */
  private static findBestPath(root: ThoughtNode, criteria: string[]): ReasoningPath {
    let bestPath: ThoughtNode[] = [];
    let bestScore = 0;

    const explorePath = (node: ThoughtNode, currentPath: ThoughtNode[], currentScore: number) => {
      currentPath.push(node);
      currentScore += node.score;

      if (node.children.length === 0) {
        // Leaf node - check if this is the best path
        if (currentScore > bestScore) {
          bestScore = currentScore;
          bestPath = [...currentPath];
        }
      } else {
        // Continue exploring children
        for (const child of node.children) {
          explorePath(child, currentPath, currentScore);
        }
      }

      currentPath.pop();
    };

    explorePath(root, [], 0);

    return {
      nodes: bestPath,
      totalScore: bestScore,
      finalAnswer: bestPath.length > 0 ? bestPath[bestPath.length - 1].content : '',
    };
  }

  /**
   * Execute Graph-of-Thought reasoning
   */
  static async executeGraphOfThought(
    prompt: string,
    options: {
      maxNodes?: number;
      connectionThreshold?: number;
    } = {}
  ): Promise<{
    nodes: ThoughtNode[];
    connections: Array<{ from: string; to: string; weight: number }>;
    synthesis: string;
  }> {
    const { maxNodes = 10, connectionThreshold = 0.5 } = options;

    const nodes: ThoughtNode[] = [];
    const connections: Array<{ from: string; to: string; weight: number }> = [];

    // Generate initial thoughts
    for (let i = 0; i < maxNodes; i++) {
      const thought = await this.generateThought(prompt, i);
      const score = await this.evaluateThought(thought);

      nodes.push({
        id: `node-${i}`,
        content: thought,
        score,
        children: [],
        depth: 0,
      });
    }

    // Find connections between nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const similarity = this.calculateSimilarity(nodes[i].content, nodes[j].content);
        if (similarity > connectionThreshold) {
          connections.push({
            from: nodes[i].id,
            to: nodes[j].id,
            weight: similarity,
          });
        }
      }
    }

    // Synthesize final answer from the graph
    const synthesis = this.synthesizeFromGraph(nodes, connections);

    return { nodes, connections, synthesis };
  }

  /**
   * Calculate similarity between two texts
   */
  private static calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Synthesize final answer from graph
   */
  private static synthesizeFromGraph(
    nodes: ThoughtNode[],
    connections: Array<{ from: string; to: string; weight: number }>
  ): string {
    // Find the most connected and highest-scored nodes
    const nodeScores = new Map<string, number>();

    nodes.forEach(node => {
      let totalScore = node.score;

      // Add connection weights
      connections.forEach(conn => {
        if (conn.from === node.id || conn.to === node.id) {
          totalScore += conn.weight * 0.1;
        }
      });

      nodeScores.set(node.id, totalScore);
    });

    // Get top nodes
    const sortedNodes = nodes.sort((a, b) =>
      (nodeScores.get(b.id) || 0) - (nodeScores.get(a.id) || 0)
    );

    const topThoughts = sortedNodes.slice(0, 3).map(n => n.content);
    return `Synthesized answer:\n${topThoughts.join('\n\n')}`;
  }

  /**
   * Advanced tool planning with reasoning and confidence scoring
   */
  static async planToolUsage(
    context: ToolExecutionContext
  ): Promise<ToolPlanningResult> {
    const { prompt, availableTools, maxTools = 5, requireApproval = true } = context;

    const plan: ToolPlan[] = [];
    const warnings: string[] = [];
    let reasoning = '';

    // Step 1: Intent Analysis
    const intentAnalysis = this.analyzeIntent(prompt);
    reasoning += `Intent Analysis: ${intentAnalysis.summary}\n`;
    reasoning += `Detected actions: ${intentAnalysis.actions.join(', ')}\n\n`;

    // Step 2: Tool Matching with semantic analysis
    const toolScores = availableTools.map(tool => {
      const score = this.calculateToolRelevance(prompt, tool, intentAnalysis);
      return { tool, score };
    });

    // Sort by relevance score
    toolScores.sort((a, b) => b.score.total - a.score.total);

    // Step 3: Build execution plan
    const selectedTools = toolScores
      .filter(ts => ts.score.total > 0.3)
      .slice(0, maxTools);

    reasoning += `Tool Selection:\n`;

    selectedTools.forEach((ts, index) => {
      const dependencies = this.findDependencies(ts.tool.name, selectedTools.slice(0, index).map(t => t.tool.name));

      const toolPlan: ToolPlan = {
        toolName: ts.tool.name,
        reason: ts.score.reason,
        parameters: this.inferParameters(prompt, ts.tool),
        order: index + 1,
        confidence: ts.score.total,
        estimatedDuration: this.estimateDuration(ts.tool),
        dependencies,
      };

      plan.push(toolPlan);
      reasoning += `  ${index + 1}. ${ts.tool.name} (confidence: ${(ts.score.total * 100).toFixed(0)}%)\n`;
      reasoning += `     Reason: ${ts.score.reason}\n`;
    });

    // Step 4: Validate plan
    const validation = this.validatePlan(plan, availableTools);
    if (validation.warnings.length > 0) {
      warnings.push(...validation.warnings);
    }

    // Step 5: Generate alternative plans if low confidence
    let alternativePlans: ToolPlan[][] | undefined;
    if (plan.length > 0 && plan[0].confidence < 0.7) {
      alternativePlans = this.generateAlternativePlans(toolScores, maxTools);
      reasoning += `\nAlternative plans generated due to low confidence.\n`;
    }

    // Calculate total estimated duration
    const totalEstimatedDuration = this.calculateTotalDuration(plan);

    return {
      plan,
      reasoning,
      alternativePlans,
      warnings,
      totalEstimatedDuration,
      planEnabled: requireApproval,
    };
  }

  /**
   * Analyze the intent of the prompt
   */
  private static analyzeIntent(prompt: string): {
    summary: string;
    actions: string[];
    entities: string[];
    complexity: 'simple' | 'moderate' | 'complex';
  } {
    const lowerPrompt = prompt.toLowerCase();
    const actions: string[] = [];
    const entities: string[] = [];

    // Detect action verbs
    const actionPatterns = [
      { pattern: /\b(search|find|look for|query)\b/gi, action: 'search' },
      { pattern: /\b(create|generate|make|build)\b/gi, action: 'create' },
      { pattern: /\b(analyze|examine|inspect|review)\b/gi, action: 'analyze' },
      { pattern: /\b(calculate|compute|sum|average)\b/gi, action: 'calculate' },
      { pattern: /\b(translate|convert|transform)\b/gi, action: 'transform' },
      { pattern: /\b(send|post|submit|upload)\b/gi, action: 'send' },
      { pattern: /\b(fetch|get|retrieve|download)\b/gi, action: 'fetch' },
      { pattern: /\b(update|modify|change|edit)\b/gi, action: 'update' },
      { pattern: /\b(delete|remove|clear)\b/gi, action: 'delete' },
      { pattern: /\b(compare|diff|contrast)\b/gi, action: 'compare' },
    ];

    actionPatterns.forEach(({ pattern, action }) => {
      if (pattern.test(lowerPrompt) && !actions.includes(action)) {
        actions.push(action);
      }
    });

    // Detect entities
    const entityPatterns = [
      { pattern: /\b(file|document|pdf|image)\b/gi, entity: 'file' },
      { pattern: /\b(database|db|table|record)\b/gi, entity: 'database' },
      { pattern: /\b(api|endpoint|service|url)\b/gi, entity: 'api' },
      { pattern: /\b(email|message|notification)\b/gi, entity: 'communication' },
      { pattern: /\b(user|account|profile)\b/gi, entity: 'user' },
      { pattern: /\b(data|json|xml|csv)\b/gi, entity: 'data' },
    ];

    entityPatterns.forEach(({ pattern, entity }) => {
      if (pattern.test(lowerPrompt) && !entities.includes(entity)) {
        entities.push(entity);
      }
    });

    // Determine complexity
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (actions.length > 3 || entities.length > 3) {
      complexity = 'complex';
    } else if (actions.length > 1 || entities.length > 1) {
      complexity = 'moderate';
    }

    const summary = `Task involves ${actions.length} action(s) on ${entities.length} entity type(s). Complexity: ${complexity}`;

    return { summary, actions, entities, complexity };
  }

  /**
   * Calculate tool relevance score
   */
  private static calculateToolRelevance(
    prompt: string,
    tool: ToolDefinition,
    intent: { actions: string[]; entities: string[] }
  ): { total: number; reason: string } {
    const lowerPrompt = prompt.toLowerCase();
    const toolDesc = tool.description.toLowerCase();
    const toolName = tool.name.toLowerCase();

    let score = 0;
    const reasons: string[] = [];

    // Direct name match
    if (lowerPrompt.includes(toolName)) {
      score += 0.4;
      reasons.push('Direct tool name match');
    }

    // Keyword overlap with description
    const descWords = toolDesc.split(/\s+/).filter(w => w.length > 3);
    const matchedWords = descWords.filter(word => lowerPrompt.includes(word));
    const keywordScore = matchedWords.length / Math.max(descWords.length, 1);
    if (keywordScore > 0) {
      score += keywordScore * 0.3;
      reasons.push(`${matchedWords.length} keyword matches`);
    }

    // Intent alignment
    const toolActions = this.extractActionsFromDescription(toolDesc);
    const actionOverlap = intent.actions.filter(a => toolActions.includes(a));
    if (actionOverlap.length > 0) {
      score += 0.2 * actionOverlap.length;
      reasons.push(`Aligned actions: ${actionOverlap.join(', ')}`);
    }

    // Category bonus
    if (tool.category) {
      const categoryMatch = intent.entities.some(e =>
        tool.category!.toLowerCase().includes(e)
      );
      if (categoryMatch) {
        score += 0.1;
        reasons.push('Category match');
      }
    }

    return {
      total: Math.min(score, 1.0),
      reason: reasons.join('; ') || 'Low relevance',
    };
  }

  /**
   * Extract actions from tool description
   */
  private static extractActionsFromDescription(description: string): string[] {
    const actionVerbs = [
      'search', 'create', 'analyze', 'calculate', 'transform',
      'send', 'fetch', 'update', 'delete', 'compare', 'generate',
      'retrieve', 'process', 'validate', 'format',
    ];

    return actionVerbs.filter(verb => description.includes(verb));
  }

  /**
   * Infer parameters from prompt and tool definition
   */
  private static inferParameters(
    prompt: string,
    tool: ToolDefinition
  ): Record<string, any> {
    const params: Record<string, any> = {};

    if (!tool.parameters) return params;

    // Extract common patterns
    Object.entries(tool.parameters).forEach(([paramName, paramDef]) => {
      // URL extraction
      if (paramDef.type === 'string' && paramName.toLowerCase().includes('url')) {
        const urlMatch = prompt.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          params[paramName] = urlMatch[0];
        }
      }

      // Number extraction
      if (paramDef.type === 'number') {
        const numberMatch = prompt.match(/\b(\d+)\b/);
        if (numberMatch) {
          params[paramName] = parseInt(numberMatch[1]);
        }
      }

      // Query/text extraction
      if (paramDef.type === 'string' &&
          (paramName.toLowerCase().includes('query') ||
           paramName.toLowerCase().includes('text'))) {
        // Use the main content as query
        params[paramName] = prompt.substring(0, 200);
      }
    });

    return params;
  }

  /**
   * Find dependencies between tools
   */
  private static findDependencies(
    toolName: string,
    previousTools: string[]
  ): string[] {
    const dependencyMap: Record<string, string[]> = {
      'analyze': ['fetch', 'search', 'retrieve'],
      'transform': ['fetch', 'analyze'],
      'send': ['create', 'generate', 'transform'],
      'compare': ['fetch', 'search'],
    };

    const dependencies: string[] = [];
    const toolLower = toolName.toLowerCase();

    Object.entries(dependencyMap).forEach(([action, deps]) => {
      if (toolLower.includes(action)) {
        deps.forEach(dep => {
          const matchingPrevTool = previousTools.find(pt =>
            pt.toLowerCase().includes(dep)
          );
          if (matchingPrevTool) {
            dependencies.push(matchingPrevTool);
          }
        });
      }
    });

    return dependencies;
  }

  /**
   * Estimate execution duration for a tool
   */
  private static estimateDuration(tool: ToolDefinition): string {
    const category = tool.category?.toLowerCase() || '';
    const name = tool.name.toLowerCase();

    if (category.includes('api') || name.includes('fetch')) {
      return '1-3s';
    }
    if (category.includes('database') || name.includes('query')) {
      return '0.5-2s';
    }
    if (name.includes('analyze') || name.includes('process')) {
      return '2-5s';
    }
    if (name.includes('generate') || name.includes('create')) {
      return '3-10s';
    }

    return '1-2s';
  }

  /**
   * Validate the execution plan
   */
  private static validatePlan(
    plan: ToolPlan[],
    availableTools: ToolDefinition[]
  ): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // Check for missing dependencies
    plan.forEach((step, index) => {
      if (step.dependencies && step.dependencies.length > 0) {
        step.dependencies.forEach(dep => {
          const depIndex = plan.findIndex(p => p.toolName === dep);
          if (depIndex === -1) {
            warnings.push(`${step.toolName} depends on ${dep} which is not in the plan`);
          } else if (depIndex >= index) {
            warnings.push(`${step.toolName} depends on ${dep} but it comes after`);
          }
        });
      }
    });

    // Check for low confidence tools
    plan.forEach(step => {
      if (step.confidence < 0.5) {
        warnings.push(`${step.toolName} has low confidence (${(step.confidence * 100).toFixed(0)}%)`);
      }
    });

    // Check for empty plan
    if (plan.length === 0) {
      warnings.push('No tools were selected for this task');
    }

    return { valid: warnings.length === 0, warnings };
  }

  /**
   * Generate alternative execution plans
   */
  private static generateAlternativePlans(
    toolScores: Array<{ tool: ToolDefinition; score: { total: number; reason: string } }>,
    maxTools: number
  ): ToolPlan[][] {
    const alternatives: ToolPlan[][] = [];

    // Generate up to 2 alternative plans with different tool combinations
    for (let i = 1; i <= 2; i++) {
      const altPlan: ToolPlan[] = [];
      const offset = i * 2;

      toolScores
        .slice(offset, offset + maxTools)
        .filter(ts => ts.score.total > 0.2)
        .forEach((ts, index) => {
          altPlan.push({
            toolName: ts.tool.name,
            reason: ts.score.reason,
            parameters: {},
            order: index + 1,
            confidence: ts.score.total,
          });
        });

      if (altPlan.length > 0) {
        alternatives.push(altPlan);
      }
    }

    return alternatives;
  }

  /**
   * Calculate total duration for the plan
   */
  private static calculateTotalDuration(plan: ToolPlan[]): string {
    let minTotal = 0;
    let maxTotal = 0;

    plan.forEach(step => {
      if (step.estimatedDuration) {
        const match = step.estimatedDuration.match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/);
        if (match) {
          minTotal += parseFloat(match[1]);
          maxTotal += parseFloat(match[2]);
        }
      }
    });

    if (minTotal === 0 && maxTotal === 0) {
      return 'Unknown';
    }

    return `${minTotal.toFixed(1)}-${maxTotal.toFixed(1)}s`;
  }

  /**
   * Execute planned tools with approval flow
   */
  static async executePlan(
    plan: ToolPlan[],
    approved: boolean,
    executors: Record<string, (params: Record<string, any>) => Promise<any>>
  ): Promise<{
    results: Array<{ tool: string; success: boolean; result?: any; error?: string }>;
    summary: string;
  }> {
    if (!approved) {
      return {
        results: [],
        summary: 'Execution cancelled - plan not approved',
      };
    }

    const results: Array<{ tool: string; success: boolean; result?: any; error?: string }> = [];

    for (const step of plan) {
      try {
        const executor = executors[step.toolName];
        if (!executor) {
          results.push({
            tool: step.toolName,
            success: false,
            error: 'No executor found for this tool',
          });
          continue;
        }

        const result = await executor(step.parameters);
        results.push({
          tool: step.toolName,
          success: true,
          result,
        });
      } catch (error) {
        results.push({
          tool: step.toolName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const summary = `Executed ${results.length} tools: ${successCount} succeeded, ${results.length - successCount} failed`;

    return { results, summary };
  }

  /**
   * Generate tool usage plan (legacy method for backward compatibility)
   */
  static async generateToolPlan(
    prompt: string,
    availableTools: Array<{ name: string; description: string }>
  ): Promise<ToolPlan[]> {
    const result = await this.planToolUsage({
      prompt,
      availableTools: availableTools.map(t => ({
        name: t.name,
        description: t.description,
      })),
      requireApproval: false,
    });

    return result.plan;
  }

  /**
   * Self-refine a prompt based on execution results
   */
  static async selfRefinePrompt(
    originalPrompt: string,
    executionResult: string,
    qualityMetrics: {
      accuracy?: number;
      completeness?: number;
      style?: number;
    }
  ): Promise<{
    refinedPrompt: string;
    refinementReason: string;
    improvements: string[];
  }> {
    const improvements: string[] = [];
    let refinedPrompt = originalPrompt;
    let refinementReason = '';

    // Analyze quality metrics
    const avgQuality = Object.values(qualityMetrics).reduce((sum, val) => sum + (val || 0), 0) /
      Object.keys(qualityMetrics).length;

    if (avgQuality < 0.7) {
      refinementReason = 'Quality metrics below threshold';

      // Check specific issues
      if ((qualityMetrics.accuracy || 0) < 0.7) {
        improvements.push('Add more specific examples');
        refinedPrompt += '\n\nPlease provide specific, accurate examples in your response.';
      }

      if ((qualityMetrics.completeness || 0) < 0.7) {
        improvements.push('Request comprehensive coverage');
        refinedPrompt += '\n\nEnsure your response covers all aspects of the question comprehensively.';
      }

      if ((qualityMetrics.style || 0) < 0.7) {
        improvements.push('Clarify output format');
        refinedPrompt += '\n\nFollow a clear, structured format in your response.';
      }
    } else {
      refinementReason = 'Quality acceptable, minor optimizations applied';
      improvements.push('Optimize for clarity');
    }

    return {
      refinedPrompt,
      refinementReason,
      improvements,
    };
  }
}
