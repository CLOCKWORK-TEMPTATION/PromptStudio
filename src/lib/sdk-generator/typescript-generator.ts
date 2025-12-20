import { PromptConfig, SDKGenerationOptions, GeneratedSDK, PromptVariable } from '@/types';

function toTypeScriptType(type: PromptVariable['type']): string {
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'unknown[]';
    case 'object':
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[A-Z]/, (chr) => chr.toLowerCase());
}

function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function escapeString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function generateTypes(config: PromptConfig, options: SDKGenerationOptions): string {
  const hasVariables = config.variables.length > 0;

  let types = `
/**
 * Configuration options for the SDK client.
 */
export interface ${options.className}Config {
  /** API key for authentication. Defaults to OPENAI_API_KEY env variable. */
  apiKey?: string;
  /** Base URL for the API. Defaults to OpenAI API. */
  baseUrl?: string;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

/**
 * Response from the prompt execution.
 */
export interface PromptResponse {
  /** The generated content. */
  content: string;
  /** The model used for generation. */
  model: string;
  /** Token usage statistics. */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Reason for completion. */
  finishReason: string;
  /** Request latency in milliseconds. */
  latencyMs: number;
}
`;

  if (hasVariables) {
    const variableTypes = config.variables
      .map((v) => {
        const tsType = toTypeScriptType(v.type);
        const optional = v.required ? '' : '?';
        return `  /** ${v.description} */\n  ${toCamelCase(v.name)}${optional}: ${tsType};`;
      })
      .join('\n');

    types += `
/**
 * Variables for the prompt template.
 */
export interface PromptVariables {
${variableTypes}
}
`;
  }

  types += `
/**
 * Additional options for prompt execution.
 */
export interface ExecutionOptions {
  /** Override the default model. */
  model?: string;
  /** Override the default temperature. */
  temperature?: number;
  /** Override the default max tokens. */
  maxTokens?: number;
  /** Override the default top_p. */
  topP?: number;
  /** Override frequency penalty. */
  frequencyPenalty?: number;
  /** Override presence penalty. */
  presencePenalty?: number;
  /** Custom stop sequences. */
  stop?: string[];
  /** Abort signal for request cancellation. */
  signal?: AbortSignal;
}
`;

  return types;
}

function generateErrorClasses(): string {
  return `
/**
 * Base error class for PromptStudio SDK.
 */
export class PromptStudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromptStudioError';
  }
}

/**
 * Error thrown when the API returns an error response.
 */
export class APIError extends PromptStudioError {
  statusCode?: number;
  response?: Record<string, unknown>;

  constructor(message: string, statusCode?: number, response?: Record<string, unknown>) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * Error thrown when rate limit is exceeded.
 */
export class RateLimitError extends PromptStudioError {
  retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown when input validation fails.
 */
export class ValidationError extends PromptStudioError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when a request times out.
 */
export class TimeoutError extends PromptStudioError {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
`;
}

function generateRetryHelper(options: SDKGenerationOptions): string {
  if (!options.includeRetryLogic) return '';

  return `
/**
 * Retry helper with exponential backoff.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = ${options.retryAttempts},
  baseDelay: number = ${options.retryDelay}
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (error instanceof RateLimitError || error instanceof APIError) {
        if (attempt < maxAttempts - 1) {
          let delay = baseDelay * Math.pow(2, attempt);

          if (error instanceof RateLimitError && error.retryAfter) {
            delay = error.retryAfter * 1000;
          }

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      throw error;
    }
  }

  throw lastError;
}
`;
}

function generateClientClass(config: PromptConfig, options: SDKGenerationOptions): string {
  const className = options.className;
  const functionName = toCamelCase(options.functionName);
  const hasVariables = config.variables.length > 0;

  const promptTemplate = escapeString(config.prompt);

  const variableParams = hasVariables
    ? 'variables: PromptVariables, '
    : '';

  const variablesDictEntries = hasVariables
    ? config.variables
        .map((v) => `      '${v.name}': variables.${toCamelCase(v.name)}`)
        .join(',\n')
    : '';

  const retryWrapper = options.includeRetryLogic
    ? (code: string) => `withRetry(async () => {\n${code}\n    })`
    : (code: string) => `(async () => {\n${code}\n    })()`;

  const asyncKeyword = options.asyncMode ? 'async ' : '';
  const awaitKeyword = options.asyncMode ? 'await ' : '';

  return `
/**
 * ${config.description || 'PromptStudio SDK Client'}
 *
 * This client provides access to the "${config.name}" prompt.
 *
 * @example
 * \`\`\`typescript
 * const client = new ${className}({ apiKey: 'your-api-key' });
 * const response = await client.${functionName}(${hasVariables ? '{ ... }' : ''});
 * console.log(response.content);
 * \`\`\`
 */
export class ${className} {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  private static readonly DEFAULT_BASE_URL = 'https://api.openai.com/v1';
  private static readonly DEFAULT_MODEL = '${config.model}';
  private static readonly PROMPT_TEMPLATE = \`${promptTemplate}\`;

  /**
   * Creates a new ${className} instance.
   *
   * @param config - Configuration options for the client.
   */
  constructor(config: ${className}Config = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';

    if (!this.apiKey) {
      throw new ValidationError(
        'API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in config.'
      );
    }

    this.baseUrl = config.baseUrl || ${className}.DEFAULT_BASE_URL;
    this.timeout = config.timeout || ${options.timeout};
  }

  /**
   * Builds the prompt with variable substitution.
   */
  private buildPrompt(variables: Record<string, unknown>): string {
    let prompt = ${className}.PROMPT_TEMPLATE;

    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(\`{{\\s*\${key}\\s*}}\`, 'g'), String(value));
    }

    return prompt;
  }

  /**
   * Parses the API response into a PromptResponse object.
   */
  private parseResponse(data: Record<string, unknown>, latencyMs: number): PromptResponse {
    const choices = data.choices as Array<Record<string, unknown>> || [];
    const firstChoice = choices[0] || {};
    const message = firstChoice.message as Record<string, unknown> || {};
    const usage = data.usage as Record<string, number> || {};

    return {
      content: (message.content as string) || '',
      model: (data.model as string) || '',
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      },
      finishReason: (firstChoice.finish_reason as string) || '',
      latencyMs,
    };
  }

  /**
   * Executes the prompt and returns the response.
   *
   * @param ${hasVariables ? 'variables - The variables to substitute in the prompt.' : ''}
   * @param options - Additional execution options.
   * @returns The response from the model.
   * @throws {APIError} If the API returns an error.
   * @throws {RateLimitError} If rate limit is exceeded.
   * @throws {TimeoutError} If the request times out.
   */
  ${asyncKeyword}${functionName}(${variableParams}options: ExecutionOptions = {}): Promise<PromptResponse> {
    const variablesMap: Record<string, unknown> = {
${variablesDictEntries}
    };

    // Remove undefined values
    const cleanVariables = Object.fromEntries(
      Object.entries(variablesMap).filter(([, v]) => v !== undefined)
    );

    const prompt = this.buildPrompt(cleanVariables);

    const payload = {
      model: options.model || ${className}.DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? ${config.temperature},
      max_tokens: options.maxTokens ?? ${config.maxTokens},
      top_p: options.topP ?? ${config.topP},
      frequency_penalty: options.frequencyPenalty ?? ${config.frequencyPenalty},
      presence_penalty: options.presencePenalty ?? ${config.presencePenalty},
      ${config.stopSequences.length > 0 ? `stop: options.stop || ${JSON.stringify(config.stopSequences)},` : ''}
    };

    return ${retryWrapper(`
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
      }

      const startTime = performance.now();

      try {
        const response = ${awaitKeyword}fetch(\`\${this.baseUrl}/chat/completions\`, {
          method: 'POST',
          headers: {
            'Authorization': \`Bearer \${this.apiKey}\`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const latencyMs = performance.now() - startTime;

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new RateLimitError(
            'Rate limit exceeded',
            retryAfter ? parseInt(retryAfter, 10) : undefined
          );
        }

        const data = ${awaitKeyword}response.json();

        if (!response.ok) {
          const error = (data as Record<string, unknown>).error as Record<string, unknown> || {};
          throw new APIError(
            (error.message as string) || 'Unknown error',
            response.status,
            data as Record<string, unknown>
          );
        }

        return this.parseResponse(data as Record<string, unknown>, latencyMs);
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          throw new TimeoutError(\`Request timed out after \${this.timeout}ms\`);
        }

        throw error;
      }
    `)};
  }

  /**
   * Streams the response from the prompt execution.
   *
   * @param ${hasVariables ? 'variables - The variables to substitute in the prompt.' : ''}
   * @param options - Additional execution options.
   * @yields Chunks of the response content.
   */
  async *stream${toPascalCase(options.functionName)}(
    ${variableParams}options: ExecutionOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const variablesMap: Record<string, unknown> = {
${variablesDictEntries}
    };

    const cleanVariables = Object.fromEntries(
      Object.entries(variablesMap).filter(([, v]) => v !== undefined)
    );

    const prompt = this.buildPrompt(cleanVariables);

    const payload = {
      model: options.model || ${className}.DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? ${config.temperature},
      max_tokens: options.maxTokens ?? ${config.maxTokens},
      stream: true,
    };

    const response = await fetch(\`\${this.baseUrl}/chat/completions\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${this.apiKey}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    });

    if (!response.ok) {
      throw new APIError('Stream request failed', response.status);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new APIError('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Ignore JSON parse errors in stream
          }
        }
      }
    }
  }
}
`;
}

function generateUsageExample(config: PromptConfig, options: SDKGenerationOptions): string {
  const className = options.className;
  const functionName = toCamelCase(options.functionName);
  const hasVariables = config.variables.length > 0;

  const exampleVars = hasVariables
    ? `{\n${config.variables
        .filter((v) => v.required)
        .map((v) => `    ${toCamelCase(v.name)}: 'example_value'`)
        .join(',\n')}\n  }`
    : '';

  return `

// ============================================================
// Usage Examples
// ============================================================

/*
// Basic usage
const client = new ${className}({
  apiKey: 'your-openai-api-key',
});

const response = await client.${functionName}(${exampleVars});
console.log('Response:', response.content);
console.log('Latency:', response.latencyMs, 'ms');
console.log('Tokens used:', response.usage.totalTokens);

// Streaming usage
for await (const chunk of client.stream${toPascalCase(options.functionName)}(${exampleVars})) {
  process.stdout.write(chunk);
}

// With custom options
const customResponse = await client.${functionName}(${exampleVars}${hasVariables ? ', ' : ''}{
  temperature: 0.8,
  maxTokens: 500,
});
*/

export default ${className};
`;
}

export function generateTypeScriptSDK(
  config: PromptConfig,
  options: SDKGenerationOptions
): GeneratedSDK {
  const sections: string[] = [
    '/**',
    ` * PromptStudio SDK - ${config.name}`,
    ' *',
    ` * ${config.description || 'Auto-generated SDK for prompt execution.'}`,
    ' *',
    ' * Generated by PromptStudio',
    ' */',
    '',
  ];

  if (options.includeTypes) {
    sections.push(generateTypes(config, options));
  }

  if (options.includeErrorHandling) {
    sections.push(generateErrorClasses());
  }

  if (options.includeRetryLogic) {
    sections.push(generateRetryHelper(options));
  }

  sections.push(generateClientClass(config, options));

  if (options.includeDocstrings) {
    sections.push(generateUsageExample(config, options));
  }

  const code = sections.join('\n');

  const filename = `${toCamelCase(config.name)}Client.ts`;

  return {
    language: 'typescript',
    code,
    types: options.includeTypes ? generateTypes(config, options) : undefined,
    filename,
    dependencies: [],
  };
}
