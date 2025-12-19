import { create } from 'zustand';
import { PromptConfig, SDKGenerationOptions, DeploymentConfig, CloudProvider, GeneratedSDK, DeploymentStatus } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface PromptStudioState {
  // Current prompt configuration
  currentPrompt: PromptConfig | null;
  setCurrentPrompt: (prompt: PromptConfig | null) => void;
  updatePrompt: (updates: Partial<PromptConfig>) => void;

  // Saved prompts
  prompts: PromptConfig[];
  addPrompt: (prompt: PromptConfig) => void;
  deletePrompt: (id: string) => void;

  // SDK Generation
  sdkOptions: Record<'python' | 'typescript', SDKGenerationOptions>;
  setSdkOptions: (language: 'python' | 'typescript', options: Partial<SDKGenerationOptions>) => void;
  generatedSDKs: GeneratedSDK[];
  addGeneratedSDK: (sdk: GeneratedSDK) => void;
  clearGeneratedSDKs: () => void;

  // Cloud Deployment
  deploymentConfigs: Record<CloudProvider, DeploymentConfig>;
  setDeploymentConfig: (provider: CloudProvider, config: Partial<DeploymentConfig>) => void;
  deployments: DeploymentStatus[];
  addDeployment: (deployment: DeploymentStatus) => void;
  updateDeployment: (id: string, updates: Partial<DeploymentStatus>) => void;

  // UI State
  activeTab: 'editor' | 'sdk' | 'deploy' | 'analytics';
  setActiveTab: (tab: 'editor' | 'sdk' | 'deploy' | 'analytics') => void;
}

const defaultPrompt: PromptConfig = {
  id: uuidv4(),
  name: 'New Prompt',
  description: '',
  prompt: '',
  model: 'gpt-4-turbo-preview',
  temperature: 0.7,
  maxTokens: 1024,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: [],
  variables: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const defaultSDKOptions: Record<'python' | 'typescript', SDKGenerationOptions> = {
  python: {
    language: 'python',
    asyncMode: true,
    includeRetryLogic: true,
    includeErrorHandling: true,
    functionName: 'generate_response',
    className: 'PromptClient',
    includeTypes: true,
    includeDocstrings: true,
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000,
  },
  typescript: {
    language: 'typescript',
    asyncMode: true,
    includeRetryLogic: true,
    includeErrorHandling: true,
    functionName: 'generateResponse',
    className: 'PromptClient',
    includeTypes: true,
    includeDocstrings: true,
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000,
  },
};

const defaultDeploymentConfig: DeploymentConfig = {
  provider: 'vercel',
  name: 'prompt-api',
  region: 'iad1',
  environment: 'production',
  envVariables: {},
  timeout: 30,
  memory: 256,
  rateLimit: {
    enabled: true,
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    burstLimit: 10,
  },
};

export const usePromptStudioStore = create<PromptStudioState>((set) => ({
  // Prompt state
  currentPrompt: defaultPrompt,
  setCurrentPrompt: (prompt) => set({ currentPrompt: prompt }),
  updatePrompt: (updates) =>
    set((state) => ({
      currentPrompt: state.currentPrompt
        ? { ...state.currentPrompt, ...updates, updatedAt: new Date() }
        : null,
    })),

  prompts: [],
  addPrompt: (prompt) =>
    set((state) => ({ prompts: [...state.prompts, prompt] })),
  deletePrompt: (id) =>
    set((state) => ({ prompts: state.prompts.filter((p) => p.id !== id) })),

  // SDK Generation state
  sdkOptions: defaultSDKOptions,
  setSdkOptions: (language, options) =>
    set((state) => ({
      sdkOptions: {
        ...state.sdkOptions,
        [language]: { ...state.sdkOptions[language], ...options },
      },
    })),
  generatedSDKs: [],
  addGeneratedSDK: (sdk) =>
    set((state) => ({
      generatedSDKs: [
        ...state.generatedSDKs.filter((s) => s.language !== sdk.language),
        sdk,
      ],
    })),
  clearGeneratedSDKs: () => set({ generatedSDKs: [] }),

  // Cloud Deployment state
  deploymentConfigs: {
    vercel: { ...defaultDeploymentConfig, provider: 'vercel', region: 'iad1' },
    cloudflare: { ...defaultDeploymentConfig, provider: 'cloudflare', region: 'auto' },
    'aws-lambda': { ...defaultDeploymentConfig, provider: 'aws-lambda', region: 'us-east-1' },
    'gcp-functions': { ...defaultDeploymentConfig, provider: 'gcp-functions', region: 'us-central1' },
  },
  setDeploymentConfig: (provider, config) =>
    set((state) => ({
      deploymentConfigs: {
        ...state.deploymentConfigs,
        [provider]: { ...state.deploymentConfigs[provider], ...config },
      },
    })),
  deployments: [],
  addDeployment: (deployment) =>
    set((state) => ({ deployments: [...state.deployments, deployment] })),
  updateDeployment: (id, updates) =>
    set((state) => ({
      deployments: state.deployments.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    })),

  // UI State
  activeTab: 'editor',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
