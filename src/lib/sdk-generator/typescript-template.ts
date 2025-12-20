import { PromptConfig, SDKGenerationOptions, GeneratedSDK } from '@/types';
import { renderTemplate } from './template-util';

const tsTemplate = `/**
 * Auto-generated SDK for PromptStudio
 */
import axios from 'axios';

export async function {{functionName}}(input: string, apiKey: string): Promise<string> {
  const url = 'https://api.promptstudio.ai/v1/execute';
  const headers = { Authorization: `Bearer ${apiKey}` };
  const data = { prompt: input };
  const response = await axios.post(url, data, { headers });
  return response.data.result || '';
}
`;

export function generateTypeScriptSDKTemplate(promptConfig: PromptConfig, options: SDKGenerationOptions): GeneratedSDK {
  const code = renderTemplate(tsTemplate, {
    functionName: options.functionName || 'generateResponse',
  });
  return {
    language: 'typescript',
    code,
    filename: `${options.functionName || 'generateResponse'}.ts`,
    dependencies: ['axios'],
  };
}
