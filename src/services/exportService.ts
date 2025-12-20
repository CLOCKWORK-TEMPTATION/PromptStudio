import { saveAs } from 'file-saver';
import { SavedTranslation, TranslationResult, ExportFormat } from '../types';
import { SUPPORTED_LANGUAGES } from './translationService';

function getLanguageName(code: string): string {
  return SUPPORTED_LANGUAGES.find(l => l.code === code)?.name || code;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString();
}

export function exportToJSON(
  translations: (SavedTranslation | TranslationResult)[],
  options: ExportFormat
): void {
  const data = translations.map(t => {
    const base = {
      sourceText: t.sourceText,
      sourceLanguage: getLanguageName(t.sourceLanguage),
      targetLanguage: getLanguageName(t.targetLanguage),
      translatedText: t.translatedText,
    };

    if (options.includeMetadata) {
      Object.assign(base, {
        id: t.id,
        timestamp: formatDate(t.timestamp),
        confidence: `${(t.confidence * 100).toFixed(1)}%`,
        isCertified: t.isCertified,
        rating: t.rating,
        culturalContext: t.culturalContext,
      });
    }

    if (options.includeAlternatives && t.alternativeTranslations) {
      Object.assign(base, {
        alternativeTranslations: t.alternativeTranslations,
      });
    }

    if (options.includeCulturalNotes && t.culturalNotes) {
      Object.assign(base, {
        culturalNotes: t.culturalNotes,
      });
    }

    return base;
  });

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  saveAs(blob, `translations_${Date.now()}.json`);
}

export function exportToCSV(
  translations: (SavedTranslation | TranslationResult)[],
  options: ExportFormat
): void {
  const headers = [
    'Source Text',
    'Source Language',
    'Target Language',
    'Translated Text',
  ];

  if (options.includeMetadata) {
    headers.push('Timestamp', 'Confidence', 'Certified', 'Rating');
  }

  if (options.includeAlternatives) {
    headers.push('Alternative Translations');
  }

  if (options.includeCulturalNotes) {
    headers.push('Cultural Notes');
  }

  const rows = translations.map(t => {
    const row = [
      `"${t.sourceText.replace(/"/g, '""')}"`,
      getLanguageName(t.sourceLanguage),
      getLanguageName(t.targetLanguage),
      `"${t.translatedText.replace(/"/g, '""')}"`,
    ];

    if (options.includeMetadata) {
      row.push(
        formatDate(t.timestamp),
        `${(t.confidence * 100).toFixed(1)}%`,
        t.isCertified ? 'Yes' : 'No',
        t.rating?.toString() || ''
      );
    }

    if (options.includeAlternatives) {
      row.push(`"${(t.alternativeTranslations || []).join('; ').replace(/"/g, '""')}"`);
    }

    if (options.includeCulturalNotes) {
      row.push(`"${(t.culturalNotes || []).join('; ').replace(/"/g, '""')}"`);
    }

    return row.join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], {
    type: 'text/csv;charset=utf-8',
  });
  saveAs(blob, `translations_${Date.now()}.csv`);
}

export function exportToTXT(
  translations: (SavedTranslation | TranslationResult)[],
  options: ExportFormat
): void {
  const lines = translations.map((t, index) => {
    const parts = [
      `=== Translation ${index + 1} ===`,
      ``,
      `Source (${getLanguageName(t.sourceLanguage)}):`,
      t.sourceText,
      ``,
      `Translation (${getLanguageName(t.targetLanguage)}):`,
      t.translatedText,
    ];

    if (options.includeMetadata) {
      parts.push(
        ``,
        `--- Metadata ---`,
        `Date: ${formatDate(t.timestamp)}`,
        `Confidence: ${(t.confidence * 100).toFixed(1)}%`,
        `Certified: ${t.isCertified ? 'Yes' : 'No'}`,
        t.rating ? `Rating: ${t.rating}/5` : ''
      );
    }

    if (options.includeAlternatives && t.alternativeTranslations?.length) {
      parts.push(
        ``,
        `--- Alternative Translations ---`,
        ...t.alternativeTranslations.map((alt, i) => `${i + 1}. ${alt}`)
      );
    }

    if (options.includeCulturalNotes && t.culturalNotes?.length) {
      parts.push(
        ``,
        `--- Cultural Notes ---`,
        ...t.culturalNotes.map((note, i) => `${i + 1}. ${note}`)
      );
    }

    return parts.filter(Boolean).join('\n');
  });

  const text = lines.join('\n\n' + '='.repeat(50) + '\n\n');
  const blob = new Blob([text], {
    type: 'text/plain;charset=utf-8',
  });
  saveAs(blob, `translations_${Date.now()}.txt`);
}

export function exportTranslations(
  translations: (SavedTranslation | TranslationResult)[],
  format: ExportFormat
): void {
  switch (format.type) {
    case 'json':
      exportToJSON(translations, format);
      break;
    case 'csv':
      exportToCSV(translations, format);
      break;
    case 'txt':
      exportToTXT(translations, format);
      break;
    default:
      exportToJSON(translations, format);
  }
}

export function exportMultilingualDocument(
  sourceText: string,
  translations: TranslationResult[]
): void {
  const doc = {
    title: 'Multilingual Document',
    createdAt: new Date().toISOString(),
    sourceText,
    translations: translations.map(t => ({
      language: getLanguageName(t.targetLanguage),
      languageCode: t.targetLanguage,
      text: t.translatedText,
      confidence: `${(t.confidence * 100).toFixed(1)}%`,
    })),
  };

  const blob = new Blob([JSON.stringify(doc, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  saveAs(blob, `multilingual_${Date.now()}.json`);
}
