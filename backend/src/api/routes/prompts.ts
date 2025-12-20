import { Router, Request, Response } from 'express';
import { PromptService } from '../../services/PromptService';
import { LLMServiceAdapter } from '../../services/LLMServiceAdapter';
import { SafetyService } from '../../services/SafetyService';
import { RAGService } from '../../services/RAGService';
import { PromptChainService } from '../../services/PromptChainService';
import { PromptOptimizationService } from '../../services/PromptOptimizationService';
import {
  BayesianPromptOptimizer,
  quickOptimize,
  comparePrompts,
  ExperimentConfig,
  ExperimentResult,
} from '../../services/BayesianPromptOptimizer';

// In-memory store for experiment history (in production, use database)
const experimentHistory: Map<string, ExperimentResult> = new Map();

const router = Router();

// Build hierarchical prompt
router.post('/build-hierarchical', async (req: Request, res: Response) => {
  try {
    const { systemPrompt, processPrompt, taskPrompt, outputPrompt } = req.body;

    const fullPrompt = PromptService.buildHierarchicalPrompt({
      systemPrompt,
      processPrompt,
      taskPrompt,
      outputPrompt,
    });

    res.json({ fullPrompt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to build hierarchical prompt' });
  }
});

// Generate meta-prompt
router.post('/generate-meta', async (req: Request, res: Response) => {
  try {
    const { persona, domain, timeConstraint, metaInstructions } = req.body;

    const metaPrompt = PromptService.generateMetaPrompt({
      persona,
      domain,
      timeConstraint,
      metaInstructions,
    });

    res.json({ metaPrompt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate meta-prompt' });
  }
});

// Generate session-fixed meta-prompt
router.post('/generate-session-meta', async (req: Request, res: Response) => {
  try {
    const { sessionId, persona, domain, timeConstraint, metaInstructions } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const metaPrompt = PromptService.generateSessionMetaPrompt(sessionId, {
      persona,
      domain,
      timeConstraint,
      metaInstructions,
    });

    res.json({ metaPrompt, cached: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate session meta-prompt' });
  }
});

// Clear session meta-prompt cache
router.delete('/session-meta/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    PromptService.clearSessionMetaPrompt(sessionId);

    res.json({ success: true, message: 'Session meta-prompt cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear session meta-prompt' });
  }
});

// Analyze prompt before sending
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { prompt, model } = req.body;

    const tokens = PromptService.estimateTokens(prompt);
    const cost = PromptService.estimateCost(tokens, model);
    const successProbability = await PromptService.calculateSuccessProbability(prompt);
    const safetyScore = await SafetyService.calculateSafetyScore(prompt);

    const validation = await SafetyService.validatePrompt(prompt);
    const safetyCheck = await SafetyService.performSafetyCheck(prompt);

    res.json({
      estimatedTokens: tokens,
      estimatedCost: cost,
      successProbability,
      safetyScore,
      validation,
      safetyIssues: safetyCheck.issues,
      recommendations: safetyCheck.recommendations,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze prompt' });
  }
});

// Execute Tree-of-Thought reasoning
router.post('/tree-of-thought', async (req: Request, res: Response) => {
  try {
    const { prompt, maxDepth, branchingFactor } = req.body;

    const result = await LLMServiceAdapter.executeTreeOfThought(prompt, {
      maxDepth,
      branchingFactor,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute tree-of-thought' });
  }
});

// Execute Graph-of-Thought reasoning
router.post('/graph-of-thought', async (req: Request, res: Response) => {
  try {
    const { prompt, maxNodes } = req.body;

    const result = await LLMServiceAdapter.executeGraphOfThought(prompt, {
      maxNodes,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute graph-of-thought' });
  }
});

// Generate tool plan (legacy)
router.post('/tool-plan', async (req: Request, res: Response) => {
  try {
    const { prompt, availableTools } = req.body;

    const plan = await LLMServiceAdapter.generateToolPlan(prompt, availableTools);

    res.json({ plan });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate tool plan' });
  }
});

// Advanced tool planning with reasoning
router.post('/plan-tools', async (req: Request, res: Response) => {
  try {
    const { prompt, availableTools, maxTools, requireApproval } = req.body;

    const result = await LLMServiceAdapter.planToolUsage({
      prompt,
      availableTools: availableTools || [],
      maxTools: maxTools || 5,
      requireApproval: requireApproval !== false,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to plan tool usage' });
  }
});

// Execute approved tool plan
router.post('/execute-plan', async (req: Request, res: Response) => {
  try {
    const { plan, approved } = req.body;

    if (!approved) {
      res.json({
        results: [],
        summary: 'Execution cancelled - plan not approved',
      });
      return;
    }

    // In a real implementation, executors would be provided based on registered tools
    const mockExecutors: Record<string, (params: Record<string, any>) => Promise<any>> = {};

    const result = await LLMServiceAdapter.executePlan(plan, approved, mockExecutors);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute tool plan' });
  }
});

// Self-refine prompt
router.post('/self-refine', async (req: Request, res: Response) => {
  try {
    const { prompt, executionResult, qualityMetrics } = req.body;

    const refinement = await LLMServiceAdapter.selfRefinePrompt(
      prompt,
      executionResult,
      qualityMetrics
    );

    res.json(refinement);
  } catch (error) {
    res.status(500).json({ error: 'Failed to self-refine prompt' });
  }
});

// Create prompt version
router.post('/:id/versions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, components, refinementReason, qualityScore } = req.body;

    const version = await PromptService.createPromptVersion(
      id,
      content,
      components,
      refinementReason,
      qualityScore
    );

    res.json(version);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create prompt version' });
  }
});

// Get prompt versions
router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const versions = await PromptService.getPromptVersions(id);

    res.json(versions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get prompt versions' });
  }
});

// Safety check
router.post('/safety-check', async (req: Request, res: Response) => {
  try {
    const { content, options } = req.body;

    const result = await SafetyService.performSafetyCheck(content, options);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to perform safety check' });
  }
});

// Optimize prompt (Bayesian)
router.post('/optimize/bayesian', async (req: Request, res: Response) => {
  try {
    const { prompt, iterations, populationSize } = req.body;

    const result = await PromptOptimizationService.bayesianOptimization(prompt, {
      iterations,
      populationSize,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to optimize prompt' });
  }
});

// Optimize prompt (Evolutionary)
router.post('/optimize/evolutionary', async (req: Request, res: Response) => {
  try {
    const { prompt, generations, populationSize } = req.body;

    const result = await PromptOptimizationService.evolutionaryOptimization(prompt, {
      generations,
      populationSize,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to optimize prompt' });
  }
});

// A/B test prompts
router.post('/ab-test', async (req: Request, res: Response) => {
  try {
    const { promptA, promptB, iterations } = req.body;

    const result = await PromptOptimizationService.abTest(promptA, promptB, iterations);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to perform A/B test' });
  }
});

// ============================================================================
// Bayesian/Evolutionary Prompt Optimization Experiments
// ============================================================================

// Run full Bayesian optimization experiment
router.post('/experiments/bayesian', async (req: Request, res: Response) => {
  try {
    const { prompt, config } = req.body as {
      prompt: string;
      config?: Partial<ExperimentConfig>;
    };

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const optimizer = new BayesianPromptOptimizer(prompt, config);
    const result = await optimizer.runExperiment();

    // Store in history
    experimentHistory.set(result.experimentId, result);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Bayesian experiment failed:', error);
    res.status(500).json({ error: 'Failed to run Bayesian optimization experiment' });
  }
});

// Quick optimization (simplified, fewer iterations)
router.post('/experiments/quick-optimize', async (req: Request, res: Response) => {
  try {
    const { prompt, options } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await quickOptimize(prompt, options);

    // Store in history
    experimentHistory.set(result.experimentId, result);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Quick optimization failed:', error);
    res.status(500).json({ error: 'Failed to run quick optimization' });
  }
});

// Compare multiple prompts
router.post('/experiments/compare', async (req: Request, res: Response) => {
  try {
    const { prompts, evaluationRounds } = req.body;

    if (!prompts || !Array.isArray(prompts) || prompts.length < 2) {
      return res.status(400).json({ error: 'At least 2 prompts are required for comparison' });
    }

    const result = await comparePrompts(prompts, evaluationRounds);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Prompt comparison failed:', error);
    res.status(500).json({ error: 'Failed to compare prompts' });
  }
});

// Get experiment history
router.get('/experiments/history', async (req: Request, res: Response) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const experiments = Array.from(experimentHistory.values())
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      success: true,
      data: {
        experiments,
        total: experimentHistory.size,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch experiment history' });
  }
});

// Get specific experiment by ID
router.get('/experiments/:experimentId', async (req: Request, res: Response) => {
  try {
    const { experimentId } = req.params;

    const experiment = experimentHistory.get(experimentId);

    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    res.json({
      success: true,
      data: experiment,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch experiment' });
  }
});

// Get experiment trials/details
router.get('/experiments/:experimentId/trials', async (req: Request, res: Response) => {
  try {
    const { experimentId } = req.params;
    const { iteration } = req.query;

    const experiment = experimentHistory.get(experimentId);

    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    let trials = experiment.trials;

    // Filter by iteration if specified
    if (iteration !== undefined) {
      trials = trials.filter(t => t.iteration === Number(iteration));
    }

    res.json({
      success: true,
      data: {
        trials,
        summary: experiment.summary,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch experiment trials' });
  }
});

// Apply best prompt from experiment (mark as selected)
router.post('/experiments/:experimentId/apply', async (req: Request, res: Response) => {
  try {
    const { experimentId } = req.params;

    const experiment = experimentHistory.get(experimentId);

    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    res.json({
      success: true,
      data: {
        appliedPrompt: experiment.bestPrompt,
        originalPrompt: experiment.basePrompt,
        improvement: experiment.improvement,
        message: 'Best prompt has been selected for use',
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to apply experiment result' });
  }
});

// Delete experiment from history
router.delete('/experiments/:experimentId', async (req: Request, res: Response) => {
  try {
    const { experimentId } = req.params;

    if (!experimentHistory.has(experimentId)) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    experimentHistory.delete(experimentId);

    res.json({
      success: true,
      message: 'Experiment deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete experiment' });
  }
});

// Get optimization statistics
router.get('/experiments/stats/summary', async (req: Request, res: Response) => {
  try {
    const experiments = Array.from(experimentHistory.values());

    if (experiments.length === 0) {
      return res.json({
        success: true,
        data: {
          totalExperiments: 0,
          avgImprovement: 0,
          totalTrials: 0,
          mostEffectiveMutation: null,
        },
      });
    }

    const totalExperiments = experiments.length;
    const avgImprovement = experiments.reduce((sum, e) => sum + e.improvement, 0) / totalExperiments;
    const totalTrials = experiments.reduce((sum, e) => sum + e.trials.length, 0);

    // Calculate most effective mutation across all experiments
    const mutationScores: Record<string, number[]> = {};
    for (const exp of experiments) {
      for (const [type, score] of Object.entries(exp.summary.mutationEffectiveness)) {
        if (!mutationScores[type]) {
          mutationScores[type] = [];
        }
        mutationScores[type].push(score);
      }
    }

    let mostEffectiveMutation: string | null = null;
    let highestAvgScore = 0;
    for (const [type, scores] of Object.entries(mutationScores)) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg > highestAvgScore) {
        highestAvgScore = avg;
        mostEffectiveMutation = type;
      }
    }

    res.json({
      success: true,
      data: {
        totalExperiments,
        avgImprovement: avgImprovement.toFixed(2),
        totalTrials,
        mostEffectiveMutation,
        mutationEffectiveness: Object.fromEntries(
          Object.entries(mutationScores).map(([type, scores]) => [
            type,
            (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3),
          ])
        ),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch experiment statistics' });
  }
});

export default router;
