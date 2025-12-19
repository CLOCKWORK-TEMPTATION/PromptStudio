import { create } from 'zustand';
import { api } from '../services/api';
import type {
  CacheConfig,
  CacheAnalytics,
  SemanticCacheEntry
} from '@shared/types/cache';

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

export const useCacheStore = create<CacheState>((set, get) => ({
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
      set({ config: response.data.data, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || 'Failed to fetch config',
        isLoading: false
      });
    }
  },

  updateConfig: async (updates) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch('/cache/config', updates);
      set({ config: response.data.data, isLoading: false });
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
      set({ analytics: response.data.data, isLoading: false });
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
      set({
        entries: response.data.data,
        totalEntries: response.data.meta.total,
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

  deleteEntry: async (id) => {
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

  invalidateByTags: async (tags) => {
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

  invalidateByPattern: async (pattern) => {
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
