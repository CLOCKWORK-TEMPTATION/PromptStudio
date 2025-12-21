'use client';

import React from 'react';
import { Brain, Sparkles, Zap } from 'lucide-react';
import { useTranslation } from '../i18n';
import clsx from 'clsx';

interface ProviderSelectorProps {
  selectedProvider: 'openai' | 'anthropic' | 'google';
  onProviderChange: (provider: 'openai' | 'anthropic' | 'google') => void;
  theme?: 'light' | 'dark';
}

export function ProviderSelector({ selectedProvider, onProviderChange, theme = 'light' }: ProviderSelectorProps) {
  const { t } = useTranslation();
  
  const providers = [
    {
      id: 'openai' as const,
      name: t('providers.openai'),
      icon: Brain,
      color: 'emerald',
      models: ['GPT-4', 'GPT-4 Turbo', 'GPT-3.5'],
      description: t('providers.openaiDesc')
    },
    {
      id: 'anthropic' as const,
      name: t('providers.anthropic'),
      icon: Sparkles,
      color: 'purple',
      models: ['Claude 3 Opus', 'Sonnet', 'Haiku'],
      description: t('providers.anthropicDesc')
    },
    {
      id: 'google' as const,
      name: t('providers.google'),
      icon: Zap,
      color: 'blue',
      models: ['Gemini Pro'],
      description: t('providers.googleDesc')
    }
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {providers.map((provider) => {
        const Icon = provider.icon;
        const isSelected = selectedProvider === provider.id;
        
        return (
          <button
            key={provider.id}
            onClick={() => onProviderChange(provider.id)}
            className={clsx(
              'p-4 rounded-lg border-2 transition-all text-left',
              isSelected
                ? theme === 'dark'
                  ? `border-${provider.color}-500 bg-${provider.color}-500/10`
                  : `border-${provider.color}-500 bg-${provider.color}-50`
                : theme === 'dark'
                  ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  : 'border-gray-200 bg-white hover:border-gray-300'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={clsx(
                'w-5 h-5',
                isSelected
                  ? `text-${provider.color}-500`
                  : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )} />
              <span className={clsx(
                'font-semibold',
                isSelected
                  ? `text-${provider.color}-500`
                  : theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {provider.name}
              </span>
            </div>
            <p className={clsx(
              'text-xs mb-2',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              {provider.description}
            </p>
            <div className="flex flex-wrap gap-1">
              {provider.models.map((model) => (
                <span
                  key={model}
                  className={clsx(
                    'text-xs px-2 py-0.5 rounded',
                    theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {model}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
