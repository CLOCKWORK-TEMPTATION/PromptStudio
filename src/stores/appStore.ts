import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserPreferences, ModelConfig, Prompt, EnvironmentProfile } from '../types';
import { DEFAULT_MODEL_CONFIG } from '../types';

interface AppState {
  sessionId: string | null;
  sessionToken: string | null;
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  activeView: 'editor' | 'templates' | 'techniques' | 'chains' | 'marketplace' | 'history' | 'testing' | 'settings';
  preferences: UserPreferences;

  currentPrompt: Prompt | null;
  currentModelConfig: ModelConfig;
  activeProfile: EnvironmentProfile | null;

  isLoading: boolean;
  notifications: Notification[];

  setSessionId: (id: string | null) => void;
  setSessionToken: (token: string | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setActiveView: (view: AppState['activeView']) => void;
  setPreferences: (preferences: Partial<UserPreferences>) => void;

  setCurrentPrompt: (prompt: Prompt | null) => void;
  updateCurrentPrompt: (updates: Partial<Prompt>) => void;
  setCurrentModelConfig: (config: ModelConfig) => void;
  updateCurrentModelConfig: (updates: Partial<ModelConfig>) => void;
  setActiveProfile: (profile: EnvironmentProfile | null) => void;

  setLoading: (loading: boolean) => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sessionId: null,
      sessionToken: null,
      theme: 'dark',
      sidebarCollapsed: false,
      activeView: 'editor',
      preferences: {
        theme: 'dark',
        language: 'en',
        editor_font_size: 14,
        auto_save: true,
        show_line_numbers: true,
      },

      currentPrompt: null,
      currentModelConfig: DEFAULT_MODEL_CONFIG,
      activeProfile: null,

      isLoading: false,
      notifications: [],

      setSessionId: (id) => set({ sessionId: id }),
      setSessionToken: (token) => set({ sessionToken: token }),
      setTheme: (theme) => set({ theme, preferences: { ...useAppStore.getState().preferences, theme } }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setActiveView: (view) => set({ activeView: view }),
      setPreferences: (preferences) => set((state) => ({ preferences: { ...state.preferences, ...preferences } })),

      setCurrentPrompt: (prompt) => set({ currentPrompt: prompt }),
      updateCurrentPrompt: (updates) => set((state) => ({
        currentPrompt: state.currentPrompt ? { ...state.currentPrompt, ...updates } : null
      })),
      setCurrentModelConfig: (config) => set({ currentModelConfig: config }),
      updateCurrentModelConfig: (updates) => set((state) => ({
        currentModelConfig: { ...state.currentModelConfig, ...updates }
      })),
      setActiveProfile: (profile) => set({ activeProfile: profile }),

      setLoading: (loading) => set({ isLoading: loading }),
      addNotification: (notification) => set((state) => ({
        notifications: [...state.notifications, { ...notification, id: crypto.randomUUID() }]
      })),
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
      })),
    }),
    {
      name: 'prompt-studio-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        preferences: state.preferences,
        currentModelConfig: state.currentModelConfig,
      }),
    }
  )
);
