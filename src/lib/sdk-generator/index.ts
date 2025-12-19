import { PromptConfig, SDKGenerationOptions, GeneratedSDK } from '@/types';
import { generatePythonSDK } from './python-generator';
import { generateTypeScriptSDK } from './typescript-generator';

export function generateSDK(
  promptConfig: PromptConfig,
  options: SDKGenerationOptions
): GeneratedSDK {
  switch (options.language) {
    case 'python':
      return generatePythonSDK(promptConfig, options);
    case 'typescript':
      return generateTypeScriptSDK(promptConfig, options);
    default:
      throw new Error(`Unsupported language: ${options.language}`);
  }
}

export function getDefaultSDKOptions(language: 'python' | 'typescript'): SDKGenerationOptions {
  return {
    language,
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
  };
}

export { generatePythonSDK } from './python-generator';
export { generateTypeScriptSDK } from './typescript-generator';
