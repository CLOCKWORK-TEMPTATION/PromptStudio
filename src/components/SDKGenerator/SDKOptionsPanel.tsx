'use client';

import React from 'react';
import { SDKGenerationOptions } from '@/types';

interface SDKOptionsPanelProps {
  options: SDKGenerationOptions;
  onChange: (updates: Partial<SDKGenerationOptions>) => void;
  language: 'python' | 'typescript';
}

export function SDKOptionsPanel({ options, onChange, language }: SDKOptionsPanelProps) {
  return (
    <div className="p-4 border-b border-dark-700 bg-dark-800/50 animate-fade-in">
      <h3 className="text-sm font-medium text-dark-200 mb-4">Generation Options</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Function Name */}
        <div>
          <label className="block text-xs text-dark-400 mb-1.5">Function Name</label>
          <input
            type="text"
            value={options.functionName}
            onChange={(e) => onChange({ functionName: e.target.value })}
            className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
            placeholder={language === 'python' ? 'generate_response' : 'generateResponse'}
          />
        </div>

        {/* Class Name */}
        <div>
          <label className="block text-xs text-dark-400 mb-1.5">Class Name</label>
          <input
            type="text"
            value={options.className}
            onChange={(e) => onChange({ className: e.target.value })}
            className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
            placeholder="PromptClient"
          />
        </div>

        {/* Timeout */}
        <div>
          <label className="block text-xs text-dark-400 mb-1.5">Timeout (ms)</label>
          <input
            type="number"
            value={options.timeout}
            onChange={(e) => onChange({ timeout: parseInt(e.target.value) || 30000 })}
            className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
            min={1000}
            max={300000}
            step={1000}
          />
        </div>

        {/* Retry Attempts */}
        <div>
          <label className="block text-xs text-dark-400 mb-1.5">Retry Attempts</label>
          <input
            type="number"
            value={options.retryAttempts}
            onChange={(e) => onChange({ retryAttempts: parseInt(e.target.value) || 3 })}
            className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
            min={0}
            max={10}
          />
        </div>

        {/* Retry Delay */}
        <div>
          <label className="block text-xs text-dark-400 mb-1.5">Retry Delay (ms)</label>
          <input
            type="number"
            value={options.retryDelay}
            onChange={(e) => onChange({ retryDelay: parseInt(e.target.value) || 1000 })}
            className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:border-primary-500 focus:outline-none"
            min={100}
            max={30000}
            step={100}
          />
        </div>
      </div>

      {/* Toggle Options */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <ToggleOption
          label="Async Mode"
          description={language === 'python' ? 'Use async/await with aiohttp' : 'Use async/await with fetch'}
          checked={options.asyncMode}
          onChange={(checked) => onChange({ asyncMode: checked })}
        />

        <ToggleOption
          label="Include Retry Logic"
          description="Exponential backoff for failures"
          checked={options.includeRetryLogic}
          onChange={(checked) => onChange({ includeRetryLogic: checked })}
        />

        <ToggleOption
          label="Error Handling"
          description="Custom exception classes"
          checked={options.includeErrorHandling}
          onChange={(checked) => onChange({ includeErrorHandling: checked })}
        />

        <ToggleOption
          label="Include Types"
          description={language === 'python' ? 'TypedDict definitions' : 'TypeScript interfaces'}
          checked={options.includeTypes}
          onChange={(checked) => onChange({ includeTypes: checked })}
        />

        <ToggleOption
          label="Include Docstrings"
          description="Documentation and examples"
          checked={options.includeDocstrings}
          onChange={(checked) => onChange({ includeDocstrings: checked })}
        />
      </div>
    </div>
  );
}

interface ToggleOptionProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleOption({ label, description, checked, onChange }: ToggleOptionProps) {
  return (
    <label className="flex items-start gap-3 p-3 bg-dark-900 rounded-lg cursor-pointer hover:bg-dark-800 transition-colors">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-9 h-5 rounded-full transition-colors ${
            checked ? 'bg-primary-500' : 'bg-dark-600'
          }`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
              checked ? 'translate-x-4' : ''
            }`}
          />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-dark-400 truncate">{description}</p>
      </div>
    </label>
  );
}
