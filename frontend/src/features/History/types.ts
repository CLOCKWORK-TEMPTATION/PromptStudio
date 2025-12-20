export interface RefinementSuggestion {
  type: 'add_clarity' | 'improve_structure' | 'add_examples' | 'specify_output' | 'add_constraints' | 'safety_improvement';
  priority: 'high' | 'medium' | 'low';
  description: string;
  suggestedChange: string;
  affectedSection: 'system' | 'process' | 'task' | 'output' | 'general';
}

export interface EvaluationScores {
  accuracy: {
    score: number;
    factualCorrectness: number;
    logicalConsistency: number;
    relevanceToPrompt: number;
    issues: string[];
  };
  style: {
    score: number;
    clarity: number;
    coherence: number;
    toneMatch: number;
    formatting: number;
    issues: string[];
  };
  safety: {
    passed: boolean;
    issues: Array<{
      type: string;
      severity: string;
      description: string;
    }>;
    recommendations: string[];
  };
  relevance: {
    score: number;
    issues: string[];
  };
  completeness: {
    score: number;
    missingElements: string[];
  };
}

export interface EvaluationResult extends EvaluationScores {
  overallScore: number;
  improvements: string[];
  suggestedRefinements: RefinementSuggestion[];
  evaluatedAt: string;
}

export interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  content: string;
  systemPrompt?: string;
  processPrompt?: string;
  taskPrompt?: string;
  outputPrompt?: string;
  refinementReason?: string;
  qualityScore?: number;
  performanceMetrics?: Record<string, any>;
  createdAt: string;
}

export interface RefinementIteration {
  iteration: number;
  originalPrompt: string;
  refinedPrompt: string;
  evaluation: EvaluationResult;
  appliedSuggestions: RefinementSuggestion[];
  improvementDelta: number;
  timestamp: string;
}

export interface RefinementResult {
  success: boolean;
  originalPrompt: string;
  finalPrompt: string;
  iterations: RefinementIteration[];
  totalImprovement: number;
  finalScore: number;
  versionId?: string;
  executionTimeMs: number;
}

export interface RefinementHistoryEntry {
  id: string;
  promptId: string;
  version: number;
  originalContent: string;
  refinedContent: string;
  originalScore: number;
  refinedScore: number;
  refinementReason: string;
  appliedSuggestions: RefinementSuggestion[];
  createdAt: string;
}

export interface VersionDiff {
  from: {
    version: number;
    content: string;
    qualityScore: number | null;
    createdAt: string;
  };
  to: {
    version: number;
    content: string;
    qualityScore: number | null;
    createdAt: string;
  };
  diff: {
    similarity: number;
    changes: string[];
  };
  improvement: number;
}

export interface RefinementAnalytics {
  totalVersions: number;
  initialScore: number;
  currentScore: number;
  totalImprovement: number;
  averageImprovement: number;
  scoreHistory: Array<{
    version: number;
    score: number;
    createdAt: string;
  }>;
  refinementReasons: Array<{
    version: number;
    reason: string;
  }>;
}

export interface QuickEvaluationResult {
  score: number;
  category: 'excellent' | 'good' | 'fair' | 'poor';
  quickFeedback: string;
}

export interface SuggestionResult {
  currentScore: number;
  suggestions: RefinementSuggestion[];
  estimatedImprovement: number;
}
