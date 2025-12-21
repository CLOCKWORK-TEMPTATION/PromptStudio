export const ar = {
  // Common
  common: {
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    create: 'إنشاء',
    search: 'بحث',
    filter: 'تصفية',
    loading: 'جاري التحميل...',
    error: 'خطأ',
    success: 'نجح',
    close: 'إغلاق',
    back: 'رجوع',
    next: 'التالي',
    previous: 'السابق',
    submit: 'إرسال',
    reset: 'إعادة تعيين',
    clear: 'مسح',
    copy: 'نسخ',
    download: 'تحميل',
    upload: 'رفع',
    settings: 'الإعدادات',
    add: 'إضافة',
    newPrompt: 'برومبت جديد',
  },

  // Navigation
  nav: {
    editor: 'المحرر',
    templates: 'القوالب',
    history: 'السجل',
    marketplace: 'السوق',
    settings: 'الإعدادات',
    techniques: 'التقنيات',
    sdk: 'مولد SDK',
    deploy: 'النشر',
  },

  // Editor
  editor: {
    title: 'محرر البرومبت',
    prompt: 'البرومبت',
    placeholder: 'اكتب البرومبت هنا...',
    variables: 'المتغيرات',
    test: 'اختبار',
    run: 'تشغيل',
    result: 'النتيجة',
    modelConfig: 'إعدادات النموذج',
    provider: 'المزود',
    model: 'النموذج',
    temperature: 'درجة الحرارة',
    maxTokens: 'الحد الأقصى للرموز',
    topP: 'Top P',
    topK: 'Top K',
    frequencyPenalty: 'عقوبة التكرار',
    presencePenalty: 'عقوبة الحضور',
    stopSequences: 'تسلسلات الإيقاف',
    responseFormat: 'تنسيق الاستجابة',
  },

  // Providers
  providers: {
    openai: 'OpenAI',
    anthropic: 'Claude',
    google: 'Gemini',
    openaiDesc: 'النماذج الأكثر قدرة',
    anthropicDesc: 'نافذة سياق 200K',
    googleDesc: 'سريع وفعال',
  },

  // Models
  models: {
    'gpt-4': 'GPT-4',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'claude-3-opus': 'Claude 3 Opus',
    'claude-3-sonnet': 'Claude 3 Sonnet',
    'claude-3-haiku': 'Claude 3 Haiku',
    'gemini-pro': 'Gemini Pro',
  },

  // Templates
  templates: {
    title: 'القوالب',
    search: 'البحث في القوالب...',
    category: 'الفئة',
    difficulty: 'الصعوبة',
    beginner: 'مبتدئ',
    intermediate: 'متوسط',
    advanced: 'متقدم',
    useTemplate: 'استخدام القالب',
    viewDetails: 'عرض التفاصيل',
  },

  // Marketplace
  marketplace: {
    title: 'سوق البرومبتات',
    featured: 'مميز',
    trending: 'رائج',
    recent: 'حديث',
    rating: 'التقييم',
    downloads: 'التحميلات',
    views: 'المشاهدات',
    author: 'المؤلف',
    publish: 'نشر',
    fork: 'استنساخ',
    review: 'مراجعة',
  },

  // History
  history: {
    title: 'السجل',
    recent: 'الأخيرة',
    favorites: 'المفضلة',
    versions: 'الإصدارات',
    restore: 'استعادة',
    compare: 'مقارنة',
    noHistory: 'لا يوجد سجل',
  },

  // Settings
  settings: {
    title: 'الإعدادات',
    general: 'عام',
    appearance: 'المظهر',
    language: 'اللغة',
    theme: 'السمة',
    light: 'فاتح',
    dark: 'داكن',
    apiKeys: 'مفاتيح API',
    preferences: 'التفضيلات',
    account: 'الحساب',
  },

  // Validation
  validation: {
    required: 'هذا الحقل مطلوب',
    minLength: 'الحد الأدنى للطول هو {min} حرف',
    maxLength: 'الحد الأقصى للطول هو {max} حرف',
    invalidEmail: 'البريد الإلكتروني غير صالح',
    invalidUrl: 'الرابط غير صالح',
  },

  // Messages
  messages: {
    saved: 'تم الحفظ بنجاح',
    deleted: 'تم الحذف بنجاح',
    copied: 'تم النسخ إلى الحافظة',
    error: 'حدث خطأ. يرجى المحاولة مرة أخرى',
    noResults: 'لا توجد نتائج',
    loading: 'جاري التحميل...',
  },

  // Tooltips
  tooltips: {
    temperature: 'يتحكم في العشوائية. أقل = أكثر تركيزاً، أعلى = أكثر إبداعاً',
    topP: 'أخذ عينات النواة. أقل = خيارات رموز أقل',
    topK: 'يحد من المفردات. فقط أعلى K رموز يتم النظر فيها',
    frequencyPenalty: 'يقلل التكرار بناءً على التردد',
    presencePenalty: 'يقلل التكرار بناءً على الوجود',
  },

  // Presets
  presets: {
    creative: 'إبداعي',
    balanced: 'متوازن',
    precise: 'دقيق',
    deterministic: 'حتمي',
  },
};

export type TranslationKeys = typeof ar;
