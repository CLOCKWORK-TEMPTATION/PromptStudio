'use client';

import React from 'react';
import { Languages } from 'lucide-react';
import { useTranslation } from '../i18n';
import clsx from 'clsx';

interface LanguageSwitcherProps {
  theme?: 'light' | 'dark';
}

export function LanguageSwitcher({ theme = 'light' }: LanguageSwitcherProps) {
  const { language, setLanguage } = useTranslation();

  return (
    <button
      onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
        theme === 'dark'
          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      )}
      title={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <Languages className="w-4 h-4" />
      <span className="text-sm font-medium">
        {language === 'ar' ? 'EN' : 'عربي'}
      </span>
    </button>
  );
}
