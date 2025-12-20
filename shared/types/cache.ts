// Shared cache types

export interface CacheConfig {
  id?: string;
  enabled: boolean;
  similarityThreshold: number;
  ttl?: number;
  defaultTTLSeconds?: number;
  maxSize?: number;
  maxCacheSize?: number;
  invalidationRules?: unknown[];
  updatedAt?: string;
}

export interface CacheEntry {
  id: string;
  key: string;
  value: unknown;
  createdAt: Date;
  expiresAt?: Date;
  tags?: string[];
}

export interface CacheTag {
  id: string;
  name: string;
  cacheId?: string;
  createdAt?: Date;
}

export interface SemanticCacheEntry {
  id: string;
  prompt: string;
  promptHash?: string;
  embedding?: number[];
  response: string;
  model?: string;
  hitCount: number;
  tokensSaved: number;
  createdAt: string | Date;
  expiresAt: string | Date;
  lastAccessedAt: string | Date;
  userId?: string | null;
  tags: CacheTag[];
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
  model?: string;
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

export interface DailyStats {
  id?: string;
  date: string;
  totalHits: number;
  totalMisses: number;
  totalEntries?: number;
  tokensSaved?: number;
  costSaved?: number;
}

export interface DailyCacheStat {
  date: string;
  totalHits: number;
  totalMisses: number;
}

export interface CacheAnalytics {
  totalEntries?: number;
  hitRate: number;
  missRate?: number;
  totalHits: number;
  totalMisses: number;
  tokensSaved: number;
  estimatedCostSaved?: number;
  costSavings?: number;
  averageSimilarity?: number;
  cacheSize?: number;
  oldestEntry?: string;
  newestEntry?: string;
  topTags?: Array<{ tag: string; count: number }>;
  dailyStats?: DailyStats[] | DailyCacheStat[];
}
