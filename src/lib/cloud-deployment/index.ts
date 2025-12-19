import {
  CloudProvider,
  DeploymentConfig,
  DeploymentStatus,
  PromptConfig,
  RateLimitConfig,
  WebhookConfig,
  APIKeyConfig,
  UsageMetrics
} from '@/types';
import { generateVercelDeployment } from './vercel';
import { generateCloudflareDeployment } from './cloudflare';
import { generateAWSLambdaDeployment } from './aws-lambda';
import { generateGCPFunctionsDeployment } from './gcp-functions';

export interface DeploymentFiles {
  files: Record<string, string>;
  readme: string;
  deployCommand: string;
}

export function generateDeployment(
  promptConfig: PromptConfig,
  deploymentConfig: DeploymentConfig
): DeploymentFiles {
  switch (deploymentConfig.provider) {
    case 'vercel':
      return generateVercelDeployment(promptConfig, deploymentConfig);
    case 'cloudflare':
      return generateCloudflareDeployment(promptConfig, deploymentConfig);
    case 'aws-lambda':
      return generateAWSLambdaDeployment(promptConfig, deploymentConfig);
    case 'gcp-functions':
      return generateGCPFunctionsDeployment(promptConfig, deploymentConfig);
    default:
      throw new Error(`Unsupported provider: ${deploymentConfig.provider}`);
  }
}

export function getDefaultDeploymentConfig(provider: CloudProvider): DeploymentConfig {
  const baseConfig: Omit<DeploymentConfig, 'provider'> = {
    name: 'prompt-api',
    region: 'us-east-1',
    environment: 'production',
    envVariables: {
      OPENAI_API_KEY: '',
    },
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

  const regionMap: Record<CloudProvider, string> = {
    'vercel': 'iad1',
    'cloudflare': 'auto',
    'aws-lambda': 'us-east-1',
    'gcp-functions': 'us-central1',
  };

  return {
    ...baseConfig,
    provider,
    region: regionMap[provider],
  };
}

export function getProviderInfo(provider: CloudProvider) {
  const providers = {
    vercel: {
      name: 'Vercel Edge Functions',
      description: 'Deploy to Vercel\'s global edge network for ultra-low latency',
      icon: 'vercel',
      features: ['Edge Runtime', 'Automatic HTTPS', 'Global CDN', 'Zero Config'],
      regions: [
        { id: 'iad1', name: 'Washington, D.C., USA' },
        { id: 'sfo1', name: 'San Francisco, USA' },
        { id: 'hnd1', name: 'Tokyo, Japan' },
        { id: 'cdg1', name: 'Paris, France' },
        { id: 'gru1', name: 'São Paulo, Brazil' },
        { id: 'syd1', name: 'Sydney, Australia' },
      ],
    },
    cloudflare: {
      name: 'Cloudflare Workers',
      description: 'Run on Cloudflare\'s edge network with 300+ locations worldwide',
      icon: 'cloudflare',
      features: ['V8 Isolates', '0ms Cold Start', 'Global Network', 'KV Storage'],
      regions: [
        { id: 'auto', name: 'Automatic (All Regions)' },
      ],
    },
    'aws-lambda': {
      name: 'AWS Lambda',
      description: 'Enterprise-grade serverless with full AWS ecosystem integration',
      icon: 'aws',
      features: ['VPC Support', 'IAM Integration', 'CloudWatch Logs', 'X-Ray Tracing'],
      regions: [
        { id: 'us-east-1', name: 'US East (N. Virginia)' },
        { id: 'us-west-2', name: 'US West (Oregon)' },
        { id: 'eu-west-1', name: 'EU (Ireland)' },
        { id: 'eu-central-1', name: 'EU (Frankfurt)' },
        { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
        { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
      ],
    },
    'gcp-functions': {
      name: 'Google Cloud Functions',
      description: 'Fully managed serverless platform with seamless GCP integration',
      icon: 'gcp',
      features: ['Cloud Run', 'Firestore', 'Cloud Logging', 'Secret Manager'],
      regions: [
        { id: 'us-central1', name: 'Iowa, USA' },
        { id: 'us-east1', name: 'South Carolina, USA' },
        { id: 'europe-west1', name: 'Belgium' },
        { id: 'europe-west2', name: 'London, UK' },
        { id: 'asia-east1', name: 'Taiwan' },
        { id: 'asia-northeast1', name: 'Tokyo, Japan' },
      ],
    },
  };

  return providers[provider];
}

export { generateVercelDeployment } from './vercel';
export { generateCloudflareDeployment } from './cloudflare';
export { generateAWSLambdaDeployment } from './aws-lambda';
export { generateGCPFunctionsDeployment } from './gcp-functions';
