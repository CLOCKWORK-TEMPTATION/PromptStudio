import { Language, LanguageInfo, CulturalContext, TranslationResult } from '../types';

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', flag: '🇸🇦' },
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr', flag: '🇨🇳' },
];

// Simulated translation dictionary for demo purposes
const translations: Record<string, Record<Language, string>> = {
  'hello': {
    ar: 'مرحباً',
    en: 'Hello',
    es: 'Hola',
    fr: 'Bonjour',
    de: 'Hallo',
    zh: '你好',
  },
  'welcome': {
    ar: 'أهلاً وسهلاً',
    en: 'Welcome',
    es: 'Bienvenido',
    fr: 'Bienvenue',
    de: 'Willkommen',
    zh: '欢迎',
  },
  'thank you': {
    ar: 'شكراً لك',
    en: 'Thank you',
    es: 'Gracias',
    fr: 'Merci',
    de: 'Danke',
    zh: '谢谢',
  },
  'good morning': {
    ar: 'صباح الخير',
    en: 'Good morning',
    es: 'Buenos días',
    fr: 'Bonjour',
    de: 'Guten Morgen',
    zh: '早上好',
  },
  'goodbye': {
    ar: 'مع السلامة',
    en: 'Goodbye',
    es: 'Adiós',
    fr: 'Au revoir',
    de: 'Auf Wiedersehen',
    zh: '再见',
  },
  'how are you': {
    ar: 'كيف حالك؟',
    en: 'How are you?',
    es: '¿Cómo estás?',
    fr: 'Comment allez-vous?',
    de: 'Wie geht es dir?',
    zh: '你好吗？',
  },
  'i love you': {
    ar: 'أحبك',
    en: 'I love you',
    es: 'Te amo',
    fr: 'Je t\'aime',
    de: 'Ich liebe dich',
    zh: '我爱你',
  },
  'please': {
    ar: 'من فضلك',
    en: 'Please',
    es: 'Por favor',
    fr: 'S\'il vous plaît',
    de: 'Bitte',
    zh: '请',
  },
  'yes': {
    ar: 'نعم',
    en: 'Yes',
    es: 'Sí',
    fr: 'Oui',
    de: 'Ja',
    zh: '是',
  },
  'no': {
    ar: 'لا',
    en: 'No',
    es: 'No',
    fr: 'Non',
    de: 'Nein',
    zh: '不',
  },
};

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

function findTranslation(text: string, sourceLang: Language, targetLang: Language): string | null {
  const normalized = text.toLowerCase().trim();

  // Check direct matches
  if (translations[normalized]) {
    return translations[normalized][targetLang];
  }

  // Check if source text matches any translation value
  for (const [, langTexts] of Object.entries(translations)) {
    if (langTexts[sourceLang]?.toLowerCase() === normalized) {
      return langTexts[targetLang];
    }
  }

  return null;
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
    notes.push(`Cultural references have been adapted for ${SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.name} speakers`);
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
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

  let translatedText = findTranslation(sourceText, sourceLanguage, targetLanguage);

  // If no direct translation found, create a simulated translation
  if (!translatedText) {
    const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage);
    translatedText = `[${langInfo?.nativeName}] ${sourceText}`;
  }

  const { text: adaptedText, notes } = transformWithCulturalContext(
    translatedText,
    targetLanguage,
    culturalContext
  );

  // Generate alternative translations
  const alternatives: string[] = [];
  if (culturalContext.formality === 'formal') {
    alternatives.push(`(Formal) ${adaptedText}`);
  }
  if (culturalContext.formality === 'informal') {
    alternatives.push(`(Casual) ${adaptedText}`);
  }

  const confidence = Math.random() * 0.2 + 0.8; // 80-100% confidence

  return {
    id: generateId(),
    sourceText,
    sourceLanguage,
    targetLanguage,
    translatedText: adaptedText,
    alternativeTranslations: alternatives.length > 0 ? alternatives : undefined,
    culturalNotes: notes.length > 0 ? notes : undefined,
    confidence,
    timestamp: new Date(),
    culturalContext,
    isCertified: false,
    rating: undefined,
    reviewNotes: undefined,
  };
}

export async function translateToMultipleLanguages(
  sourceText: string,
  sourceLanguage: Language,
  targetLanguages: Language[],
  culturalContext: CulturalContext
): Promise<TranslationResult[]> {
  const results = await Promise.all(
    targetLanguages.map(targetLang =>
      translateText(sourceText, sourceLanguage, targetLang, culturalContext)
    )
  );
  return results;
}

export function getLanguageInfo(code: Language): LanguageInfo | undefined {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
}

export function detectLanguage(text: string): Language {
  // Simple language detection based on character sets
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

  return 'en'; // Default to English
}
