import React, { useState } from 'react';
import { SavedTranslation } from '../types';
import { SUPPORTED_LANGUAGES } from '../services/translationService';
import {
  Bookmark,
  Star,
  Award,
  Trash2,
  Heart,
  Search,
  Filter,
  Calendar,
} from 'lucide-react';

interface SavedTranslationsProps {
  translations: SavedTranslation[];
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onSelect: (translation: SavedTranslation) => void;
}

export const SavedTranslationsList: React.FC<SavedTranslationsProps> = ({
  translations,
  onDelete,
  onToggleFavorite,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [filterCertified, setFilterCertified] = useState(false);

  const filteredTranslations = translations.filter((t) => {
    const matchesSearch =
      t.sourceText.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.translatedText.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.title.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFavorite = !filterFavorites || t.isFavorite;
    const matchesCertified = !filterCertified || t.isCertified;

    return matchesSearch && matchesFavorite && matchesCertified;
  });

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Bookmark className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">Saved Translations</h3>
        <span className="ml-auto text-sm text-gray-500">
          {translations.length} saved
        </span>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search translations..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg
                       focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterFavorites(!filterFavorites)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors
              ${
                filterFavorites
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            <Heart className={`w-4 h-4 ${filterFavorites ? 'fill-red-500' : ''}`} />
            Favorites
          </button>
          <button
            onClick={() => setFilterCertified(!filterCertified)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors
              ${
                filterCertified
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            <Award className="w-4 h-4" />
            Certified
          </button>
        </div>
      </div>

      {/* Translations List */}
      {filteredTranslations.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {translations.length === 0
            ? 'No saved translations yet'
            : 'No translations match your filters'}
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {filteredTranslations.map((t) => {
            const sourceLang = SUPPORTED_LANGUAGES.find((l) => l.code === t.sourceLanguage);
            const targetLang = SUPPORTED_LANGUAGES.find((l) => l.code === t.targetLanguage);

            return (
              <div
                key={t.id}
                className="p-4 border border-gray-200 rounded-lg hover:border-primary-300
                           hover:shadow-md transition-all cursor-pointer group"
                onClick={() => onSelect(t)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{t.title}</span>
                    {t.isCertified && (
                      <Award className="w-4 h-4 text-primary-600" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(t.id);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          t.isFavorite ? 'text-red-500 fill-red-500' : 'text-gray-400'
                        }`}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(t.id);
                      }}
                      className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <span>{sourceLang?.flag}</span>
                  <span>→</span>
                  <span>{targetLang?.flag}</span>
                  {t.rating && (
                    <div className="flex items-center gap-0.5 ml-2">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      <span>{t.rating}</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-700 line-clamp-1">{t.sourceText}</p>
                <p className="text-sm text-gray-500 line-clamp-1 mt-1">
                  → {t.translatedText}
                </p>

                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" />
                  {new Date(t.timestamp).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
