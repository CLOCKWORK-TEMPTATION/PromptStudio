// @ts-ignore - zustand module
import { create } from 'zustand';
import { api } from '../services/api';

// Local type definitions since cache.js module may not exist
interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  similarityThreshold: number;
}

interface CacheAnalytics {
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  averageLatency: number;
}

interface SemanticCacheEntry {
  id: string;
  prompt: string;
  response: string;
  createdAt: Date;
  expiresAt: Date;
  tags: string[];
}

interface CacheState {
  config: CacheConfig | null;
  analytics: CacheAnalytics | null;
  entries: SemanticCacheEntry[];
  totalEntries: number;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchConfig: () => Promise<void>;
  updateConfig: (updates: Partial<CacheConfig>) => Promise<void>;
  fetchAnalytics: () => Promise<void>;
  fetchEntries: (page?: number, pageSize?: number) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  invalidateByTags: (tags: string[]) => Promise<void>;
  invalidateByPattern: (pattern: string) => Promise<void>;
  clearAllCache: () => Promise<void>;
  cleanupExpired: () => Promise<void>;
}

type SetState = (partial: Partial<CacheState> | ((state: CacheState) => Partial<CacheState>)) => void;
type GetState = () => CacheState;

export const useCacheStore = create<CacheState>((set: SetState, get: GetState) => ({
  config: null,
  analytics: null,
  entries: [],
  totalEntries: 0,
  currentPage: 1,
  pageSize: 20,
  isLoading: false,
  error: null,

  fetchConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/cache/config');
      const responseData = response.data as { data: CacheConfig };
      set({ config: responseData.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || 'Failed to fetch config',
        isLoading: false
      });
    }
  },

  updateConfig: async (updates: Partial<CacheConfig>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch('/cache/config', updates);
      const responseData = response.data as { data: CacheConfig };
      set({ config: responseData.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || 'Failed to update config',
        isLoading: false
      });
    }
  },

  fetchAnalytics: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/cache/analytics');
      const responseData = response.data as { data: CacheAnalytics };
      set({ analytics: responseData.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || 'Failed to fetch analytics',
        isLoading: false
      });
    }
  },

  fetchEntries: async (page = 1, pageSize = 20) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/cache/entries', {
        params: { page, pageSize },
      });
      const responseData = response.data as { data: SemanticCacheEntry[]; meta: { total: number } };
      set({
        entries: responseData.data,
        totalEntries: responseData.meta.total,
        currentPage: page,
        pageSize,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || 'Failed to fetch entries',
        isLoading: false
      });
    }
  },

  deleteEntry: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/cache/entries/${id}`);
      const { currentPage, pageSize } = get();
      await get().fetchEntries(currentPage, pageSize);
      await get().fetchAnalytics();
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || 'Failed to delete entry',
        isLoading: false
      });
    }
  },

  invalidateByTags: async (tags: string[]) => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/cache/invalidate', { type: 'tag', tags });
      const { currentPage, pageSize } = get();
      await get().fetchEntries(currentPage, pageSize);
      await get().fetchAnalytics();
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || 'Failed to invalidate',
        isLoading: false
      });
    }
  },

  invalidateByPattern: async (pattern: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/cache/invalidate', { type: 'pattern', pattern });
      const { currentPage, pageSize } = get();
      await get().fetchEntries(currentPage, pageSize);
      await get().fetchAnalytics();
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || 'Failed to invalidate',
        isLoading: false
      });
    }
  },

  clearAllCache: async () => {
    set({ isLoading: true, error: null });
    try {
      await api.delete('/cache/all');
      set({ entries: [], totalEntries: 0, isLoading: false });
      await get().fetchAnalytics();
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || 'Failed to clear cache',
        isLoading: false
      });
    }
  },

  cleanupExpired: async () => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/cache/cleanup');
      const { currentPage, pageSize } = get();
      await get().fetchEntries(currentPage, pageSize);
      await get().fetchAnalytics();
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || 'Failed to cleanup',
        isLoading: false
      });
    }
  },
}));
