// ============================================================
// Translation Types (Intelligent Translation System)
// ============================================================

export type Language = 'ar' | 'en' | 'es' | 'fr' | 'de' | 'zh';

export interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  flag: string;
}

export interface CulturalContext {
  formality: 'formal' | 'informal' | 'neutral';
  region?: string;
  audience?: 'general' | 'business' | 'academic' | 'technical' | 'creative';
  preserveIdioms: boolean;
  adaptCulturalReferences: boolean;
}

export interface TranslationResult {
  id: string;
  sourceText: string;
  sourceLanguage: Language;
  targetLanguage: Language;
  translatedText: string;
  alternativeTranslations?: string[];
  culturalNotes?: string[];
  confidence: number;
  timestamp: Date;
  culturalContext: CulturalContext;
  isCertified: boolean;
  rating?: number;
  reviewNotes?: string;
}

export interface SavedTranslation extends TranslationResult {
  title: string;
  tags: string[];
  isFavorite: boolean;
}

export interface ExportFormat {
  type: 'json' | 'csv' | 'txt' | 'xlsx' | 'pdf';
  includeMetadata: boolean;
  includeAlternatives: boolean;
  includeCulturalNotes: boolean;
}

export interface TranslationComparison {
  sourceText: string;
  sourceLanguage: Language;
  translations: {
    language: Language;
    text: string;
    confidence: number;
  }[];
}

// ============================================================
// Prompt Configuration Types
// ============================================================

export interface PromptConfig {
  id: string;
  name: string;
  description: string;
  prompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string[];
  variables: PromptVariable[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
}

// ============================================================
// SDK Generation Types
// ============================================================

export interface SDKGenerationOptions {
  language: 'python' | 'typescript' | 'curl';
  asyncMode: boolean;
  includeRetryLogic: boolean;
  includeErrorHandling: boolean;
  functionName: string;
  className: string;
  includeTypes: boolean;
  includeDocstrings: boolean;
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
}

export interface GeneratedSDK {
  language: 'python' | 'typescript' | 'curl';
  code: string;
  types?: string;
  filename: string;
  dependencies: string[];
}

// ============================================================
// Cloud Deployment Types
// ============================================================

export type CloudProvider = 'vercel' | 'cloudflare' | 'aws-lambda' | 'gcp-functions';

export interface DeploymentConfig {
  provider: CloudProvider;
  name: string;
  region: string;
  environment: 'development' | 'staging' | 'production';
  envVariables: Record<string, string>;
  timeout: number;
  memory: number;
  rateLimit: RateLimitConfig;
  webhook?: WebhookConfig;
  apiKey?: APIKeyConfig;
}

export interface RateLimitConfig {
  enabled: boolean;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  secret: string;
  events: WebhookEvent[];
  retryOnFailure: boolean;
  maxRetries: number;
}

export type WebhookEvent =
  | 'request.started'
  | 'request.completed'
  | 'request.failed'
  | 'rate_limit.exceeded'
  | 'error.occurred';

export interface APIKeyConfig {
  enabled: boolean;
  keys: APIKey[];
  rotationPolicy: 'manual' | 'daily' | 'weekly' | 'monthly';
}

export interface APIKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  rateLimit?: number;
  expiresAt?: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
}

export interface UsageMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  requestsPerMinute: number[];
  tokensUsed: number;
  costEstimate: number;
  errorRate: number;
  topErrors: ErrorSummary[];
  dailyUsage: DailyUsage[];
}

export interface ErrorSummary {
  code: string;
  message: string;
  count: number;
  lastOccurred: Date;
}

export interface DailyUsage {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
}

export interface DeploymentStatus {
  id: string;
  provider: CloudProvider;
  status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'stopped';
  url?: string;
  logs: DeploymentLog[];
  createdAt: Date;
  updatedAt: Date;
  metrics?: UsageMetrics;
}

export interface DeploymentLog {
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
}

// ============================================================
// Provider-specific Configurations
// ============================================================

export interface VercelConfig extends DeploymentConfig {
  provider: 'vercel';
  edge: boolean;
  runtime: 'nodejs' | 'edge';
}

export interface CloudflareConfig extends DeploymentConfig {
  provider: 'cloudflare';
  kvNamespaces?: string[];
  durableObjects?: string[];
}

export interface AWSLambdaConfig extends DeploymentConfig {
  provider: 'aws-lambda';
  runtime: 'nodejs18.x' | 'nodejs20.x' | 'python3.11' | 'python3.12';
  architecture: 'x86_64' | 'arm64';
  vpcConfig?: {
    subnetIds: string[];
    securityGroupIds: string[];
  };
}

export interface GCPFunctionsConfig extends DeploymentConfig {
  provider: 'gcp-functions';
  runtime: 'nodejs18' | 'nodejs20' | 'python311' | 'python312';
  trigger: 'http' | 'pubsub' | 'storage';
  serviceAccount?: string;
}

// ============================================================
// AI Model Types
// ============================================================

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  contextWindow: number;
  supportsFunctions?: boolean;
  supportsJsonMode?: boolean;
  pricing?: {
    input: number;
    output: number;
  };
}

export const AI_MODELS: AIModel[] = [
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', maxTokens: 8192, contextWindow: 8192 },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', maxTokens: 4096, contextWindow: 4096 },
];

export interface ModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK?: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string[];
  responseFormat?: string;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: [],
};

// ============================================================
// Prompt Types
// ============================================================

export interface Prompt {
  id: string;
  content: string;
  title: string;
  description?: string;
  tags: string[];
  category?: string;
  modelId?: string;
  modelConfig?: ModelConfig;
  isFavorite?: boolean;
  usageCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  versionNumber?: number;
  content: string;
  changeSummary?: string;
  createdAt: Date;
}

// ============================================================
// Template Types
// ============================================================

export interface TemplateVariable {
  name: string;
  description: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}

export interface Template {
  id: string;
  name: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  usageCount: number;
  modelRecommendation: string;
  variables: TemplateVariable[];
  createdAt: Date;
}

export interface TechniqueExample {
  name: string;
  prompt: string;
  explanation: string;
}

export interface Technique {
  id: string;
  name: string;
  title: string;
  slug: string;
  description: string;
  content: string;
  example: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  bestFor: string[];
  examples: TechniqueExample[];
  relatedTechniques: string[];
}

export interface TemplateCategory {
  id: string;
  name: string;
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: 'coding', name: 'Coding' },
  { id: 'writing', name: 'Writing' },
  { id: 'analysis', name: 'Analysis' },
  { id: 'creative', name: 'Creative' },
  { id: 'data', name: 'Data' },
  { id: 'business', name: 'Business' },
  { id: 'customer-service', name: 'Customer Service' },
  { id: 'education', name: 'Education' },
];

// ============================================================
// Marketplace Types
// ============================================================

export interface MarketplacePromptVariable {
  name: string;
  type: string;
  description: string;
}

export interface MarketplacePrompt {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  authorId: string;
  authorName?: string;
  isFeatured?: boolean;
  isStaffPick?: boolean;
  avgRating: number;
  reviewCount: number;
  viewCount: number;
  cloneCount: number;
  variables: MarketplacePromptVariable[];
  modelRecommendation?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceReview {
  id: string;
  promptId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

// ============================================================
// Analysis Types
// ============================================================

export interface AnalysisResult {
  score: number;
  suggestions: string[];
  warnings: string[];
}

export interface PromptComponent {
  type: string;
  content: string;
}

export interface AnalysisSuggestion {
  type: string;
  message: string;
}

export interface AnalysisWarning {
  type: string;
  message: string;
}

export interface TokenEstimate {
  count: number;
  cost: number;
}

export interface TokenVisualization {
  tokens: Token[];
  total: number;
}

export interface Token {
  id: string | number;
  text: string;
  type?: string;
  start?: number;
  end?: number;
}

// ============================================================
// Tool Types
// ============================================================

export interface ToolDefinition {
  id: string;
  session_id?: string;
  prompt_id?: string;
  name: string;
  description: string;
  parameters: JSONSchema;
  returns?: JSONSchema;
  mock_response?: unknown;
  mockResponse?: unknown;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

// ============================================================
// Variable Types
// ============================================================

export interface SmartVariable {
  id?: string;
  session_id?: string;
  name: string;
  variableType: 'timestamp' | 'history' | 'env' | 'file' | 'custom' | string;
  default_value: string;
  description: string;
  isSystem?: boolean;
  created_at?: string;
  createdAt?: string;
}

// ============================================================
// User Types
// ============================================================

export interface UserPreferences {
  theme: string;
  language: string;
  editor_font_size: number;
  auto_save: boolean;
  show_line_numbers: boolean;
}

export interface EnvironmentProfile {
  id: string;
  name: string;
  description: string;
  config: ModelConfig;
  defaultRole?: string;
  isActive?: boolean;
}

// ============================================================
// Language Types
// ============================================================

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
];
