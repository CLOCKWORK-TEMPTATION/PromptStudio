import React from 'react';
import { Language } from '../types';
import { LanguageSelector } from './LanguageSelector';
import { Languages, Wand2, RotateCcw } from 'lucide-react';
import { detectLanguage } from '../services/translationService';

interface TranslationInputProps {
  sourceText: string;
  sourceLanguage: Language;
  onTextChange: (text: string) => void;
  onLanguageChange: (lang: Language) => void;
  onTranslate: () => void;
  onClear: () => void;
  isTranslating: boolean;
  targetLanguages: Language[];
}

export const TranslationInput: React.FC<TranslationInputProps> = ({
  sourceText,
  sourceLanguage,
  onTextChange,
  onLanguageChange,
  onTranslate,
  onClear,
  isTranslating,
  targetLanguages,
}) => {
  const handleDetectLanguage = () => {
    if (sourceText.trim()) {
      const detected = detectLanguage(sourceText);
      onLanguageChange(detected);
    }
  };

  const charCount = sourceText.length;
  const wordCount = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Languages className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Source Text</h3>
        </div>
        <button
          onClick={handleDetectLanguage}
          disabled={!sourceText.trim()}
          className="text-sm text-primary-600 hover:text-primary-700 disabled:text-gray-400
                     flex items-center gap-1"
        >
          <Wand2 className="w-4 h-4" />
          Detect Language
        </button>
      </div>

      <LanguageSelector
        selectedLanguage={sourceLanguage}
        onSelect={onLanguageChange}
        label="Source Language"
      />

      <div className="mt-4">
        <textarea
          value={sourceText}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Enter text to translate..."
          className="input-field min-h-[200px] resize-none"
          dir={sourceLanguage === 'ar' ? 'rtl' : 'ltr'}
        />
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="text-sm text-gray-500">
          {charCount} characters | {wordCount} words
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClear}
            disabled={!sourceText}
            className="btn-secondary flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Clear
          </button>
          <button
            onClick={onTranslate}
            disabled={!sourceText.trim() || targetLanguages.length === 0 || isTranslating}
            className="btn-primary flex items-center gap-2 min-w-[140px] justify-center"
          >
            {isTranslating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Translating...
              </>
            ) : (
              <>
                <Languages className="w-4 h-4" />
                Translate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
