import { api } from '../../services/api';
import {
  RefinementResult,
  EvaluationResult,
  PromptVersion,
  VersionDiff,
  RefinementAnalytics,
  QuickEvaluationResult,
  SuggestionResult,
  RefinementHistoryEntry,
} from './types';

export interface RefinementConfig {
  maxIterations?: number;
  targetScore?: number;
  autoApply?: boolean;
  preserveIntent?: boolean;
  evaluateSafety?: boolean;
  evaluateStyle?: boolean;
  evaluateAccuracy?: boolean;
}

export interface EvaluationCriteria {
  accuracy?: boolean;
  style?: boolean;
  safety?: boolean;
  relevance?: boolean;
  completeness?: boolean;
}

export const refinementApi = {
  /**
   * Execute self-refinement loop for a prompt
   */
  async refinePrompt(
    promptId: string,
    testOutput: string,
    config?: RefinementConfig
  ): Promise<RefinementResult> {
    const response = await api.post<{ success: boolean; data: RefinementResult }>(
      `/refinement/${promptId}/refine`,
      { testOutput, config }
    );
    return response.data.data;
  },

  /**
   * Evaluate prompt output without refinement
   */
  async evaluateOutput(
    promptId: string,
    output: string,
    criteria?: EvaluationCriteria
  ): Promise<EvaluationResult> {
    const response = await api.post<{ success: boolean; data: EvaluationResult }>(
      `/refinement/${promptId}/evaluate`,
      { output, criteria }
    );
    return response.data.data;
  },

  /**
   * Quick evaluation for real-time feedback
   */
  async quickEvaluate(promptId: string, output: string): Promise<QuickEvaluationResult> {
    const response = await api.post<{ success: boolean; data: QuickEvaluationResult }>(
      `/refinement/${promptId}/quick-evaluate`,
      { output }
    );
    return response.data.data;
  },

  /**
   * Get refinement suggestions without applying them
   */
  async suggestRefinements(promptId: string, testOutput: string): Promise<SuggestionResult> {
    const response = await api.post<{ success: boolean; data: SuggestionResult }>(
      `/refinement/${promptId}/suggest`,
      { testOutput }
    );
    return response.data.data;
  },

  /**
   * Get refinement history for a prompt
   */
  async getHistory(promptId: string): Promise<RefinementHistoryEntry[]> {
    const response = await api.get<{ success: boolean; data: RefinementHistoryEntry[] }>(
      `/refinement/${promptId}/history`
    );
    return response.data.data;
  },

  /**
   * Get all versions of a prompt
   */
  async getVersions(promptId: string): Promise<PromptVersion[]> {
    const response = await api.get<{ success: boolean; data: PromptVersion[] }>(
      `/refinement/${promptId}/versions`
    );
    return response.data.data;
  },

  /**
   * Compare two versions
   */
  async compareVersions(
    promptId: string,
    version1: number,
    version2: number
  ): Promise<VersionDiff> {
    const response = await api.get<{ success: boolean; data: VersionDiff }>(
      `/refinement/${promptId}/compare`,
      { version1, version2 }
    );
    return response.data.data;
  },

  /**
   * Get diff between two versions
   */
  async getVersionDiff(
    promptId: string,
    from: number,
    to: number
  ): Promise<VersionDiff> {
    const response = await api.get<{ success: boolean; data: VersionDiff }>(
      `/refinement/${promptId}/diff`,
      { from, to }
    );
    return response.data.data;
  },

  /**
   * Get refinement analytics for a prompt
   */
  async getAnalytics(promptId: string): Promise<RefinementAnalytics> {
    const response = await api.get<{ success: boolean; data: RefinementAnalytics }>(
      `/refinement/${promptId}/analytics`
    );
    return response.data.data;
  },

  /**
   * Initialize version history for a prompt
   */
  async initializeHistory(promptId: string): Promise<PromptVersion> {
    const response = await api.post<{ success: boolean; data: PromptVersion }>(
      `/refinement/${promptId}/initialize`
    );
    return response.data.data;
  },

  /**
   * Apply a specific version as the active version
   */
  async applyVersion(promptId: string, versionId: string): Promise<boolean> {
    const response = await api.post<{ success: boolean; data: { applied: boolean } }>(
      `/refinement/${promptId}/apply-version`,
      { versionId }
    );
    return response.data.data.applied;
  },

  /**
   * Rollback to a previous version
   */
  async rollbackToVersion(promptId: string, version: number): Promise<boolean> {
    const response = await api.post<{ success: boolean; data: { rolledBack: boolean } }>(
      `/refinement/${promptId}/rollback`,
      { version }
    );
    return response.data.data.rolledBack;
  },

  /**
   * Start continuous refinement with multiple test outputs
   */
  async startContinuousRefinement(
    promptId: string,
    testOutputs: string[],
    config?: RefinementConfig
  ): Promise<{ jobId: string; estimatedDuration: number }> {
    const response = await api.post<{
      success: boolean;
      data: { jobId: string; estimatedDuration: number };
    }>(`/refinement/${promptId}/continuous`, { testOutputs, config });
    return response.data.data;
  },
};
