export const en = {
  // Common
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    filter: 'Filter',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    submit: 'Submit',
    reset: 'Reset',
    clear: 'Clear',
    copy: 'Copy',
    download: 'Download',
    upload: 'Upload',
    settings: 'Settings',
    add: 'Add',
    newPrompt: 'New Prompt',
    apiCalls: 'API Calls',
    prompts: 'Prompts',
  },

  // Navigation
  nav: {
    editor: 'Editor',
    templates: 'Templates',
    history: 'History',
    marketplace: 'Marketplace',
    settings: 'Settings',
    techniques: 'Techniques',
    sdk: 'SDK Generator',
    deploy: 'Deploy',
  },

  // Editor
  editor: {
    title: 'Prompt Editor',
    prompt: 'Prompt',
    placeholder: 'Enter your prompt here...',
    variables: 'Variables',
    test: 'Test',
    run: 'Run',
    result: 'Result',
    modelConfig: 'Model Configuration',
    provider: 'Provider',
    model: 'Model',
    temperature: 'Temperature',
    maxTokens: 'Max Tokens',
    topP: 'Top P',
    topK: 'Top K',
    frequencyPenalty: 'Frequency Penalty',
    presencePenalty: 'Presence Penalty',
    stopSequences: 'Stop Sequences',
    responseFormat: 'Response Format',
  },

  // Providers
  providers: {
    openai: 'OpenAI',
    anthropic: 'Claude',
    google: 'Gemini',
    openaiDesc: 'Most capable models',
    anthropicDesc: '200K context window',
    googleDesc: 'Fast & efficient',
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
    title: 'Templates',
    search: 'Search templates...',
    category: 'Category',
    difficulty: 'Difficulty',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    useTemplate: 'Use Template',
    viewDetails: 'View Details',
  },

  // Marketplace
  marketplace: {
    title: 'Prompt Marketplace',
    featured: 'Featured',
    trending: 'Trending',
    recent: 'Recent',
    rating: 'Rating',
    downloads: 'Downloads',
    views: 'Views',
    author: 'Author',
    publish: 'Publish',
    fork: 'Fork',
    review: 'Review',
  },

  // History
  history: {
    title: 'History',
    recent: 'Recent',
    favorites: 'Favorites',
    versions: 'Versions',
    restore: 'Restore',
    compare: 'Compare',
    noHistory: 'No history',
  },

  // Settings
  settings: {
    title: 'Settings',
    general: 'General',
    appearance: 'Appearance',
    language: 'Language',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    apiKeys: 'API Keys',
    preferences: 'Preferences',
    account: 'Account',
  },

  // Validation
  validation: {
    required: 'This field is required',
    minLength: 'Minimum length is {min} characters',
    maxLength: 'Maximum length is {max} characters',
    invalidEmail: 'Invalid email address',
    invalidUrl: 'Invalid URL',
  },

  // Messages
  messages: {
    saved: 'Saved successfully',
    deleted: 'Deleted successfully',
    copied: 'Copied to clipboard',
    error: 'An error occurred. Please try again',
    noResults: 'No results found',
    loading: 'Loading...',
  },

  // Tooltips
  tooltips: {
    temperature: 'Controls randomness. Lower = more focused, Higher = more creative',
    topP: 'Nucleus sampling. Lower = fewer token choices',
    topK: 'Limits vocabulary. Only top K tokens considered',
    frequencyPenalty: 'Reduces repetition based on frequency',
    presencePenalty: 'Reduces repetition based on presence',
  },

  // Presets
  presets: {
    creative: 'Creative',
    balanced: 'Balanced',
    precise: 'Precise',
    deterministic: 'Deterministic',
  },
};

export type TranslationKeys = typeof en;
