import React, { useState } from 'react';
import { TranslationResult, SavedTranslation, ExportFormat } from '../types';
import { exportTranslations, exportMultilingualDocument } from '../services/exportService';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Settings,
  Globe,
} from 'lucide-react';

interface ExportPanelProps {
  translations: (TranslationResult | SavedTranslation)[];
  sourceText?: string;
  onClose?: () => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  translations,
  sourceText,
  onClose,
}) => {
  const [exportType, setExportType] = useState<ExportFormat['type']>('json');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeAlternatives, setIncludeAlternatives] = useState(true);
  const [includeCulturalNotes, setIncludeCulturalNotes] = useState(true);

  const handleExport = () => {
    exportTranslations(translations, {
      type: exportType,
      includeMetadata,
      includeAlternatives,
      includeCulturalNotes,
    });
  };

  const handleMultilingualExport = () => {
    if (sourceText && translations.length > 0) {
      exportMultilingualDocument(sourceText, translations as TranslationResult[]);
    }
  };

  const formatOptions = [
    { type: 'json' as const, icon: FileJson, label: 'JSON', desc: 'Structured data format' },
    { type: 'csv' as const, icon: FileSpreadsheet, label: 'CSV', desc: 'Spreadsheet compatible' },
    { type: 'txt' as const, icon: FileText, label: 'Text', desc: 'Plain text format' },
  ];

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Download className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">Export Translations</h3>
      </div>

      {translations.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No translations to export</p>
      ) : (
        <>
          {/* Format Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {formatOptions.map(({ type, icon: Icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => setExportType(type)}
                  className={`p-3 rounded-lg border-2 transition-all text-left
                    ${
                      exportType === type
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <Icon
                    className={`w-5 h-5 mb-1 ${
                      exportType === type ? 'text-primary-600' : 'text-gray-500'
                    }`}
                  />
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-xs text-gray-500">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Export Options</span>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Include metadata (date, confidence, etc.)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAlternatives}
                  onChange={(e) => setIncludeAlternatives(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Include alternative translations</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCulturalNotes}
                  onChange={(e) => setIncludeCulturalNotes(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Include cultural notes</span>
              </label>
            </div>
          </div>

          {/* Export Summary */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            Ready to export {translations.length} translation{translations.length !== 1 ? 's' : ''}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={handleExport} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              Export as {exportType.toUpperCase()}
            </button>
            {sourceText && translations.length > 1 && (
              <button
                onClick={handleMultilingualExport}
                className="btn-secondary flex items-center justify-center gap-2"
                title="Export all translations as a multilingual document"
              >
                <Globe className="w-4 h-4" />
                Multilingual
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
