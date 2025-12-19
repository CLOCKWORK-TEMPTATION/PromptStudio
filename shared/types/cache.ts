// Semantic Cache Types for PromptStudio

export interface SemanticCacheEntry {
  id: string;
  prompt: string;
  promptHash: string;
  embedding: number[];
  response: string;
  model: string;
  hitCount: number;
  tokensSaved: number;
  createdAt: string;
  expiresAt: string;
  lastAccessedAt: string;
  userId?: string;
  tags: CacheTag[];
}

export interface CacheTag {
  id: string;
  name: string;
  cacheId: string;
}

export interface CacheConfig {
  id: string;
  enabled: boolean;
  similarityThreshold: number;
  defaultTTLSeconds: number;
  maxCacheSize: number;
  invalidationRules: InvalidationRule[];
  updatedAt: string;
}

export interface InvalidationRule {
  id: string;
  name: string;
  type: 'tag' | 'pattern' | 'age' | 'schedule';
  condition: InvalidationCondition;
  enabled: boolean;
}

export type InvalidationCondition =
  | TagInvalidationCondition
  | PatternInvalidationCondition
  | AgeInvalidationCondition
  | ScheduleInvalidationCondition;

export interface TagInvalidationCondition {
  type: 'tag';
  tags: string[];
}

export interface PatternInvalidationCondition {
  type: 'pattern';
  pattern: string;
  flags?: string;
}

export interface AgeInvalidationCondition {
  type: 'age';
  maxAgeSeconds: number;
}

export interface ScheduleInvalidationCondition {
  type: 'schedule';
  cron: string;
}

export interface CacheStatistics {
  id: string;
  date: string;
  totalHits: number;
  totalMisses: number;
  tokensSaved: number;
  costSaved: number;
}

export interface CacheAnalytics {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  tokensSaved: number;
  estimatedCostSaved: number;
  averageSimilarity: number;
  cacheSize: number;
  oldestEntry: string;
  newestEntry: string;
  topTags: { tag: string; count: number }[];
  dailyStats: CacheStatistics[];
}

export interface CacheSearchResult {
  entry: SemanticCacheEntry;
  similarity: number;
}

export interface CacheLookupRequest {
  prompt: string;
  model?: string;
  threshold?: number;
  tags?: string[];
}

export interface CacheLookupResponse {
  hit: boolean;
  entry?: SemanticCacheEntry;
  similarity?: number;
  cached: boolean;
}

export interface CacheStoreRequest {
  prompt: string;
  response: string;
  model: string;
  tags?: string[];
  ttlSeconds?: number;
  userId?: string;
}

export interface CacheInvalidateRequest {
  type: 'id' | 'tag' | 'pattern' | 'all';
  ids?: string[];
  tags?: string[];
  pattern?: string;
}

export interface CacheInvalidateResponse {
  deletedCount: number;
  success: boolean;
}

// API Response types
export interface CacheConfigUpdateRequest {
  enabled?: boolean;
  similarityThreshold?: number;
  defaultTTLSeconds?: number;
  maxCacheSize?: number;
  invalidationRules?: InvalidationRule[];
}

export interface CacheEntryListResponse {
  entries: SemanticCacheEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CacheEntryListRequest {
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'hitCount' | 'lastAccessedAt' | 'tokensSaved';
  sortOrder?: 'asc' | 'desc';
  tags?: string[];
  search?: string;
}
