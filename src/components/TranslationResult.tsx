import React, { useState } from 'react';
import { TranslationResult as TResult } from '../types';
import { SUPPORTED_LANGUAGES } from '../services/translationService';
import {
  Copy,
  Check,
  Star,
  BookmarkPlus,
  Award,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TranslationResultProps {
  result: TResult;
  onSave: (result: TResult) => void;
  onRate: (id: string, rating: number) => void;
  onCertify: (id: string, certified: boolean) => void;
}

export const TranslationResultCard: React.FC<TranslationResultProps> = ({
  result,
  onSave,
  onRate,
  onCertify,
}) => {
  const [copied, setCopied] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === result.targetLanguage);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confidenceColor =
    result.confidence >= 0.9
      ? 'text-green-600 bg-green-50'
      : result.confidence >= 0.7
      ? 'text-yellow-600 bg-yellow-50'
      : 'text-red-600 bg-red-50';

  return (
    <div className="card p-5 hover:shadow-xl transition-shadow duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{langInfo?.flag}</span>
          <div>
            <h4 className="font-semibold text-gray-900">{langInfo?.name}</h4>
            <span className="text-sm text-gray-500">{langInfo?.nativeName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${confidenceColor}`}>
            {(result.confidence * 100).toFixed(0)}% confidence
          </span>
          {result.isCertified && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700 flex items-center gap-1">
              <Award className="w-3 h-3" />
              Certified
            </span>
          )}
        </div>
      </div>

      {/* Translation */}
      <div
        className="p-4 bg-gray-50 rounded-lg mb-3"
        dir={langInfo?.direction}
      >
        <p className={`text-lg text-gray-800 ${result.targetLanguage === 'zh' ? 'chinese-text' : ''}`}>
          {result.translatedText}
        </p>
      </div>

      {/* Alternative Translations */}
      {result.alternativeTranslations && result.alternativeTranslations.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
          >
            <Info className="w-4 h-4" />
            {result.alternativeTranslations.length} alternative(s)
            {showNotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showNotes && (
            <div className="mt-2 space-y-1">
              {result.alternativeTranslations.map((alt, i) => (
                <p key={i} className="text-sm text-gray-600 pl-5">
                  {alt}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cultural Notes */}
      {result.culturalNotes && result.culturalNotes.length > 0 && (
        <div className="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <h5 className="text-sm font-medium text-amber-800 mb-1">Cultural Notes</h5>
          <ul className="text-sm text-amber-700 space-y-1">
            {result.culturalNotes.map((note, i) => (
              <li key={i}>• {note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Rating */}
      <div className="flex items-center gap-1 mb-3">
        <span className="text-sm text-gray-600 mr-2">Rate:</span>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => onRate(result.id, star)}
            className="focus:outline-none"
          >
            <Star
              className={`w-5 h-5 transition-colors ${
                star <= (hoverRating || result.rating || 0)
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
        {result.rating && (
          <span className="text-sm text-gray-500 ml-2">({result.rating}/5)</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600
                       hover:bg-gray-100 rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
          <button
            onClick={() => onSave(result)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600
                       hover:bg-gray-100 rounded-lg transition-colors"
          >
            <BookmarkPlus className="w-4 h-4" />
            Save
          </button>
        </div>
        <button
          onClick={() => onCertify(result.id, !result.isCertified)}
          className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors
            ${
              result.isCertified
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
          <Award className="w-4 h-4" />
          {result.isCertified ? 'Certified' : 'Certify'}
        </button>
      </div>
    </div>
  );
};
