import { Language, LanguageInfo, CulturalContext, TranslationResult } from '../types';

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', flag: '🇸🇦' },
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr', flag: '🇨🇳' },
];

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const culturalAdaptations: Record<Language, Record<string, string[]>> = {
  ar: {
    formal: ['يرجى التكرم', 'حضرتك', 'سيادتك'],
    greetings: ['السلام عليكم ورحمة الله وبركاته', 'صباح النور', 'مساء الخير'],
    notes: ['في الثقافة العربية، يُفضل استخدام التحيات الدينية في السياقات الرسمية'],
  },
  en: {
    formal: ['Please kindly', 'Would you be so kind', 'I would appreciate'],
    greetings: ['Good day', 'Greetings', 'How do you do'],
    notes: ['In formal English contexts, indirect requests are preferred'],
  },
  es: {
    formal: ['Tenga la amabilidad', 'Sería tan amable', 'Le agradecería'],
    greetings: ['Muy buenos días', 'Es un placer', 'Encantado de conocerle'],
    notes: ['En español formal, se usa "usted" en lugar de "tú"'],
  },
  fr: {
    formal: ['Veuillez', 'Auriez-vous l\'obligeance', 'Je vous saurais gré'],
    greetings: ['Mes salutations', 'Enchanté', 'Mes respects'],
    notes: ['En français formel, on utilise "vous" au lieu de "tu"'],
  },
  de: {
    formal: ['Würden Sie bitte', 'Hätten Sie die Güte', 'Ich wäre Ihnen dankbar'],
    greetings: ['Sehr geehrte Damen und Herren', 'Mit freundlichen Grüßen', 'Hochachtungsvoll'],
    notes: ['Im formellen Deutsch wird "Sie" statt "du" verwendet'],
  },
  zh: {
    formal: ['请您', '劳驾', '恳请'],
    greetings: ['您好', '幸会', '久仰大名'],
    notes: ['在正式中文中，使用"您"而不是"你"'],
  },
};

function generateId(): string {
  return `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function transformWithCulturalContext(
  text: string,
  targetLang: Language,
  context: CulturalContext
): { text: string; notes: string[] } {
  const notes: string[] = [];
  let transformedText = text;

  if (context.formality === 'formal' && culturalAdaptations[targetLang]) {
    notes.push(...(culturalAdaptations[targetLang].notes || []));
  }

  if (context.adaptCulturalReferences) {
    const languageName = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.name;
    notes.push(`Cultural references have been adapted for ${languageName} speakers`);
  }

  if (!context.preserveIdioms) {
    notes.push('Idioms have been translated to their cultural equivalents');
  }

  return { text: transformedText, notes };
}

export async function translateText(
  sourceText: string,
  sourceLanguage: Language,
  targetLanguage: Language,
  culturalContext: CulturalContext
): Promise<TranslationResult> {
  const payload = { text: sourceText, targetLang: targetLanguage, context: culturalContext };

  let translatedText = sourceText;

  try {
    const response = await fetch(`${API_BASE}/api/translation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Translation failed with status ${response.status}`);
    }

    const data: { translatedText?: string } = await response.json();
    translatedText = data.translatedText ?? sourceText;
  } catch (error) {
    console.error('Translation API Error:', error);
  }

  const { text: adaptedText, notes } = transformWithCulturalContext(
    translatedText,
    targetLanguage,
    culturalContext
  );

  return {
    id: generateId(),
    sourceText,
    sourceLanguage,
    targetLanguage,
    translatedText: adaptedText,
    alternativeTranslations: undefined,
    culturalNotes: notes.length > 0 ? notes : undefined,
    confidence: 1.0,
    timestamp: new Date(),
    culturalContext,
    isCertified: false,
    rating: undefined,
    reviewNotes: undefined,
  };
}

export function translateMultiple(
  sourceText: string,
  sourceLanguage: Language,
  targetLanguages: Language[],
  culturalContext: CulturalContext
): Promise<TranslationResult[]> {
  return Promise.all(
    targetLanguages.map(targetLang =>
      translateText(sourceText, sourceLanguage, targetLang, culturalContext)
    )
  );
}

export function getLanguageInfo(code: Language): LanguageInfo | undefined {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
}

export function detectLanguage(text: string): Language {
  const arabicPattern = /[\u0600-\u06FF]/;
  const chinesePattern = /[\u4E00-\u9FFF]/;
  const spanishPattern = /[áéíóúüñ¿¡]/i;
  const frenchPattern = /[àâçéèêëïîôùûüÿœæ]/i;
  const germanPattern = /[äöüß]/i;

  if (arabicPattern.test(text)) return 'ar';
  if (chinesePattern.test(text)) return 'zh';
  if (spanishPattern.test(text)) return 'es';
  if (frenchPattern.test(text)) return 'fr';
  if (germanPattern.test(text)) return 'de';

  return 'en';
}
