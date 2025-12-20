import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  color: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string) => Promise<void>;
  register: (email: string, name: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email });
          const { user, token } = response.data.data;
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.error?.message || 'Login failed',
            isLoading: false
          });
          throw error;
        }
      },

      register: async (email: string, name: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/register', { email, name });
          const { user, token } = response.data.data;
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.error?.message || 'Registration failed',
            isLoading: false
          });
          throw error;
        }
      },

      loginAsGuest: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/guest');
          const { user, token } = response.data.data;
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.error?.message || 'Guest login failed',
            isLoading: false
          });
          throw error;
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

      checkAuth: () => {
        const { token, user } = get();
        if (token && user) {
          set({ isAuthenticated: true });
        } else {
          set({ isAuthenticated: false });
        }
      },

      updateProfile: async (data: Partial<User>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.patch('/auth/me', data);
          set({ user: response.data.data, isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.error?.message || 'Profile update failed',
            isLoading: false
          });
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
