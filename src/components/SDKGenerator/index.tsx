'use client';

import React, { useState, useCallback } from 'react';
import { Code, Copy, Check, Download, Settings, Zap, RefreshCw, FileCode } from 'lucide-react';
import { usePromptStudioStore } from '@/store';
import { generateSDK } from '@/lib/sdk-generator';
import { SDKGenerationOptions, GeneratedSDK } from '@/types';
import { CodePreview } from './CodePreview';
import { SDKOptionsPanel } from './SDKOptionsPanel';

export function SDKGenerator() {
  const { currentPrompt, sdkOptions, setSdkOptions, generatedSDKs, addGeneratedSDK } = usePromptStudioStore();
  const [activeLanguage, setActiveLanguage] = useState<'python' | 'typescript'>('python');
  const [showOptions, setShowOptions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentOptions = sdkOptions[activeLanguage];
  const currentSDK = generatedSDKs.find((s) => s.language === activeLanguage);

  const handleGenerate = useCallback(() => {
    if (!currentPrompt) return;

    setIsGenerating(true);

    // Simulate generation delay for better UX
    setTimeout(() => {
      try {
        const sdk = generateSDK(currentPrompt, currentOptions);
        addGeneratedSDK(sdk);
      } catch (error) {
        console.error('SDK generation error:', error);
      } finally {
        setIsGenerating(false);
      }
    }, 500);
  }, [currentPrompt, currentOptions, addGeneratedSDK]);

  const handleCopy = useCallback(async () => {
    if (!currentSDK) return;

    try {
      await navigator.clipboard.writeText(currentSDK.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }, [currentSDK]);

  const handleDownload = useCallback(() => {
    if (!currentSDK) return;

    const blob = new Blob([currentSDK.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentSDK.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentSDK]);

  const updateOptions = useCallback(
    (updates: Partial<SDKGenerationOptions>) => {
      setSdkOptions(activeLanguage, updates);
    },
    [activeLanguage, setSdkOptions]
  );

  if (!currentPrompt) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-dark-400">
          <FileCode className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No prompt selected</p>
          <p className="text-sm mt-2">Create or select a prompt to generate SDK code</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-900">
      {/* Header */}
      <div className="border-b border-dark-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/10 rounded-lg">
              <Code className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">SDK Generator</h2>
              <p className="text-sm text-dark-400">Generate ready-to-use client code for your prompt</p>
            </div>
          </div>
          <button
            onClick={() => setShowOptions(!showOptions)}
            className={`p-2 rounded-lg transition-colors ${
              showOptions
                ? 'bg-primary-500/20 text-primary-400'
                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Language Tabs */}
        <div className="flex gap-2 mt-4">
          {(['python', 'typescript'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setActiveLanguage(lang)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeLanguage === lang
                  ? 'bg-primary-500 text-white'
                  : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
              }`}
            >
              {lang === 'python' ? '🐍 Python' : '📘 TypeScript'}
            </button>
          ))}
        </div>
      </div>

      {/* Options Panel */}
      {showOptions && (
        <SDKOptionsPanel
          options={currentOptions}
          onChange={updateOptions}
          language={activeLanguage}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Generate Button */}
        <div className="p-4 border-b border-dark-700">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Generate SDK Code
              </>
            )}
          </button>
        </div>

        {/* Code Preview */}
        {currentSDK ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Code Actions */}
            <div className="flex items-center justify-between px-4 py-2 bg-dark-800 border-b border-dark-700">
              <div className="flex items-center gap-2 text-sm text-dark-400">
                <FileCode className="w-4 h-4" />
                <span>{currentSDK.filename}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded text-sm text-dark-200 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded text-sm text-dark-200 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Code Content */}
            <div className="flex-1 overflow-auto">
              <CodePreview code={currentSDK.code} language={activeLanguage} />
            </div>

            {/* Dependencies */}
            {currentSDK.dependencies.length > 0 && (
              <div className="px-4 py-3 bg-dark-800 border-t border-dark-700">
                <p className="text-xs text-dark-400 mb-2">Dependencies:</p>
                <div className="flex flex-wrap gap-2">
                  {currentSDK.dependencies.map((dep) => (
                    <code
                      key={dep}
                      className="px-2 py-1 bg-dark-900 rounded text-xs text-primary-400"
                    >
                      {dep}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-dark-400">
            <div className="text-center">
              <Code className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Click "Generate SDK Code" to create your wrapper</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
