// ============================================================
// Critique API Routes - Epic 4.4
// LLM-based prompt critique endpoints
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { critiqueService } from '../../services/CritiqueService.js';
import { lintPrompt, autoFixPrompt, LINT_RULE_IDS } from '../../lib/lint/index.js';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

const startCritiqueSchema = z.object({
  templateId: z.string().uuid(),
  versionId: z.string().uuid().optional(),
  mode: z.enum(['quick', 'full', 'deep']).optional(),
  workspaceId: z.string().uuid().optional(),
  budget: z.object({
    maxCalls: z.number().optional(),
    maxTokens: z.number().optional(),
    maxUSD: z.number().optional(),
  }).optional(),
});

const lintPromptSchema = z.object({
  prompt: z.object({
    system: z.string().optional(),
    developer: z.string().optional(),
    user: z.string().optional(),
    context: z.string().optional(),
  }),
  options: z.object({
    includeCategories: z.array(z.string()).optional(),
    excludeCategories: z.array(z.string()).optional(),
    includeSeverities: z.array(z.enum(['error', 'warning', 'info'])).optional(),
    excludeRules: z.array(z.string()).optional(),
  }).optional(),
});

// ============================================================
// POST /api/critique/start - Start a critique run
// ============================================================

router.post('/start', async (req: Request, res: Response) => {
  try {
    const validation = startCritiqueSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const { templateId, versionId, mode, workspaceId, budget } = validation.data;

    const result = await critiqueService.startCritique({
      templateId,
      versionId,
      mode,
      workspaceId,
      createdById: (req as any).userId,
      budget,
    });

    res.status(202).json({
      success: true,
      runId: result.runId,
      message: 'Critique started. Poll status endpoint for updates.',
    });
  } catch (error) {
    console.error('Error starting critique:', error);
    if ((error as Error).message.includes('Budget')) {
      return res.status(402).json({ error: (error as Error).message });
    }
    res.status(500).json({ error: 'Failed to start critique' });
  }
});

// ============================================================
// GET /api/critique/run/:runId - Get critique run status
// ============================================================

router.get('/run/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const run = await critiqueService.getCritiqueRun(runId);

    if (!run) {
      return res.status(404).json({ error: 'Critique run not found' });
    }

    res.json({
      run: {
        id: run.id,
        templateId: run.templateId,
        versionId: run.versionId,
        mode: run.mode,
        status: run.status,
        progress: run.progress,
        stage: run.stage,
        errorMessage: run.errorMessage,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        cost: run.cost,
      },
      result: run.result
        ? {
            summary: run.result.summary,
            overallScore: run.result.overallScore,
            issues: run.result.issuesJson,
            suggestions: run.result.suggestionsJson,
            proposedPrompt: run.result.proposedPromptSnapshot,
            analysisMetadata: run.result.analysisMetadata,
          }
        : null,
    });
  } catch (error) {
    console.error('Error getting critique run:', error);
    res.status(500).json({ error: 'Failed to get critique run' });
  }
});

// ============================================================
// GET /api/critique/template/:templateId - Get critiques for template
// ============================================================

router.get('/template/:templateId', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const { limit = '10' } = req.query;

    const runs = await critiqueService.getCritiqueRunsForTemplate(
      templateId,
      parseInt(limit as string, 10)
    );

    res.json({
      runs: runs.map(run => ({
        id: run.id,
        mode: run.mode,
        status: run.status,
        overallScore: run.result?.overallScore,
        issueCount: Array.isArray(run.result?.issuesJson)
          ? (run.result.issuesJson as unknown[]).length
          : 0,
        createdAt: run.createdAt,
        finishedAt: run.finishedAt,
      })),
    });
  } catch (error) {
    console.error('Error getting template critiques:', error);
    res.status(500).json({ error: 'Failed to get critiques' });
  }
});

// ============================================================
// POST /api/critique/cancel/:runId - Cancel a critique run
// ============================================================

router.post('/cancel/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    await critiqueService.cancelCritique(runId);

    res.json({ success: true, message: 'Critique cancelled' });
  } catch (error) {
    console.error('Error cancelling critique:', error);
    res.status(500).json({ error: 'Failed to cancel critique' });
  }
});

// ============================================================
// POST /api/critique/lint - Run static lint analysis
// ============================================================

router.post('/lint', async (req: Request, res: Response) => {
  try {
    const validation = lintPromptSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const { prompt, options } = validation.data;

    const result = lintPrompt(prompt, options);

    res.json({
      valid: result.valid,
      score: result.score,
      issues: result.issues,
      summary: result.summary,
      autoFixable: result.autoFixable,
    });
  } catch (error) {
    console.error('Error linting prompt:', error);
    res.status(500).json({ error: 'Failed to lint prompt' });
  }
});

// ============================================================
// POST /api/critique/lint/auto-fix - Apply auto-fixes
// ============================================================

router.post('/lint/auto-fix', async (req: Request, res: Response) => {
  try {
    const { prompt, issues } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    // If no issues provided, run lint first
    let issuesList = issues;
    if (!issuesList) {
      const lintResult = lintPrompt(prompt);
      issuesList = lintResult.issues;
    }

    const fixedPrompt = autoFixPrompt(prompt, issuesList);

    // Re-lint the fixed prompt
    const newLintResult = lintPrompt(fixedPrompt);

    res.json({
      original: prompt,
      fixed: fixedPrompt,
      fixesApplied: issuesList.filter((i: { autoFix?: unknown }) => i.autoFix).length,
      newScore: newLintResult.score,
      remainingIssues: newLintResult.issues.length,
    });
  } catch (error) {
    console.error('Error auto-fixing prompt:', error);
    res.status(500).json({ error: 'Failed to auto-fix prompt' });
  }
});

// ============================================================
// GET /api/critique/lint/rules - Get available lint rules
// ============================================================

router.get('/lint/rules', async (req: Request, res: Response) => {
  try {
    res.json({
      rules: LINT_RULE_IDS.map(id => {
        const [category, name] = id.split('/');
        return {
          id,
          category,
          name: name.replace(/-/g, ' '),
        };
      }),
      categories: [
        { id: 'structure', name: 'Structure', description: 'Prompt organization and completeness' },
        { id: 'clarity', name: 'Clarity', description: 'Clear and unambiguous instructions' },
        { id: 'safety', name: 'Safety', description: 'Security and misuse prevention' },
        { id: 'performance', name: 'Performance', description: 'Token efficiency and redundancy' },
        { id: 'best_practice', name: 'Best Practices', description: 'Industry-standard patterns' },
      ],
    });
  } catch (error) {
    console.error('Error getting lint rules:', error);
    res.status(500).json({ error: 'Failed to get lint rules' });
  }
});

// ============================================================
// POST /api/critique/apply-suggestion - Apply a suggestion
// ============================================================

router.post('/apply-suggestion', async (req: Request, res: Response) => {
  try {
    const { prompt, suggestionId, techniqueId } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    if (!techniqueId) {
      return res.status(400).json({ error: 'techniqueId is required for technique-based suggestions' });
    }

    // Import techniquesService dynamically to avoid circular dependency
    const { techniquesService } = await import('../../services/TechniquesService.js');

    const technique = await techniquesService.getTechniqueById(techniqueId);
    if (!technique) {
      return res.status(404).json({ error: 'Technique not found' });
    }

    const result = techniquesService.applyTechniqueToPrompt(prompt, technique);

    res.json({
      original: prompt,
      applied: result,
      appliedSuggestion: suggestionId,
      appliedTechnique: {
        id: technique.id,
        name: technique.name,
      },
    });
  } catch (error) {
    console.error('Error applying suggestion:', error);
    res.status(500).json({ error: 'Failed to apply suggestion' });
  }
});

export default router;
