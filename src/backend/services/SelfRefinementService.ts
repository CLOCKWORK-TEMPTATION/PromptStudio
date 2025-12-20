import { z } from 'zod';
import { qualityEvaluationService } from './QualityEvaluationService';
import { automaticPromptOptimizer } from './AutomaticPromptOptimizer';

const RefinementSuggestionSchema = z.object({
  id: z.string(),
  prompt_id: z.string(),
  current_version: z.number(),
  suggested_content: z.string(),
  justification: z.string(),
  expected_improvements: z.array(z.string()),
  confidence_score: z.number().min(0).max(1),
  metrics_before: z.object({
    overall_score: z.number(),
    relevance: z.number(),
    coherence: z.number(),
    groundedness: z.number()
  }),
  metrics_after: z.object({
    overall_score: z.number(),
    relevance: z.number(),
    coherence: z.number(),
    groundedness: z.number()
  }).optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'testing']),
  created_at: z.date(),
  tested_at: z.date().optional()
});

export type RefinementSuggestion = z.infer<typeof RefinementSuggestionSchema>;

export class SelfRefinementService {
  private refinementHistory: Map<string, RefinementSuggestion[]> = new Map();
  private activeRefinements: Map<string, NodeJS.Timeout> = new Map();

  // Start continuous refinement loop for a prompt
  async startRefinementLoop(
    promptId: string,
    currentContent: string,
    testCases: Array<{ input: string; expected?: string }>,
    intervalHours: number = 24
  ): Promise<void> {
    // Stop existing loop if running
    this.stopRefinementLoop(promptId);

    // Initial evaluation
    await this.evaluateAndSuggest(promptId, currentContent, testCases);

    // Schedule periodic refinement
    const interval = setInterval(async () => {
      try {
        await this.evaluateAndSuggest(promptId, currentContent, testCases);
      } catch (error) {
        console.error(`Refinement loop error for prompt ${promptId}:`, error);
      }
    }, intervalHours * 60 * 60 * 1000);

    this.activeRefinements.set(promptId, interval);
  }

  // Stop refinement loop
  stopRefinementLoop(promptId: string): void {
    const interval = this.activeRefinements.get(promptId);
    if (interval) {
      clearInterval(interval);
      this.activeRefinements.delete(promptId);
    }
  }

  // Evaluate current prompt and suggest improvements
  private async evaluateAndSuggest(
    promptId: string,
    currentContent: string,
    testCases: Array<{ input: string; expected?: string }>
  ): Promise<RefinementSuggestion> {
    // Evaluate current performance
    const currentResults = await qualityEvaluationService.evaluatePrompt(
      currentContent,
      testCases
    );

    const avgMetrics = this.calculateAverageMetrics(currentResults);

    // Generate improvement suggestion
    const suggestion = await this.generateRefinementSuggestion(
      promptId,
      currentContent,
      avgMetrics,
      testCases
    );

    // Store suggestion
    const history = this.refinementHistory.get(promptId) || [];
    history.push(suggestion);
    this.refinementHistory.set(promptId, history);

    return suggestion;
  }

  // Generate refinement suggestion using AI
  private async generateRefinementSuggestion(
    promptId: string,
    currentContent: string,
    currentMetrics: any,
    testCases: Array<{ input: string; expected?: string }>
  ): Promise<RefinementSuggestion> {
    const analysisPrompt = `
Analyze this prompt and suggest specific improvements:

Current Prompt: ${currentContent}

Current Performance Metrics:
- Overall Score: ${(currentMetrics.overall_score * 100).toFixed(1)}%
- Relevance: ${(currentMetrics.relevance * 100).toFixed(1)}%
- Coherence: ${(currentMetrics.coherence * 100).toFixed(1)}%
- Groundedness: ${(currentMetrics.groundedness * 100).toFixed(1)}%

Test Cases: ${testCases.map(tc => tc.input).join(', ')}

Provide:
1. Improved version of the prompt
2. Specific justification for changes
3. Expected improvements
4. Confidence score (0-1)

Format as JSON:
{
  "improved_prompt": "...",
  "justification": "...",
  "expected_improvements": ["...", "..."],
  "confidence": 0.8
}`;

    try {
      const openai = new (require('openai').OpenAI)({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: analysisPrompt }],
        max_tokens: 800,
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      return {
        id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        prompt_id: promptId,
        current_version: 1,
        suggested_content: result.improved_prompt || currentContent,
        justification: result.justification || 'AI-generated improvement',
        expected_improvements: result.expected_improvements || ['General improvement'],
        confidence_score: result.confidence || 0.5,
        metrics_before: currentMetrics,
        status: 'pending',
        created_at: new Date()
      };
    } catch (error) {
      console.error('Failed to generate refinement suggestion:', error);
      
      return {
        id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        prompt_id: promptId,
        current_version: 1,
        suggested_content: currentContent,
        justification: 'Failed to generate suggestion',
        expected_improvements: [],
        confidence_score: 0,
        metrics_before: currentMetrics,
        status: 'rejected',
        created_at: new Date()
      };
    }
  }

  // Test a refinement suggestion
  async testRefinementSuggestion(
    suggestionId: string,
    testCases: Array<{ input: string; expected?: string }>
  ): Promise<RefinementSuggestion> {
    const suggestion = this.findSuggestionById(suggestionId);
    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    // Test the suggested prompt
    const testResults = await qualityEvaluationService.evaluatePrompt(
      suggestion.suggested_content,
      testCases
    );

    const avgMetrics = this.calculateAverageMetrics(testResults);

    // Update suggestion with test results
    const updatedSuggestion: RefinementSuggestion = {
      ...suggestion,
      metrics_after: avgMetrics,
      status: 'testing',
      tested_at: new Date()
    };

    // Update in history
    this.updateSuggestionInHistory(updatedSuggestion);

    return updatedSuggestion;
  }

  // Approve or reject a suggestion
  async decideSuggestion(
    suggestionId: string,
    decision: 'approved' | 'rejected',
    reason?: string
  ): Promise<RefinementSuggestion> {
    const suggestion = this.findSuggestionById(suggestionId);
    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    const updatedSuggestion: RefinementSuggestion = {
      ...suggestion,
      status: decision
    };

    this.updateSuggestionInHistory(updatedSuggestion);

    return updatedSuggestion;
  }

  // Get refinement history for a prompt
  getRefinementHistory(promptId: string): RefinementSuggestion[] {
    return this.refinementHistory.get(promptId) || [];
  }

  // Get pending suggestions
  getPendingSuggestions(promptId?: string): RefinementSuggestion[] {
    if (promptId) {
      return this.getRefinementHistory(promptId).filter(s => s.status === 'pending');
    }

    const allSuggestions: RefinementSuggestion[] = [];
    for (const history of this.refinementHistory.values()) {
      allSuggestions.push(...history.filter(s => s.status === 'pending'));
    }
    return allSuggestions;
  }

  // Calculate average metrics from evaluation results
  private calculateAverageMetrics(results: any[]): any {
    if (results.length === 0) {
      return {
        overall_score: 0,
        relevance: 0,
        coherence: 0,
        groundedness: 0
      };
    }

    const totals = results.reduce((acc, result) => ({
      overall_score: acc.overall_score + result.metrics.overall_score,
      relevance: acc.relevance + result.metrics.relevance,
      coherence: acc.coherence + result.metrics.coherence,
      groundedness: acc.groundedness + result.metrics.groundedness
    }), { overall_score: 0, relevance: 0, coherence: 0, groundedness: 0 });

    return {
      overall_score: totals.overall_score / results.length,
      relevance: totals.relevance / results.length,
      coherence: totals.coherence / results.length,
      groundedness: totals.groundedness / results.length
    };
  }

  // Find suggestion by ID
  private findSuggestionById(suggestionId: string): RefinementSuggestion | null {
    for (const history of this.refinementHistory.values()) {
      const suggestion = history.find(s => s.id === suggestionId);
      if (suggestion) return suggestion;
    }
    return null;
  }

  // Update suggestion in history
  private updateSuggestionInHistory(updatedSuggestion: RefinementSuggestion): void {
    const history = this.refinementHistory.get(updatedSuggestion.prompt_id) || [];
    const index = history.findIndex(s => s.id === updatedSuggestion.id);
    if (index !== -1) {
      history[index] = updatedSuggestion;
      this.refinementHistory.set(updatedSuggestion.prompt_id, history);
    }
  }

  // Get refinement statistics
  getRefinementStats(promptId: string): {
    totalSuggestions: number;
    approvedSuggestions: number;
    rejectedSuggestions: number;
    pendingSuggestions: number;
    averageImprovement: number;
  } {
    const history = this.getRefinementHistory(promptId);
    
    const approved = history.filter(s => s.status === 'approved');
    const improvements = approved
      .filter(s => s.metrics_after)
      .map(s => s.metrics_after!.overall_score - s.metrics_before.overall_score);

    return {
      totalSuggestions: history.length,
      approvedSuggestions: approved.length,
      rejectedSuggestions: history.filter(s => s.status === 'rejected').length,
      pendingSuggestions: history.filter(s => s.status === 'pending').length,
      averageImprovement: improvements.length > 0 
        ? improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length 
        : 0
    };
  }
}

export const selfRefinementService = new SelfRefinementService();