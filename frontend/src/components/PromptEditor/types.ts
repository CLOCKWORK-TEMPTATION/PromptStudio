/**
 * تكوين مرحلة في السلسلة
 */
export interface ChainStage {
  id: string;
  name: string;
  prompt: string;
  expectedOutput?: string;
  order: number;
  dependencies?: string[];
  config?: {
    maxTokens?: number;
    temperature?: number;
    useMemory?: boolean;
    cacheOutput?: boolean;
    retryOnFail?: boolean;
    maxRetries?: number;
  };
}

/**
 * قالب خط الأنابيب
 */
export interface PipelineTemplate {
  type: string;
  name: string;
  nameEn: string;
  description: string;
  stages: { id: string; name: string }[];
}

/**
 * نتيجة تنفيذ مرحلة
 */
export interface StageResult {
  stageId: string;
  stageName: string;
  input: string;
  output: string;
  duration: number;
  usedMemory: boolean;
  memorySimilarity?: number;
}

/**
 * نتيجة تنفيذ السلسلة
 */
export interface ExecutionResult {
  success: boolean;
  results: Record<string, string>;
  stageResults: StageResult[];
  totalDuration: number;
  totalCost?: number;
  errors?: string[];
  memoryStats?: {
    contextReused: boolean;
    similarContextsFound: number;
    newContextStored: boolean;
  };
}

/**
 * إحصائيات الذاكرة
 */
export interface MemoryStats {
  totalRecords: number;
  byType: Record<string, number>;
  avgRelevance: number;
  topTags: { tag: string; count: number }[];
  memoryUsage: number;
}

/**
 * خصائص مكون محرر السلسلة
 */
export interface PromptChainEditorProps {
  promptId: string;
  chainId?: string;
  onChainCreated?: (chainId: string) => void;
  onExecutionComplete?: (result: ExecutionResult) => void;
}

/**
 * أنواع خطوط الأنابيب
 */
export enum PipelineType {
  STANDARD = 'standard',
  ANALYSIS = 'analysis',
  CREATIVE = 'creative',
  TECHNICAL = 'technical',
  CUSTOM = 'custom',
}

/**
 * مراحل خط الأنابيب القياسي
 */
export enum StandardStage {
  ANALYZE = 'analyze',
  PLAN = 'plan',
  DRAFT = 'draft',
  REVIEW = 'review',
  FINALIZE = 'finalize',
}

/**
 * أنواع الذاكرة
 */
export enum MemoryType {
  TASK_CONTEXT = 'task_context',
  STAGE_OUTPUT = 'stage_output',
  USER_PREFERENCE = 'user_preference',
  PATTERN = 'pattern',
  INSIGHT = 'insight',
}
