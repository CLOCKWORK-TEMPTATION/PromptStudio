import { PromptConfig, SDKGenerationOptions, GeneratedSDK } from '@/types';
import { renderTemplate } from './template-util';

const pythonTemplate = `"""
Auto-generated SDK for PromptStudio
"""
import requests

def {{functionName}}(input: str, api_key: str) -> str:
    url = "https://api.promptstudio.ai/v1/execute"
    headers = {"Authorization": f"Bearer {api_key}"}
    data = {"prompt": input}
    response = requests.post(url, json=data, headers=headers)
    response.raise_for_status()
    return response.json().get("result", "")
`;

export function generatePythonSDKTemplate(promptConfig: PromptConfig, options: SDKGenerationOptions): GeneratedSDK {
  const code = renderTemplate(pythonTemplate, {
    functionName: options.functionName || 'generate_response',
  });
  return {
    language: 'python',
    code,
    filename: `${options.functionName || 'generate_response'}.py`,
    dependencies: ['requests'],
  };
}
