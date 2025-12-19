import { PromptConfig, SDKGenerationOptions, GeneratedSDK, PromptVariable } from '@/types';

function toPythonType(type: PromptVariable['type']): string {
  switch (type) {
    case 'string':
      return 'str';
    case 'number':
      return 'float';
    case 'boolean':
      return 'bool';
    case 'array':
      return 'List[Any]';
    case 'object':
      return 'Dict[str, Any]';
    default:
      return 'Any';
  }
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/[^a-z0-9_]/g, '_');
}

function escapeString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function generateImports(options: SDKGenerationOptions): string {
  const imports: string[] = [
    'import os',
    'from typing import Dict, List, Any, Optional, TypedDict',
  ];

  if (options.asyncMode) {
    imports.push('import asyncio');
    imports.push('import aiohttp');
  } else {
    imports.push('import requests');
  }

  if (options.includeRetryLogic) {
    imports.push('import time');
    imports.push('from functools import wraps');
  }

  imports.push('from dataclasses import dataclass');
  imports.push('import json');

  return imports.join('\n');
}

function generateExceptionClasses(): string {
  return `
class PromptStudioError(Exception):
    """Base exception for PromptStudio SDK."""
    pass


class APIError(PromptStudioError):
    """Raised when the API returns an error."""
    def __init__(self, message: str, status_code: int = None, response: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class RateLimitError(PromptStudioError):
    """Raised when rate limit is exceeded."""
    def __init__(self, message: str, retry_after: int = None):
        super().__init__(message)
        self.retry_after = retry_after


class ValidationError(PromptStudioError):
    """Raised when input validation fails."""
    pass


class TimeoutError(PromptStudioError):
    """Raised when a request times out."""
    pass
`;
}

function generateRetryDecorator(options: SDKGenerationOptions): string {
  if (!options.includeRetryLogic) return '';

  if (options.asyncMode) {
    return `
def async_retry(max_attempts: int = ${options.retryAttempts}, delay: float = ${options.retryDelay / 1000}):
    """Decorator for async retry logic with exponential backoff."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except (RateLimitError, APIError) as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        wait_time = delay * (2 ** attempt)
                        if isinstance(e, RateLimitError) and e.retry_after:
                            wait_time = e.retry_after
                        await asyncio.sleep(wait_time)
            raise last_exception
        return wrapper
    return decorator
`;
  } else {
    return `
def retry(max_attempts: int = ${options.retryAttempts}, delay: float = ${options.retryDelay / 1000}):
    """Decorator for retry logic with exponential backoff."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except (RateLimitError, APIError) as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        wait_time = delay * (2 ** attempt)
                        if isinstance(e, RateLimitError) and e.retry_after:
                            wait_time = e.retry_after
                        time.sleep(wait_time)
            raise last_exception
        return wrapper
    return decorator
`;
  }
}

function generateTypedDicts(config: PromptConfig): string {
  const variables = config.variables;
  if (variables.length === 0) return '';

  const fields = variables
    .map((v) => {
      const pythonType = toPythonType(v.type);
      const optionalPrefix = v.required ? '' : 'Optional[';
      const optionalSuffix = v.required ? '' : ']';
      return `    ${toSnakeCase(v.name)}: ${optionalPrefix}${pythonType}${optionalSuffix}  # ${v.description}`;
    })
    .join('\n');

  return `
class PromptVariables(TypedDict, total=False):
    """Type definition for prompt variables."""
${fields}
`;
}

function generateResponseClass(): string {
  return `
@dataclass
class PromptResponse:
    """Response from the prompt execution."""
    content: str
    model: str
    usage: Dict[str, int]
    finish_reason: str
    latency_ms: float

    @classmethod
    def from_dict(cls, data: dict, latency_ms: float = 0) -> "PromptResponse":
        return cls(
            content=data.get("choices", [{}])[0].get("message", {}).get("content", ""),
            model=data.get("model", ""),
            usage=data.get("usage", {}),
            finish_reason=data.get("choices", [{}])[0].get("finish_reason", ""),
            latency_ms=latency_ms,
        )
`;
}

function generateClientClass(config: PromptConfig, options: SDKGenerationOptions): string {
  const className = options.className;
  const functionName = toSnakeCase(options.functionName);
  const hasVariables = config.variables.length > 0;

  const variableParams = hasVariables
    ? config.variables
        .map((v) => {
          const pythonType = toPythonType(v.type);
          const defaultValue = v.required ? '' : ` = ${v.defaultValue !== undefined ? JSON.stringify(v.defaultValue) : 'None'}`;
          return `        ${toSnakeCase(v.name)}: ${v.required ? pythonType : `Optional[${pythonType}]`}${defaultValue}`;
        })
        .join(',\n')
    : '';

  const variablesDictEntries = hasVariables
    ? config.variables
        .map((v) => `            "${v.name}": ${toSnakeCase(v.name)}`)
        .join(',\n')
    : '';

  const promptTemplate = escapeString(config.prompt);

  const retryDecoratorUsage = options.includeRetryLogic
    ? options.asyncMode
      ? '    @async_retry()\n'
      : '    @retry()\n'
    : '';

  if (options.asyncMode) {
    return `
class ${className}:
    """
    ${config.description || 'PromptStudio SDK Client'}

    This client provides access to the "${config.name}" prompt.

    Usage:
        async with ${className}(api_key="your-api-key") as client:
            response = await client.${functionName}(...)
    """

    DEFAULT_BASE_URL = "https://api.openai.com/v1"
    DEFAULT_MODEL = "${config.model}"

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: int = ${options.timeout / 1000},
    ):
        """
        Initialize the ${className}.

        Args:
            api_key: API key for authentication. Defaults to OPENAI_API_KEY env variable.
            base_url: Base URL for the API. Defaults to OpenAI API.
            timeout: Request timeout in seconds.
        """
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise ValidationError("API key is required. Set OPENAI_API_KEY or pass api_key parameter.")

        self.base_url = base_url or self.DEFAULT_BASE_URL
        self.timeout = timeout
        self._session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._session:
            await self._session.close()

    def _build_prompt(self, variables: Dict[str, Any]) -> str:
        """Build the prompt with variable substitution."""
        prompt = """${promptTemplate}"""
        for key, value in variables.items():
            prompt = prompt.replace("{{" + key + "}}", str(value))
        return prompt

${retryDecoratorUsage}    async def ${functionName}(
        self,
${variableParams}${hasVariables ? ',\n' : ''}        **kwargs
    ) -> PromptResponse:
        """
        Execute the prompt and get a response.

        Args:
${config.variables.map((v) => `            ${toSnakeCase(v.name)}: ${v.description}`).join('\n')}
            **kwargs: Additional parameters to pass to the API.

        Returns:
            PromptResponse: The response from the model.

        Raises:
            APIError: If the API returns an error.
            RateLimitError: If rate limit is exceeded.
            TimeoutError: If the request times out.
        """
        variables = {
${variablesDictEntries}
        }

        # Remove None values
        variables = {k: v for k, v in variables.items() if v is not None}

        prompt = self._build_prompt(variables)

        payload = {
            "model": kwargs.get("model", self.DEFAULT_MODEL),
            "messages": [{"role": "user", "content": prompt}],
            "temperature": kwargs.get("temperature", ${config.temperature}),
            "max_tokens": kwargs.get("max_tokens", ${config.maxTokens}),
            "top_p": kwargs.get("top_p", ${config.topP}),
            "frequency_penalty": kwargs.get("frequency_penalty", ${config.frequencyPenalty}),
            "presence_penalty": kwargs.get("presence_penalty", ${config.presencePenalty}),
        }

        ${config.stopSequences.length > 0 ? `if "stop" not in kwargs:\n            payload["stop"] = ${JSON.stringify(config.stopSequences)}` : ''}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        if not self._session:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.timeout)
            )

        import time
        start_time = time.time()

        try:
            async with self._session.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                latency_ms = (time.time() - start_time) * 1000

                if response.status == 429:
                    retry_after = response.headers.get("Retry-After")
                    raise RateLimitError(
                        "Rate limit exceeded",
                        retry_after=int(retry_after) if retry_after else None,
                    )

                data = await response.json()

                if response.status != 200:
                    raise APIError(
                        data.get("error", {}).get("message", "Unknown error"),
                        status_code=response.status,
                        response=data,
                    )

                return PromptResponse.from_dict(data, latency_ms)

        except asyncio.TimeoutError:
            raise TimeoutError(f"Request timed out after {self.timeout} seconds")

    async def stream_${functionName}(
        self,
${variableParams}${hasVariables ? ',\n' : ''}        **kwargs
    ):
        """
        Stream the response from the prompt execution.

        Yields:
            str: Chunks of the response content.
        """
        variables = {
${variablesDictEntries}
        }

        variables = {k: v for k, v in variables.items() if v is not None}
        prompt = self._build_prompt(variables)

        payload = {
            "model": kwargs.get("model", self.DEFAULT_MODEL),
            "messages": [{"role": "user", "content": prompt}],
            "temperature": kwargs.get("temperature", ${config.temperature}),
            "max_tokens": kwargs.get("max_tokens", ${config.maxTokens}),
            "stream": True,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        if not self._session:
            self._session = aiohttp.ClientSession()

        async with self._session.post(
            f"{self.base_url}/chat/completions",
            json=payload,
            headers=headers,
        ) as response:
            async for line in response.content:
                line = line.decode("utf-8").strip()
                if line.startswith("data: ") and line != "data: [DONE]":
                    try:
                        data = json.loads(line[6:])
                        content = data.get("choices", [{}])[0].get("delta", {}).get("content")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue
`;
  } else {
    // Sync version
    return `
class ${className}:
    """
    ${config.description || 'PromptStudio SDK Client'}

    This client provides access to the "${config.name}" prompt.

    Usage:
        client = ${className}(api_key="your-api-key")
        response = client.${functionName}(...)
    """

    DEFAULT_BASE_URL = "https://api.openai.com/v1"
    DEFAULT_MODEL = "${config.model}"

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: int = ${options.timeout / 1000},
    ):
        """
        Initialize the ${className}.

        Args:
            api_key: API key for authentication. Defaults to OPENAI_API_KEY env variable.
            base_url: Base URL for the API. Defaults to OpenAI API.
            timeout: Request timeout in seconds.
        """
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise ValidationError("API key is required. Set OPENAI_API_KEY or pass api_key parameter.")

        self.base_url = base_url or self.DEFAULT_BASE_URL
        self.timeout = timeout
        self._session = requests.Session()

    def _build_prompt(self, variables: Dict[str, Any]) -> str:
        """Build the prompt with variable substitution."""
        prompt = """${promptTemplate}"""
        for key, value in variables.items():
            prompt = prompt.replace("{{" + key + "}}", str(value))
        return prompt

${retryDecoratorUsage}    def ${functionName}(
        self,
${variableParams}${hasVariables ? ',\n' : ''}        **kwargs
    ) -> PromptResponse:
        """
        Execute the prompt and get a response.

        Args:
${config.variables.map((v) => `            ${toSnakeCase(v.name)}: ${v.description}`).join('\n')}
            **kwargs: Additional parameters to pass to the API.

        Returns:
            PromptResponse: The response from the model.

        Raises:
            APIError: If the API returns an error.
            RateLimitError: If rate limit is exceeded.
            TimeoutError: If the request times out.
        """
        variables = {
${variablesDictEntries}
        }

        # Remove None values
        variables = {k: v for k, v in variables.items() if v is not None}

        prompt = self._build_prompt(variables)

        payload = {
            "model": kwargs.get("model", self.DEFAULT_MODEL),
            "messages": [{"role": "user", "content": prompt}],
            "temperature": kwargs.get("temperature", ${config.temperature}),
            "max_tokens": kwargs.get("max_tokens", ${config.maxTokens}),
            "top_p": kwargs.get("top_p", ${config.topP}),
            "frequency_penalty": kwargs.get("frequency_penalty", ${config.frequencyPenalty}),
            "presence_penalty": kwargs.get("presence_penalty", ${config.presencePenalty}),
        }

        ${config.stopSequences.length > 0 ? `if "stop" not in kwargs:\n            payload["stop"] = ${JSON.stringify(config.stopSequences)}` : ''}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        import time
        start_time = time.time()

        try:
            response = self._session.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                headers=headers,
                timeout=self.timeout,
            )
            latency_ms = (time.time() - start_time) * 1000

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                raise RateLimitError(
                    "Rate limit exceeded",
                    retry_after=int(retry_after) if retry_after else None,
                )

            data = response.json()

            if response.status_code != 200:
                raise APIError(
                    data.get("error", {}).get("message", "Unknown error"),
                    status_code=response.status_code,
                    response=data,
                )

            return PromptResponse.from_dict(data, latency_ms)

        except requests.Timeout:
            raise TimeoutError(f"Request timed out after {self.timeout} seconds")
`;
  }
}

function generateUsageExample(config: PromptConfig, options: SDKGenerationOptions): string {
  const className = options.className;
  const functionName = toSnakeCase(options.functionName);
  const hasVariables = config.variables.length > 0;

  const exampleArgs = hasVariables
    ? config.variables
        .filter((v) => v.required)
        .map((v) => `${toSnakeCase(v.name)}="example_value"`)
        .join(', ')
    : '';

  if (options.asyncMode) {
    return `

# Usage Example
if __name__ == "__main__":
    async def main():
        async with ${className}() as client:
            response = await client.${functionName}(${exampleArgs})
            print(f"Response: {response.content}")
            print(f"Latency: {response.latency_ms:.2f}ms")
            print(f"Tokens used: {response.usage}")

    asyncio.run(main())
`;
  } else {
    return `

# Usage Example
if __name__ == "__main__":
    client = ${className}()
    response = client.${functionName}(${exampleArgs})
    print(f"Response: {response.content}")
    print(f"Latency: {response.latency_ms:.2f}ms")
    print(f"Tokens used: {response.usage}")
`;
  }
}

export function generatePythonSDK(
  config: PromptConfig,
  options: SDKGenerationOptions
): GeneratedSDK {
  const sections: string[] = [
    '"""',
    `PromptStudio SDK - ${config.name}`,
    '',
    `${config.description || 'Auto-generated SDK for prompt execution.'}`,
    '',
    'Generated by PromptStudio',
    '"""',
    '',
    generateImports(options),
  ];

  if (options.includeErrorHandling) {
    sections.push(generateExceptionClasses());
  }

  if (options.includeRetryLogic) {
    sections.push(generateRetryDecorator(options));
  }

  if (options.includeTypes) {
    sections.push(generateTypedDicts(config));
  }

  sections.push(generateResponseClass());
  sections.push(generateClientClass(config, options));

  if (options.includeDocstrings) {
    sections.push(generateUsageExample(config, options));
  }

  const code = sections.join('\n');

  const dependencies = options.asyncMode
    ? ['aiohttp>=3.8.0']
    : ['requests>=2.28.0'];

  const filename = `${toSnakeCase(config.name)}_client.py`;

  return {
    language: 'python',
    code,
    filename,
    dependencies,
  };
}
