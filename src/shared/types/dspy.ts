// ============================================================
// DSPy Optimization System Types - Epic 0 + Epic 1
// ============================================================

// ============================================================
// Prompt Types
// ============================================================

export interface Prompt {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  tenantId?: string;
  ownerId?: string;
  activeVersionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptVersion {
  id: string;
  promptId: string;
  promptEntityId?: string;
  version: number;
  content: string;
  systemPrompt?: string;
  processPrompt?: string;
  taskPrompt?: string;
  outputPrompt?: string;
  refinementReason?: string;
  qualityScore?: number;
  performanceMetrics?: Record<string, unknown>;
  createdAt: Date;
}

export interface PromptAuditEvent {
  id: string;
  promptId: string;
  promptVersionId?: string;
  optimizationRunId?: string;
  evaluationRunId?: string;
  tenantId?: string;
  actorId?: string;
  eventType: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================
// Template & Version Types
// ============================================================

export interface TemplateContentSnapshot {
  system: string;
  developer?: string;
  user: string;
  context?: string;
  variablesSchema?: VariableSchema[];
  defaultValues?: Record<string, unknown>;
  modelConfig?: TemplateModelConfig;
}

export interface VariableSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
}

export interface TemplateModelConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags: string[];
  tenantId?: string;
  ownerId?: string;
  activeVersionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  contentSnapshot: TemplateContentSnapshot;
  createdAt: Date;
  createdById?: string;
  isActive: boolean;
}

// ============================================================
// Dataset Types
// ============================================================

export type DatasetFormat = 'labeled' | 'unlabeled';

export interface EvaluationDataset {
  id: string;
  name: string;
  description?: string;
  taskType?: string;
  format: DatasetFormat;
  tenantId?: string;
  createdById?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetExample {
  id: string;
  datasetId: string;
  inputVariables: Record<string, unknown>;
  expectedOutput?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// Import request for examples
export interface DatasetImportRequest {
  examples: Array<{
    inputVariables: Record<string, unknown>;
    expectedOutput?: string;
    metadata?: Record<string, unknown>;
  }>;
}

// CSV import structure
export interface CSVImportRow {
  [key: string]: string | undefined;
  expected_output?: string;
}

// ============================================================
// Evaluation Types
// ============================================================

export type MetricType = 'exact_match' | 'contains' | 'json_valid' | 'custom';

export interface EvaluationRun {
  id: string;
  templateId?: string;
  templateVersionId?: string;
  datasetId: string;
  promptId?: string;
  baselinePromptVersionId?: string;
  optimizedPromptVersionId?: string;
  metricType: MetricType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  errorMessage?: string;
  aggregateScore?: number;
  totalExamples: number;
  passedExamples: number;
  failedExamples: number;
  perExampleResults?: ExampleResult[];
  failureCases?: FailureCase[];
  topFailureCases?: FailureCase[];
  calls: number;
  tokens: number;
  usdEstimate: number;
  maxSamples?: number;
  createdById?: string;
  createdAt: Date;
}

export interface ExampleResult {
  exampleId: string;
  passed: boolean;
  score?: number;
  input: Record<string, unknown>;
  expectedOutput?: string;
  actualOutput: string;
  errorMessage?: string;
  latencyMs?: number;
}

export interface FailureCase {
  exampleId: string;
  input: Record<string, unknown>;
  expectedOutput?: string;
  actualOutput: string;
  reason: string;
}

export interface BaselineEvaluationRequest {
  templateVersionId: string;
  datasetId: string;
  metricType: MetricType;
  maxSamples?: number;
}

export interface BaselineEvaluationResponse {
  runId: string;
  aggregateScore: number;
  totalExamples: number;
  passedExamples: number;
  failedExamples: number;
  perExampleResults: ExampleResult[];
  failureCases: FailureCase[];
}

// ============================================================
// Optimization Types (Epic 1)
// ============================================================

export type OptimizerType = 'bootstrap_fewshot' | 'copro';
export type OptimizationMetricType = MetricType | 'judge_rubric';
export type OptimizationStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface OptimizationBudget {
  maxCalls?: number;
  maxTokens?: number;
  maxUSD?: number;
}

export interface OptimizationRun {
  id: string;
  templateId: string;
  baseVersionId: string;
  datasetId: string;
  promptId?: string;
  baselinePromptVersionId?: string;
  optimizedPromptVersionId?: string;
  optimizerType: OptimizerType;
  metricType: OptimizationMetricType;
  budget: OptimizationBudget;
  status: OptimizationStatus;
  progress: number;
  stage?: string;
  errorMessage?: string;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  durationMs?: number;
  calls: number;
  tokens: number;
  usdEstimate: number;
  tenantId?: string;
  createdById?: string;
}

export interface OptimizedPromptSnapshot {
  system: string;
  developer?: string;
  demos?: DemoExample[];
}

export interface DemoExample {
  input: string;
  output: string;
}

export interface OptimizationCost {
  calls: number;
  tokens: number;
  usdEstimate: number;
}

export interface OptimizationDiagnostics {
  topFailureCases: FailureCase[];
}

export interface OptimizationResult {
  id: string;
  runId: string;
  optimizedSnapshot: OptimizedPromptSnapshot;
  dspyArtifactJson?: unknown;
  patchJson?: unknown;
  baselineScore?: number;
  optimizedScore?: number;
  scoreDelta?: number;
  cost?: OptimizationCost;
  diagnostics?: OptimizationDiagnostics;
  topFailureCases?: FailureCase[];
  appliedVersionId?: string;
  createdAt: Date;
}

export interface CreateOptimizationRequest {
  templateId: string;
  baseVersionId: string;
  datasetId: string;
  optimizerType: OptimizerType;
  metricType: OptimizationMetricType;
  budget?: OptimizationBudget;
}

export interface OptimizationStatusResponse {
  id: string;
  status: OptimizationStatus;
  progress: number;
  stage?: string;
  errorMessage?: string;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

export interface OptimizationResultResponse {
  id: string;
  runId: string;
  optimizedSnapshot: OptimizedPromptSnapshot;
  baselineScore: number;
  optimizedScore: number;
  scoreDelta: number;
  cost: OptimizationCost;
  diagnostics: OptimizationDiagnostics;
}

export interface ApplyOptimizationRequest {
  runId: string;
  activate?: boolean;
}

export interface ApplyOptimizationResponse {
  newVersionId: string;
  versionNumber: number;
  isActive: boolean;
}

// ============================================================
// DSPy Service Types (Python API)
// ============================================================

export interface DSPyCompileRequest {
  basePromptSnapshot: {
    system: string;
    developer?: string;
    user: string;
    context?: string;
  };
  dataset: Array<{
    input_variables: Record<string, unknown>;
    expected_output?: string;
  }>;
  model: {
    providerModelString: string;
    temperature?: number;
    maxTokens?: number;
  };
  optimizer: {
    type: OptimizerType;
    params?: Record<string, unknown>;
  };
  metricType: MetricType;
  budget?: OptimizationBudget;
}

export interface DSPyCompileResponse {
  optimizedPromptSnapshot: OptimizedPromptSnapshot;
  dspyArtifactJson: string;
  baselineScore: number;
  optimizedScore: number;
  delta: number;
  cost: OptimizationCost;
  diagnostics: OptimizationDiagnostics;
}

// ============================================================
// Rendered Prompt Types
// ============================================================

export interface RenderedPromptParts {
  system: string;
  developer?: string;
  user: string;
  context?: string;
  mergedPreview: string;
}

export interface RenderPromptOptions {
  throwOnMissingVariable?: boolean;
  defaultValue?: string;
}
