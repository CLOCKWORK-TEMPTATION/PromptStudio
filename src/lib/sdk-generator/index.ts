
import { generatePythonSDKTemplate } from './python-template';
import { generateTypeScriptSDKTemplate } from './typescript-template';

export function generateSDK(
  promptConfig: PromptConfig,
  options: SDKGenerationOptions & { language: 'python' | 'typescript' | 'curl' }
): GeneratedSDK {
  switch (options.language) {
    case 'python':
      return generatePythonSDKTemplate(promptConfig, options);
    case 'typescript':
      return generateTypeScriptSDKTemplate(promptConfig, options);
    case 'curl':
      return {
        language: 'curl',
        code: `curl -X POST https://api.promptstudio.ai/v1/execute -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"prompt": "YOUR_PROMPT_HERE"}'`,
        filename: 'promptstudio.sh',
        dependencies: ['curl'],
      };
    default:
      throw new Error(`Unsupported language: ${options.language}`);
  }
}

export function getDefaultSDKOptions(language: 'python' | 'typescript' | 'curl'): SDKGenerationOptions & { language: 'python' | 'typescript' | 'curl' } {
  return {
    language,
    asyncMode: true,
    includeRetryLogic: true,
    includeErrorHandling: true,
    functionName: language === 'python' ? 'generate_response' : 'generateResponse',
    className: 'PromptClient',
    includeTypes: true,
    includeDocstrings: true,
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000,
  };
}
