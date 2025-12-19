import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Language,
  CulturalContext,
  TranslationResult,
  SavedTranslation
} from '../types';

interface TranslationState {
  // Current translation
  sourceText: string;
  sourceLanguage: Language;
  targetLanguages: Language[];
  culturalContext: CulturalContext;
  currentTranslations: TranslationResult[];
  isTranslating: boolean;

  // Saved translations
  savedTranslations: SavedTranslation[];

  // History
  translationHistory: TranslationResult[];

  // Actions
  setSourceText: (text: string) => void;
  setSourceLanguage: (lang: Language) => void;
  setTargetLanguages: (langs: Language[]) => void;
  toggleTargetLanguage: (lang: Language) => void;
  setCulturalContext: (context: Partial<CulturalContext>) => void;
  setCurrentTranslations: (translations: TranslationResult[]) => void;
  setIsTranslating: (isTranslating: boolean) => void;

  // Save/Delete
  saveTranslation: (translation: TranslationResult, title: string, tags?: string[]) => void;
  deleteSavedTranslation: (id: string) => void;
  toggleFavorite: (id: string) => void;
  updateTranslationRating: (id: string, rating: number, notes?: string) => void;
  certifyTranslation: (id: string, certified: boolean) => void;

  // History
  addToHistory: (translation: TranslationResult) => void;
  clearHistory: () => void;

  // Clear
  clearCurrentTranslations: () => void;
}

const defaultCulturalContext: CulturalContext = {
  formality: 'neutral',
  audience: 'general',
  preserveIdioms: true,
  adaptCulturalReferences: true,
};

export const useTranslationStore = create<TranslationState>()(
  persist(
    (set, get) => ({
      // Initial state
      sourceText: '',
      sourceLanguage: 'en',
      targetLanguages: ['ar'],
      culturalContext: defaultCulturalContext,
      currentTranslations: [],
      isTranslating: false,
      savedTranslations: [],
      translationHistory: [],

      // Basic setters
      setSourceText: (text) => set({ sourceText: text }),
      setSourceLanguage: (lang) => set({ sourceLanguage: lang }),
      setTargetLanguages: (langs) => set({ targetLanguages: langs }),

      toggleTargetLanguage: (lang) => {
        const current = get().targetLanguages;
        const newLangs = current.includes(lang)
          ? current.filter(l => l !== lang)
          : [...current, lang];
        set({ targetLanguages: newLangs.length > 0 ? newLangs : current });
      },

      setCulturalContext: (context) =>
        set((state) => ({
          culturalContext: { ...state.culturalContext, ...context },
        })),

      setCurrentTranslations: (translations) =>
        set({ currentTranslations: translations }),

      setIsTranslating: (isTranslating) => set({ isTranslating }),

      // Save translation
      saveTranslation: (translation, title, tags = []) => {
        const savedTranslation: SavedTranslation = {
          ...translation,
          title,
          tags,
          isFavorite: false,
        };
        set((state) => ({
          savedTranslations: [savedTranslation, ...state.savedTranslations],
        }));
      },

      deleteSavedTranslation: (id) =>
        set((state) => ({
          savedTranslations: state.savedTranslations.filter((t) => t.id !== id),
        })),

      toggleFavorite: (id) =>
        set((state) => ({
          savedTranslations: state.savedTranslations.map((t) =>
            t.id === id ? { ...t, isFavorite: !t.isFavorite } : t
          ),
        })),

      updateTranslationRating: (id, rating, notes) =>
        set((state) => ({
          savedTranslations: state.savedTranslations.map((t) =>
            t.id === id ? { ...t, rating, reviewNotes: notes } : t
          ),
          currentTranslations: state.currentTranslations.map((t) =>
            t.id === id ? { ...t, rating, reviewNotes: notes } : t
          ),
        })),

      certifyTranslation: (id, certified) =>
        set((state) => ({
          savedTranslations: state.savedTranslations.map((t) =>
            t.id === id ? { ...t, isCertified: certified } : t
          ),
          currentTranslations: state.currentTranslations.map((t) =>
            t.id === id ? { ...t, isCertified: certified } : t
          ),
        })),

      // History
      addToHistory: (translation) =>
        set((state) => ({
          translationHistory: [translation, ...state.translationHistory].slice(0, 100),
        })),

      clearHistory: () => set({ translationHistory: [] }),

      clearCurrentTranslations: () => set({ currentTranslations: [] }),
    }),
    {
      name: 'translation-storage',
      partialize: (state) => ({
        savedTranslations: state.savedTranslations,
        translationHistory: state.translationHistory,
      }),
    }
  )
);
