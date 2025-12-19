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
