'use client';

import React, { useState, useCallback } from 'react';
import { Cloud, Server, Globe, Shield, Activity, Key, Webhook, Settings, Rocket, Download, Copy, Check, ChevronRight, ExternalLink } from 'lucide-react';
import { usePromptStudioStore } from '@/store';
import { CloudProvider, DeploymentConfig } from '@/types';
import { generateDeployment, getProviderInfo } from '@/lib/cloud-deployment';
import { ProviderCard } from './ProviderCard';
import { DeploymentConfigPanel } from './DeploymentConfigPanel';
import { GeneratedFilesView } from './GeneratedFilesView';

const PROVIDERS: CloudProvider[] = ['vercel', 'cloudflare', 'aws-lambda', 'gcp-functions'];

export function CloudDeployment() {
  const { currentPrompt, deploymentConfigs, setDeploymentConfig } = usePromptStudioStore();
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider>('vercel');
  const [showConfig, setShowConfig] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<{
    files: Record<string, string>;
    readme: string;
    deployCommand: string;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const currentConfig = deploymentConfigs[selectedProvider];
  const providerInfo = getProviderInfo(selectedProvider);

  const handleGenerate = useCallback(() => {
    if (!currentPrompt) return;

    setIsGenerating(true);
    setTimeout(() => {
      try {
        const deployment = generateDeployment(currentPrompt, currentConfig);
        setGeneratedFiles(deployment);
        setActiveFile(Object.keys(deployment.files)[0]);
      } catch (error) {
        console.error('Deployment generation error:', error);
      } finally {
        setIsGenerating(false);
      }
    }, 500);
  }, [currentPrompt, currentConfig]);

  const updateConfig = useCallback(
    (updates: Partial<DeploymentConfig>) => {
      setDeploymentConfig(selectedProvider, updates);
    },
    [selectedProvider, setDeploymentConfig]
  );

  if (!currentPrompt) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-dark-400">
          <Cloud className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No prompt selected</p>
          <p className="text-sm mt-2">Create or select a prompt to deploy</p>
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
              <Cloud className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Cloud Deployment</h2>
              <p className="text-sm text-dark-400">Deploy your prompt as a serverless API endpoint</p>
            </div>
          </div>
        </div>
      </div>

      {/* Provider Selection */}
      <div className="p-4 border-b border-dark-700">
        <h3 className="text-sm font-medium text-dark-300 mb-3">Select Platform</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {PROVIDERS.map((provider) => (
            <ProviderCard
              key={provider}
              provider={provider}
              selected={selectedProvider === provider}
              onClick={() => {
                setSelectedProvider(provider);
                setGeneratedFiles(null);
              }}
            />
          ))}
        </div>
      </div>

      {/* Provider Info & Config Toggle */}
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">{providerInfo.name}</h3>
            <p className="text-sm text-dark-400 mt-1">{providerInfo.description}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {providerInfo.features.map((feature) => (
                <span
                  key={feature}
                  className="px-2 py-1 bg-dark-800 text-dark-300 text-xs rounded-full"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showConfig
                ? 'bg-primary-500/20 text-primary-400'
                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            Configure
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <DeploymentConfigPanel
          config={currentConfig}
          onChange={updateConfig}
          provider={selectedProvider}
          regions={providerInfo.regions}
        />
      )}

      {/* Generate Button */}
      <div className="p-4 border-b border-dark-700">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Rocket className="w-5 h-5" />
              Generate Deployment Files
            </>
          )}
        </button>
      </div>

      {/* Generated Files */}
      {generatedFiles ? (
        <GeneratedFilesView
          files={generatedFiles.files}
          readme={generatedFiles.readme}
          deployCommand={generatedFiles.deployCommand}
          activeFile={activeFile}
          onSelectFile={setActiveFile}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-dark-400">
          <div className="text-center">
            <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Click "Generate Deployment Files" to create your deployment</p>
          </div>
        </div>
      )}
    </div>
  );
}
