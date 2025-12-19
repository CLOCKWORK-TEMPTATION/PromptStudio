import React from 'react';
import { Language, LanguageInfo } from '../types';
import { SUPPORTED_LANGUAGES } from '../services/translationService';
import { ChevronDown } from 'lucide-react';

interface LanguageSelectorProps {
  selectedLanguage: Language;
  onSelect: (lang: Language) => void;
  excludeLanguages?: Language[];
  label?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguage,
  onSelect,
  excludeLanguages = [],
  label,
}) => {
  const availableLanguages = SUPPORTED_LANGUAGES.filter(
    (lang) => !excludeLanguages.includes(lang.code)
  );

  const selectedLang = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage);

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={selectedLanguage}
          onChange={(e) => onSelect(e.target.value as Language)}
          className="appearance-none w-full px-4 py-3 bg-white border border-gray-300 rounded-lg
                     focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     cursor-pointer text-gray-900 font-medium pr-10"
        >
          {availableLanguages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name} ({lang.nativeName})
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
};

interface MultiLanguageSelectorProps {
  selectedLanguages: Language[];
  onToggle: (lang: Language) => void;
  excludeLanguages?: Language[];
  label?: string;
}

export const MultiLanguageSelector: React.FC<MultiLanguageSelectorProps> = ({
  selectedLanguages,
  onToggle,
  excludeLanguages = [],
  label,
}) => {
  const availableLanguages = SUPPORTED_LANGUAGES.filter(
    (lang) => !excludeLanguages.includes(lang.code)
  );

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {availableLanguages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => onToggle(lang.code)}
            className={`px-3 py-2 rounded-lg border transition-all duration-200 flex items-center gap-2
              ${
                selectedLanguages.includes(lang.code)
                  ? 'bg-primary-100 border-primary-500 text-primary-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
          >
            <span>{lang.flag}</span>
            <span className="text-sm font-medium">{lang.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
