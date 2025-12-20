import React, { useState } from 'react';
import { TranslationResult } from '../types';
import { SUPPORTED_LANGUAGES } from '../services/translationService';
import { X, Save, Tag } from 'lucide-react';

interface SaveModalProps {
  translation: TranslationResult;
  onSave: (title: string, tags: string[]) => void;
  onClose: () => void;
}

export const SaveModal: React.FC<SaveModalProps> = ({
  translation,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const sourceLang = SUPPORTED_LANGUAGES.find((l) => l.code === translation.sourceLanguage);
  const targetLang = SUPPORTED_LANGUAGES.find((l) => l.code === translation.targetLanguage);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = () => {
    const finalTitle =
      title.trim() ||
      `${sourceLang?.name} → ${targetLang?.name}: ${translation.sourceText.slice(0, 30)}...`;
    onSave(finalTitle, tags);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Save Translation</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Preview */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <span>{sourceLang?.flag}</span>
              <span>→</span>
              <span>{targetLang?.flag}</span>
            </div>
            <p className="text-sm text-gray-700 line-clamp-2">{translation.sourceText}</p>
            <p className="text-sm text-primary-600 mt-1 line-clamp-2">
              {translation.translatedText}
            </p>
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give this translation a name..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Add a tag..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
                className="btn-secondary"
              >
                <Tag className="w-4 h-4" />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100
                               text-gray-700 text-sm rounded-lg"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Translation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
