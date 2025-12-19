'use client';

import React from 'react';
import { CloudProvider } from '@/types';
import { Check } from 'lucide-react';

interface ProviderCardProps {
  provider: CloudProvider;
  selected: boolean;
  onClick: () => void;
}

const PROVIDER_LOGOS: Record<CloudProvider, { icon: React.ReactNode; colors: string }> = {
  vercel: {
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12 2L2 19.5h20L12 2z" />
      </svg>
    ),
    colors: 'bg-white/10 text-white',
  },
  cloudflare: {
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M16.309 13.072l.918-2.859a.42.42 0 00-.016-.313.368.368 0 00-.235-.183l-7.48-.967a.092.092 0 01-.065-.047.085.085 0 01.011-.092.098.098 0 01.082-.039l7.606-.971a1.78 1.78 0 001.19-.757 1.694 1.694 0 00.32-1.349l-.58-2.127a.25.25 0 00-.125-.156.273.273 0 00-.202-.023 6.555 6.555 0 00-1.756.567 6.787 6.787 0 00-1.498.979H6.667a4.084 4.084 0 00-4.083 4.084V14.5a4.084 4.084 0 004.083 4.084h11.75c.176 0 .32-.144.32-.32v-.944a.32.32 0 00-.32-.32H6.667a1.084 1.084 0 01-1.084-1.084v-.976a.32.32 0 01.32-.32h9.766a1.78 1.78 0 001.507-.848 1.694 1.694 0 00.133-1.7z" />
        <path d="M19.35 8.85a.425.425 0 00-.312.118.394.394 0 00-.121.312v.64a.098.098 0 01-.098.098h-1.24a.098.098 0 01-.097-.098v-.64a.394.394 0 00-.121-.312.425.425 0 00-.312-.118h-1.18a.425.425 0 00-.312.118.394.394 0 00-.121.312v4.24c0 .124.044.229.121.312a.425.425 0 00.312.118h1.18a.425.425 0 00.312-.118.394.394 0 00.121-.312V12a.098.098 0 01.097-.098h1.24a.098.098 0 01.098.098v1.42c0 .124.044.229.121.312a.425.425 0 00.312.118h1.18a.425.425 0 00.312-.118.394.394 0 00.121-.312V9.28a.394.394 0 00-.121-.312.425.425 0 00-.312-.118h-1.18z" />
      </svg>
    ),
    colors: 'bg-orange-500/20 text-orange-400',
  },
  'aws-lambda': {
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M7.164 20.563l-.673 1.424H4.269l4.46-9.406.74 1.559-2.305 4.867v1.556zm3.6-8.363l2.418 5.104 2.418-5.104h2.237L13.6 21.987H11.363L7.126 12.2h2.237zm6.072 6.807v1.556l2.305-4.867-.74-1.559-4.46 9.406h2.222l.673-1.424v-3.112z" />
        <path d="M21.727 12l-9.727 9.727L2.273 12 12 2.273 21.727 12zM12 0L0 12l12 12 12-12L12 0z" />
      </svg>
    ),
    colors: 'bg-amber-500/20 text-amber-400',
  },
  'gcp-functions': {
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12.19 2.38a9.344 9.344 0 00-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.11-.247 10.941l.006-.007-.007.03a6.717 6.717 0 006.799 1.3h7.186c3.805-.326 6.672-3.548 6.672-7.381 0-1.322-.369-2.611-1.064-3.72l-.001.004A9.34 9.34 0 0012.19 2.38zm-.357 4.146c.276.004.548.03.815.074l-2.696 4.55h5.239l-5.062 8.479c-.262.007-.526.007-.787-.002a5.167 5.167 0 01-4.545-7.313l.08-.156 3.611-6.122a5.197 5.197 0 013.345-.51z" />
      </svg>
    ),
    colors: 'bg-blue-500/20 text-blue-400',
  },
};

const PROVIDER_NAMES: Record<CloudProvider, string> = {
  vercel: 'Vercel',
  cloudflare: 'Cloudflare',
  'aws-lambda': 'AWS Lambda',
  'gcp-functions': 'GCP Functions',
};

export function ProviderCard({ provider, selected, onClick }: ProviderCardProps) {
  const { icon, colors } = PROVIDER_LOGOS[provider];
  const name = PROVIDER_NAMES[provider];

  return (
    <button
      onClick={onClick}
      className={`relative p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-primary-500 bg-primary-500/10'
          : 'border-dark-700 bg-dark-800 hover:border-dark-600 hover:bg-dark-700'
      }`}
    >
      {selected && (
        <div className="absolute top-2 right-2">
          <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        </div>
      )}
      <div className={`w-10 h-10 rounded-lg ${colors} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-sm font-medium text-white text-left">{name}</p>
    </button>
  );
}
