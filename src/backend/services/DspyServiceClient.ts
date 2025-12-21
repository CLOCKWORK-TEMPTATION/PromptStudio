// ============================================================
// DSPy Service Client - Epic 1.3
// TypeScript client for Python DSPy FastAPI service
// ============================================================

import type {
  DSPyCompileRequest,
  DSPyCompileResponse,
  OptimizerType,
  MetricType,
  OptimizationBudget,
} from '../../shared/types/dspy';

interface DspyServiceConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

const DEFAULT_CONFIG: DspyServiceConfig = {
  baseUrl: process.env.DSPY_SERVICE_URL || 'http://localhost:8000',
  timeout: 300000, // 5 minutes for long-running compilations
  maxRetries: 3,
  retryDelay: 1000,
};

export class DspyServiceClient {
  private config: DspyServiceConfig;

  constructor(config?: Partial<DspyServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if DSPy service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/health`,
        {
          method: 'GET',
        },
        10000 // 10 second timeout for health check
      );

      return response.ok;
    } catch (error) {
      console.error('DSPy service health check failed:', error);
      return false;
    }
  }

  /**
   * Compile/optimize a prompt using DSPy
   */
  async compile(request: DSPyCompileRequest): Promise<DSPyCompileResponse> {
    const url = `${this.config.baseUrl}/compile`;

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`DSPy compile failed: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();
    return result as DSPyCompileResponse;
  }

  /**
   * Helper: Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout?: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      timeout || this.config.timeout
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Helper: Fetch with retry logic
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, options);

        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          return response;
        }

        // Retry on server errors (5xx)
        if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }

        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on abort (timeout)
        if ((error as Error).name === 'AbortError') {
          throw new Error('Request timed out');
        }

        // Wait before retrying
        if (attempt < this.config.maxRetries - 1) {
          await this.sleep(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Helper: Sleep for ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a mock DSPy client for testing/development
 */
export class MockDspyServiceClient extends DspyServiceClient {
  async healthCheck(): Promise<boolean> {
    return true;
  }

  async compile(request: DSPyCompileRequest): Promise<DSPyCompileResponse> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate mock optimized prompt
    const optimizedSystem = request.basePromptSnapshot.system +
      '\n\n[Optimized by DSPy - Mock]';

    return {
      optimizedPromptSnapshot: {
        system: optimizedSystem,
        developer: request.basePromptSnapshot.developer,
        demos: request.optimizer.type === 'bootstrap_fewshot'
          ? [
              { input: 'Example input 1', output: 'Example output 1' },
              { input: 'Example input 2', output: 'Example output 2' },
            ]
          : undefined,
      },
      dspyArtifactJson: JSON.stringify({
        optimizer: request.optimizer.type,
        iterations: 10,
        finalPrompt: optimizedSystem,
      }),
      baselineScore: 0.65,
      optimizedScore: 0.82,
      delta: 0.17,
      cost: {
        calls: 25,
        tokens: 15000,
        usdEstimate: 0.45,
      },
      diagnostics: {
        topFailureCases: [],
      },
    };
  }
}

/**
 * Factory function to get the appropriate client
 */
export function getDspyClient(): DspyServiceClient {
  if (process.env.USE_MOCK_DSPY === 'true') {
    return new MockDspyServiceClient();
  }
  return new DspyServiceClient();
}

export default DspyServiceClient;
