// Shared cache types

export interface CacheConfig {
  enabled: boolean;
  similarityThreshold: number;
  ttl: number;
  maxSize?: number;
}

export interface CacheEntry {
  id: string;
  key: string;
  value: any;
  createdAt: Date;
  expiresAt?: Date;
  tags?: string[];
}

export interface CacheAnalytics {
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  tokensSaved: number;
  costSavings: number;
}
