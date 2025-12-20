// Shared cache types

export interface CacheConfig {
  enabled: boolean;
  similarityThreshold: number;
  ttl: number;
  defaultTTLSeconds: number;
  maxSize?: number;
  maxCacheSize: number;
}

export interface CacheEntry {
  id: string;
  key: string;
  value: any;
  createdAt: Date;
  expiresAt?: Date;
  tags?: string[];
}

export interface CacheTag {
  id: string;
  name: string;
  createdAt?: Date;
}

export interface SemanticCacheEntry {
  id: string;
  prompt: string;
  response: string;
  model: string;
  createdAt: Date;
  expiresAt: Date;
  lastAccessedAt: Date;
  hitCount: number;
  tokensSaved: number;
  tags: CacheTag[];
}

export interface DailyCacheStat {
  date: string;
  totalHits: number;
  totalMisses: number;
}

export interface CacheAnalytics {
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  totalEntries: number;
  tokensSaved: number;
  costSavings: number;
  estimatedCostSaved: number;
  dailyStats: DailyCacheStat[];
  topTags: { tag: string; count: number }[];
}
