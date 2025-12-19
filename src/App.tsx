import React, { useState } from 'react';
import { useTranslationStore } from './store/translationStore';
import {
  translateToMultipleLanguages,
  SUPPORTED_LANGUAGES,
} from './services/translationService';
import { TranslationResult } from './types';
import {
  TranslationInput,
  MultiLanguageSelector,
  CulturalContextPanel,
  TranslationResultCard,
  ComparisonView,
  SavedTranslationsList,
  ExportPanel,
  SaveModal,
} from './components';
import {
  Languages,
  BookmarkCheck,
  Download,
  History,
  Settings,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';

type Tab = 'translate' | 'saved' | 'export' | 'history';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('translate');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [translationToSave, setTranslationToSave] = useState<TranslationResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const {
    sourceText,
    sourceLanguage,
    targetLanguages,
    culturalContext,
    currentTranslations,
    isTranslating,
    savedTranslations,
    translationHistory,
    setSourceText,
    setSourceLanguage,
    toggleTargetLanguage,
    setCulturalContext,
    setCurrentTranslations,
    setIsTranslating,
    saveTranslation,
    deleteSavedTranslation,
    toggleFavorite,
    updateTranslationRating,
    certifyTranslation,
    addToHistory,
    clearCurrentTranslations,
  } = useTranslationStore();

  const handleTranslate = async () => {
    if (!sourceText.trim() || targetLanguages.length === 0) return;

    setIsTranslating(true);
    try {
      const results = await translateToMultipleLanguages(
        sourceText,
        sourceLanguage,
        targetLanguages,
        culturalContext
      );
      setCurrentTranslations(results);
      results.forEach((result) => addToHistory(result));
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleClear = () => {
    setSourceText('');
    clearCurrentTranslations();
  };

  const handleSaveClick = (result: TranslationResult) => {
    setTranslationToSave(result);
    setShowSaveModal(true);
  };

  const handleSaveConfirm = (title: string, tags: string[]) => {
    if (translationToSave) {
      saveTranslation(translationToSave, title, tags);
      setShowSaveModal(false);
      setTranslationToSave(null);
    }
  };

  const tabs = [
    { id: 'translate' as Tab, label: 'Translate', icon: Languages },
    { id: 'saved' as Tab, label: 'Saved', icon: BookmarkCheck, count: savedTranslations.length },
    { id: 'export' as Tab, label: 'Export', icon: Download },
    { id: 'history' as Tab, label: 'History', icon: History, count: translationHistory.length },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl
                              flex items-center justify-center shadow-lg">
                <Languages className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Intelligent Translation
                </h1>
                <p className="text-xs text-gray-500">نظام الترجمة الذكية</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                    ${
                      activeTab === tab.id
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-gray-200 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Settings and Mobile Menu */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-500" />
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5 text-gray-500" />
                ) : (
                  <Menu className="w-5 h-5 text-gray-500" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-3 border-t border-gray-100">
              <nav className="flex flex-col gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                      ${
                        activeTab === tab.id
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="font-medium">{tab.label}</span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className="px-1.5 py-0.5 text-xs bg-gray-200 rounded-full ml-auto">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'translate' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Input and Settings */}
            <div className="lg:col-span-2 space-y-6">
              <TranslationInput
                sourceText={sourceText}
                sourceLanguage={sourceLanguage}
                onTextChange={setSourceText}
                onLanguageChange={setSourceLanguage}
                onTranslate={handleTranslate}
                onClear={handleClear}
                isTranslating={isTranslating}
                targetLanguages={targetLanguages}
              />

              {/* Target Languages */}
              <div className="card p-6">
                <MultiLanguageSelector
                  selectedLanguages={targetLanguages}
                  onToggle={toggleTargetLanguage}
                  excludeLanguages={[sourceLanguage]}
                  label="Translate To"
                />
              </div>

              {/* Comparison View */}
              {currentTranslations.length > 1 && (
                <ComparisonView
                  sourceText={sourceText}
                  sourceLanguage={sourceLanguage}
                  translations={currentTranslations}
                />
              )}

              {/* Results */}
              {currentTranslations.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Translation Results
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentTranslations.map((result) => (
                      <TranslationResultCard
                        key={result.id}
                        result={result}
                        onSave={handleSaveClick}
                        onRate={updateTranslationRating}
                        onCertify={certifyTranslation}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Cultural Context */}
            <div className="space-y-6">
              <CulturalContextPanel
                context={culturalContext}
                onChange={setCulturalContext}
              />

              {/* Quick Export for current translations */}
              {currentTranslations.length > 0 && (
                <ExportPanel
                  translations={currentTranslations}
                  sourceText={sourceText}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="max-w-4xl mx-auto">
            <SavedTranslationsList
              translations={savedTranslations}
              onDelete={deleteSavedTranslation}
              onToggleFavorite={toggleFavorite}
              onSelect={(t) => {
                setSourceText(t.sourceText);
                setSourceLanguage(t.sourceLanguage);
                setActiveTab('translate');
              }}
            />
          </div>
        )}

        {activeTab === 'export' && (
          <div className="max-w-2xl mx-auto">
            <ExportPanel
              translations={savedTranslations}
              sourceText={sourceText}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto">
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Translation History
                </h3>
                <span className="ml-auto text-sm text-gray-500">
                  {translationHistory.length} translations
                </span>
              </div>

              {translationHistory.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No translation history yet
                </p>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {translationHistory.map((t) => {
                    const sourceLang = SUPPORTED_LANGUAGES.find(
                      (l) => l.code === t.sourceLanguage
                    );
                    const targetLang = SUPPORTED_LANGUAGES.find(
                      (l) => l.code === t.targetLanguage
                    );

                    return (
                      <div
                        key={t.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50
                                   cursor-pointer transition-colors"
                        onClick={() => {
                          setSourceText(t.sourceText);
                          setSourceLanguage(t.sourceLanguage);
                          setActiveTab('translate');
                        }}
                      >
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <span>{sourceLang?.flag}</span>
                          <span>→</span>
                          <span>{targetLang?.flag}</span>
                          <span className="ml-auto text-xs text-gray-400">
                            {new Date(t.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{t.sourceText}</p>
                        <p className="text-sm text-primary-600 mt-1">
                          {t.translatedText}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Languages className="w-5 h-5 text-primary-600" />
              <span className="text-sm text-gray-600">
                Intelligent Translation System - نظام الترجمة الذكية
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Supported Languages:</span>
              <div className="flex gap-1">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <span key={lang.code} title={lang.name}>
                    {lang.flag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Save Modal */}
      {showSaveModal && translationToSave && (
        <SaveModal
          translation={translationToSave}
          onSave={handleSaveConfirm}
          onClose={() => {
            setShowSaveModal(false);
            setTranslationToSave(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
