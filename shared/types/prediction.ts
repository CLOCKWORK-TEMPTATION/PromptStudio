/**
 * Pre-Send Prediction Types
 * Shared types for cost estimation and success prediction
 */

export interface TokenEstimation {
  inputTokens: number;
  estimatedOutputTokens: number;
  totalTokens: number;
  contextUsagePercent: number;
}

export interface CostEstimation {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  costPerRequest: number;
  monthlyEstimate: number;
}

export interface ResponseTimeEstimation {
  estimatedSeconds: number;
  confidenceInterval: { min: number; max: number };
  tokensPerSecond: number;
}

export interface SuccessFactor {
  name: string;
  score: number;
  weight: number;
  impact: 'positive' | 'negative' | 'neutral';
  suggestion?: string;
}

export interface SuccessPrediction {
  probability: number;
  confidence: number;
  factors: SuccessFactor[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface OptimizationRecommendation {
  type: 'shorten' | 'rephrase' | 'reduce_context' | 'add_structure' | 'add_examples' | 'clarify_output';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImprovement: {
    costReduction?: number;
    speedImprovement?: number;
    successIncrease?: number;
  };
  suggestedChange?: string;
}

export interface HistoricalMetrics {
  avgTokens: number;
  avgCost: number;
  avgResponseTime: number;
  successRate: number;
  sampleSize: number;
}

export interface PreSendAnalysisResult {
  tokenEstimation: TokenEstimation;
  costEstimation: CostEstimation;
  responseTimeEstimation: ResponseTimeEstimation;
  successPrediction: SuccessPrediction;
  recommendations: OptimizationRecommendation[];
  historicalComparison?: HistoricalMetrics;
  overallScore: number;
  readyToSend: boolean;
  warnings: string[];
}

export interface QuickAnalysisResult {
  tokens: number;
  cost: number;
  successProbability: number;
}

export interface ModelPricing {
  id: string;
  input: number;
  output: number;
  contextWindow: number;
  inputCostPer1K: number;
  outputCostPer1K: number;
}

export interface ModelComparisonResult {
  comparisons: (PreSendAnalysisResult & { model: string })[];
  recommendations: {
    bestForCost: string;
    bestForSuccess: string;
    bestForSpeed: string;
  };
}

// Request types
export interface AnalyzeRequest {
  prompt: string;
  model?: string;
  expectedOutputLength?: 'short' | 'medium' | 'long';
  requestsPerMonth?: number;
  includeHistory?: boolean;
  userId?: string;
}

export interface QuickAnalyzeRequest {
  prompt: string;
  model?: string;
}

export interface CompareModelsRequest {
  prompt: string;
  models?: string[];
}
