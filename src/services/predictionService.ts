/**
 * Pre-Send Prediction Service
 * Client-side service for cost and success prediction
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Perform comprehensive pre-send analysis
 */
export async function analyzePrompt(
  prompt: string,
  model: string = 'gpt-4',
  options: {
    expectedOutputLength?: 'short' | 'medium' | 'long';
    requestsPerMonth?: number;
    includeHistory?: boolean;
    userId?: string;
  } = {}
): Promise<PreSendAnalysisResult> {
  const response = await fetch(`${API_BASE}/api/prediction/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, ...options }),
  });

  const result: ApiResponse<PreSendAnalysisResult> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to analyze prompt');
  }

  return result.data;
}

/**
 * Quick analysis for real-time feedback
 */
export async function quickAnalyze(
  prompt: string,
  model: string = 'gpt-4'
): Promise<QuickAnalysisResult> {
  const response = await fetch(`${API_BASE}/api/prediction/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model }),
  });

  const result: ApiResponse<QuickAnalysisResult> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to perform quick analysis');
  }

  return result.data;
}

/**
 * Estimate token counts
 */
export async function estimateTokens(
  prompt: string,
  model: string = 'gpt-4',
  expectedOutputLength: 'short' | 'medium' | 'long' = 'medium'
): Promise<TokenEstimation> {
  const response = await fetch(`${API_BASE}/api/prediction/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, expectedOutputLength }),
  });

  const result: ApiResponse<TokenEstimation> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to estimate tokens');
  }

  return result.data;
}

/**
 * Estimate costs
 */
export async function estimateCost(
  prompt: string,
  model: string = 'gpt-4',
  expectedOutputLength: 'short' | 'medium' | 'long' = 'medium',
  requestsPerMonth: number = 100
): Promise<CostEstimation & { tokens: TokenEstimation }> {
  const response = await fetch(`${API_BASE}/api/prediction/cost`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, expectedOutputLength, requestsPerMonth }),
  });

  const result: ApiResponse<CostEstimation & { tokens: TokenEstimation }> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to estimate cost');
  }

  return result.data;
}

/**
 * Predict success probability
 */
export async function predictSuccess(
  prompt: string,
  model: string = 'gpt-4'
): Promise<SuccessPrediction> {
  const response = await fetch(`${API_BASE}/api/prediction/success`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model }),
  });

  const result: ApiResponse<SuccessPrediction> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to predict success');
  }

  return result.data;
}

/**
 * Estimate response time
 */
export async function estimateResponseTime(
  prompt: string,
  model: string = 'gpt-4',
  expectedOutputLength: 'short' | 'medium' | 'long' = 'medium'
): Promise<ResponseTimeEstimation> {
  const response = await fetch(`${API_BASE}/api/prediction/response-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, expectedOutputLength }),
  });

  const result: ApiResponse<ResponseTimeEstimation> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to estimate response time');
  }

  return result.data;
}

/**
 * Get available models with pricing
 */
export async function getModels(): Promise<ModelPricing[]> {
  const response = await fetch(`${API_BASE}/api/prediction/models`);

  const result: ApiResponse<ModelPricing[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get models');
  }

  return result.data;
}

/**
 * Compare analysis across multiple models
 */
export async function compareModels(
  prompt: string,
  models: string[] = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet']
): Promise<ModelComparisonResult> {
  const response = await fetch(`${API_BASE}/api/prediction/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, models }),
  });

  const result: ApiResponse<ModelComparisonResult> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to compare models');
  }

  return result.data;
}

// Local analysis for offline/instant feedback

const MODEL_PRICING_LOCAL: Record<string, { input: number; output: number; contextWindow: number }> = {
  'gpt-4': { input: 0.03, output: 0.06, contextWindow: 8192 },
  'gpt-4-turbo': { input: 0.01, output: 0.03, contextWindow: 128000 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03, contextWindow: 128000 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002, contextWindow: 16385 },
  'claude-3-opus': { input: 0.015, output: 0.075, contextWindow: 200000 },
  'claude-3-sonnet': { input: 0.003, output: 0.015, contextWindow: 200000 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125, contextWindow: 200000 },
};

/**
 * Local quick analysis (no API call)
 */
export function localQuickAnalyze(prompt: string, model: string = 'gpt-4'): QuickAnalysisResult {
  const pricing = MODEL_PRICING_LOCAL[model] || MODEL_PRICING_LOCAL['gpt-4'];

  const inputTokens = Math.ceil(prompt.length / 4);
  const outputTokens = Math.ceil(inputTokens * 0.8);

  const cost =
    (inputTokens / 1000) * pricing.input +
    (outputTokens / 1000) * pricing.output;

  // Quick success probability
  let successProbability = 0.5;
  if (prompt.length > 100) successProbability += 0.1;
  if (prompt.includes('#')) successProbability += 0.1;
  if (/example|مثال/i.test(prompt)) successProbability += 0.1;
  if (/output|format|مخرج/i.test(prompt)) successProbability += 0.1;
  successProbability = Math.min(successProbability, 0.95);

  return {
    tokens: inputTokens + outputTokens,
    cost,
    successProbability,
  };
}

export default {
  analyzePrompt,
  quickAnalyze,
  estimateTokens,
  estimateCost,
  predictSuccess,
  estimateResponseTime,
  getModels,
  compareModels,
  localQuickAnalyze,
};
