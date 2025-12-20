// ============================================================
// Translation Types (Intelligent Translation System)
// ============================================================

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', flag: '🇸🇦' },
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr', flag: '🇨🇳' },
];

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
// Analysis Types
// ============================================================

export interface AnalysisResult {
  clarity_score: number;
  specificity_score: number;
  structure_score: number;
  overall_score: number;
  components: PromptComponent[];
  suggestions: AnalysisSuggestion[];
  warnings: AnalysisWarning[];
  token_estimate: TokenEstimate;
}

export interface PromptComponent {
  type: 'role' | 'constraint' | 'example' | 'output_format';
  content: string;
  start: number;
  end: number;
}

export interface AnalysisSuggestion {
  type: 'addition' | 'improvement';
  message: string;
  impact: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface AnalysisWarning {
  type: 'sensitive_data' | 'security' | 'cost';
  message: string;
  severity: 'critical' | 'warning' | 'info';
  location?: { start: number; end: number };
}

export interface TokenEstimate {
  gpt4: number;
  gpt35: number;
  claude: number;
  llama: number;
  estimated_cost: Record<string, number>;
}

export interface TokenVisualization {
  tokens: Token[];
  total: number;
  model: string;
}

export interface Token {
  text: string;
  id: number;
  start: number;
  end: number;
}

// ============================================================
// Prompt & Model Types
// ============================================================

export interface Prompt {
  id: string;
  title: string;
  content: string;
  description?: string;
  tags: string[];
  category?: string;
  model_id?: string;
  variables: PromptVariable[];
  modelConfig: ModelConfig;
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
  modelConfig: ModelConfig;
  changeSummary?: string;
  createdAt: Date;
}

export interface ModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string[];
  topK?: number;
  responseFormat?: 'text' | 'json_object' | 'json_schema';
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  context_window: number;
  contextWindow?: number; // Alias for backward compatibility
  supports_functions: boolean;
  supports_json_mode: boolean;
  pricing?: {
    input: number;
    output: number;
  };
}

export const AI_MODELS: AIModel[] = [
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', context_window: 8192, contextWindow: 8192, supports_functions: true, supports_json_mode: true, pricing: { input: 0.03, output: 0.06 } },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', context_window: 128000, contextWindow: 128000, supports_functions: true, supports_json_mode: true, pricing: { input: 0.01, output: 0.03 } },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', context_window: 16385, contextWindow: 16385, supports_functions: true, supports_json_mode: true, pricing: { input: 0.0005, output: 0.0015 } },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', context_window: 200000, contextWindow: 200000, supports_functions: true, supports_json_mode: false, pricing: { input: 0.015, output: 0.075 } },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic', context_window: 200000, contextWindow: 200000, supports_functions: true, supports_json_mode: false, pricing: { input: 0.003, output: 0.015 } },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic', context_window: 200000, contextWindow: 200000, supports_functions: true, supports_json_mode: false, pricing: { input: 0.00025, output: 0.00125 } },
  { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google', context_window: 32760, contextWindow: 32760, supports_functions: true, supports_json_mode: false, pricing: { input: 0.00025, output: 0.0005 } },
];

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: [],
  topK: 40,
  responseFormat: 'text'
};

// ============================================================
// Template & Technique Types
// ============================================================

export interface TemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required?: boolean;
}

export interface TemplateCategory {
  id: string;
  name: string;
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: 'coding', name: 'Code Generation' },
  { id: 'writing', name: 'Content Creation' },
  { id: 'analysis', name: 'Data Analysis' },
  { id: 'creative', name: 'Creative Writing' },
  { id: 'data', name: 'Data Processing' },
  { id: 'business', name: 'Business' },
  { id: 'customer-service', name: 'Customer Service' },
  { id: 'education', name: 'Education' },
  { id: 'research', name: 'Research' },
  { id: 'other', name: 'Other' },
];

export interface MarketplacePromptVariable {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  defaultValue?: string;
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
  downloads?: number;
  rating?: number;
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

export interface TemplateVariable {
  name: string;
  description: string;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  defaultValue?: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  description?: string;
}

export const TEMPLATE_CATEGORIES_LIST: TemplateCategory[] = [
  { id: 'coding', name: 'Coding', description: 'Code generation and programming' },
  { id: 'writing', name: 'Writing', description: 'Content writing and copywriting' },
  { id: 'analysis', name: 'Analysis', description: 'Data and text analysis' },
  { id: 'creative', name: 'Creative', description: 'Creative and artistic content' },
  { id: 'data', name: 'Data', description: 'Data processing and transformation' },
  { id: 'business', name: 'Business', description: 'Business and marketing content' },
  { id: 'customer-service', name: 'Customer Service', description: 'Customer support responses' },
  { id: 'education', name: 'Education', description: 'Educational and learning content' },
];

export interface Template {
  id: string;
  name: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  variables: TemplateVariable[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  usageCount: number;
  modelRecommendation?: string;
  createdAt: Date;
  updatedAt: Date;
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

// ============================================================
// User & App State Types
// ============================================================

export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  editor_font_size: number;
  auto_save: boolean;
  show_line_numbers: boolean;
}

export interface EnvironmentProfile {
  id: string;
  name: string;
  description: string;
  modelConfig: ModelConfig;
  variables: Record<string, string>;
  isActive?: boolean;
  defaultRole?: string;
  default_output_format?: string;
}

// ============================================================
// Editor & Tool Types
// ============================================================

export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  [key: string]: any;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  mockResponse?: string;
}

export interface SmartVariable {
  id: string;
  session_id: string;
  name: string;
  variableType: 'timestamp' | 'history' | 'env' | 'custom' | 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  default_value: string;
  isSystem?: boolean;
  createdAt?: string;
  validation?: {
    required: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
}
