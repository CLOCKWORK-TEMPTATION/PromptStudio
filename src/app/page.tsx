'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Code,
  Cloud,
  Activity,
  PenTool,
  Plus,
  Settings,
  ChevronRight,
  Zap,
  Terminal,
  Globe,
  Shield,
  Menu,
  X,
} from 'lucide-react';
import { usePromptStudioStore } from '@/store';
import { SDKGenerator } from '@/components/SDKGenerator';
import { CloudDeployment } from '@/components/CloudDeployment';
import { PromptEditor } from '@/components/PromptEditor';

type Tab = 'editor' | 'sdk' | 'deploy';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('editor');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { currentPrompt } = usePromptStudioStore();

  const tabs = [
    { id: 'editor' as Tab, label: 'Prompt Editor', icon: PenTool },
    { id: 'sdk' as Tab, label: 'SDK Generator', icon: Code },
    { id: 'deploy' as Tab, label: 'Cloud Deploy', icon: Cloud },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-dark-950">
      {/* Header */}
      <header className="h-14 border-b border-dark-800 flex items-center justify-between px-4 bg-dark-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold gradient-text hidden sm:block">PromptStudio</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-dark-400 hover:text-white hover:bg-dark-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`w-64 border-r border-dark-800 bg-dark-900/50 flex-shrink-0 transition-all duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:border-0'
          } fixed lg:relative h-[calc(100vh-3.5rem)] z-40 lg:z-auto`}
        >
          <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-dark-300">Prompts</h2>
              <button className="p-1.5 hover:bg-dark-700 rounded-lg text-dark-400 hover:text-primary-400 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Prompt List */}
            <div className="flex-1 overflow-y-auto space-y-1">
              {currentPrompt && (
                <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {currentPrompt.name}
                      </p>
                      <p className="text-xs text-dark-400 mt-0.5 truncate">
                        {currentPrompt.model}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-primary-400 flex-shrink-0" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="pt-4 border-t border-dark-800 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-dark-400 text-xs">API Calls</p>
                  <p className="text-white font-medium">1,234</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Terminal className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-dark-400 text-xs">SDKs Generated</p>
                  <p className="text-white font-medium">12</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-dark-400 text-xs">Deployments</p>
                  <p className="text-white font-medium">4</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'editor' && <PromptEditor />}
          {activeTab === 'sdk' && <SDKGenerator />}
          {activeTab === 'deploy' && <CloudDeployment />}
        </div>
      </main>
    </div>
  );
}
