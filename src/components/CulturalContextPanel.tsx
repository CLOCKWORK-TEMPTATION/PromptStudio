import React from 'react';
import { CulturalContext } from '../types';
import { Settings, Globe, Users, BookOpen } from 'lucide-react';

interface CulturalContextPanelProps {
  context: CulturalContext;
  onChange: (context: Partial<CulturalContext>) => void;
}

export const CulturalContextPanel: React.FC<CulturalContextPanelProps> = ({
  context,
  onChange,
}) => {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">Cultural Context</h3>
      </div>

      <div className="space-y-4">
        {/* Formality */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Formality Level
            </div>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['formal', 'neutral', 'informal'] as const).map((level) => (
              <button
                key={level}
                onClick={() => onChange({ formality: level })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${
                    context.formality === level
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Audience */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Target Audience
            </div>
          </label>
          <select
            value={context.audience || 'general'}
            onChange={(e) =>
              onChange({ audience: e.target.value as CulturalContext['audience'] })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2
                       focus:ring-primary-500 focus:border-transparent"
          >
            <option value="general">General</option>
            <option value="business">Business</option>
            <option value="academic">Academic</option>
            <option value="technical">Technical</option>
            <option value="creative">Creative</option>
          </select>
        </div>

        {/* Options */}
        <div className="space-y-3 pt-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={context.preserveIdioms}
              onChange={(e) => onChange({ preserveIdioms: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-primary-600
                         focus:ring-primary-500 cursor-pointer"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                Preserve Idioms
              </span>
              <p className="text-xs text-gray-500">
                Keep idiomatic expressions in their original form
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={context.adaptCulturalReferences}
              onChange={(e) => onChange({ adaptCulturalReferences: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-primary-600
                         focus:ring-primary-500 cursor-pointer"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                Adapt Cultural References
              </span>
              <p className="text-xs text-gray-500">
                Modify cultural references for target audience
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};
