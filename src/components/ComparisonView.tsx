import React from 'react';
import { TranslationResult } from '../types';
import { SUPPORTED_LANGUAGES } from '../services/translationService';
import { ArrowRight, Columns } from 'lucide-react';

interface ComparisonViewProps {
  sourceText: string;
  sourceLanguage: string;
  translations: TranslationResult[];
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  sourceText,
  sourceLanguage,
  translations,
}) => {
  const sourceLangInfo = SUPPORTED_LANGUAGES.find((l) => l.code === sourceLanguage);

  if (translations.length === 0) {
    return null;
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Columns className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">Side-by-Side Comparison</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                <div className="flex items-center gap-2">
                  <span>{sourceLangInfo?.flag}</span>
                  <span>{sourceLangInfo?.name} (Source)</span>
                </div>
              </th>
              {translations.map((t) => {
                const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === t.targetLanguage);
                return (
                  <th key={t.id} className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                    <div className="flex items-center gap-2">
                      <span>{langInfo?.flag}</span>
                      <span>{langInfo?.name}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                className="px-4 py-4 align-top border-r border-gray-100"
                dir={sourceLangInfo?.direction}
              >
                <p className="text-gray-800">{sourceText}</p>
              </td>
              {translations.map((t) => {
                const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === t.targetLanguage);
                return (
                  <td
                    key={t.id}
                    className="px-4 py-4 align-top border-r border-gray-100 last:border-r-0"
                    dir={langInfo?.direction}
                  >
                    <p className={`text-gray-800 ${t.targetLanguage === 'zh' ? 'chinese-text' : ''}`}>
                      {t.translatedText}
                    </p>
                    <div className="mt-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium
                          ${
                            t.confidence >= 0.9
                              ? 'bg-green-100 text-green-700'
                              : t.confidence >= 0.7
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                      >
                        {(t.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Flow visualization */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Translation Flow</h4>
        <div className="flex items-center justify-center flex-wrap gap-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary-100 rounded-lg">
            <span className="text-lg">{sourceLangInfo?.flag}</span>
            <span className="font-medium text-primary-700">{sourceLangInfo?.name}</span>
          </div>
          {translations.map((t, index) => {
            const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === t.targetLanguage);
            return (
              <React.Fragment key={t.id}>
                <ArrowRight className="w-5 h-5 text-gray-400" />
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
                  <span className="text-lg">{langInfo?.flag}</span>
                  <span className="font-medium text-gray-700">{langInfo?.name}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
