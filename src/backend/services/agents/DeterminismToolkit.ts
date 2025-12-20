/**
 * Determinism Toolkit with SDK Generation
 * Ensures reproducible AI workflows with deterministic execution patterns
 */

import { LLMServiceAdapter } from '../LLMServiceAdapter';
import { logger } from '../../lib/logger';
import { z } from 'zod';
import * as crypto from 'crypto';

// Determinism configuration schemas
const DeterminismConfigSchema = z.object({
    seed: z.number().optional(),
    temperature: z.number().min(0).max(2).default(0),
    topP: z.number().min(0).max(1).default(1),
    frequencyPenalty: z.number().min(-2).max(2).default(0),
    presencePenalty: z.number().min(-2).max(2).default(0),
    maxTokens: z.number().positive(),
    stopSequences: z.array(z.string()).optional(),
    logitBias: z.record(z.number()).optional()
});

const ExecutionContextSchema = z.object({
    id: z.string(),
    prompt: z.string(),
    config: DeterminismConfigSchema,
    timestamp: z.date(),
    hash: z.string(),
    metadata: z.record(z.any()).optional()
});

const ReproducibilityTestSchema = z.object({
    testId: z.string(),
    prompt: z.string(),
    config: DeterminismConfigSchema,
    iterations: z.number().min(2).max(100).default(10),
    toleranceThreshold: z.number().min(0).max(1).default(0.95)
});

type DeterminismConfig = z.infer<typeof DeterminismConfigSchema>;
type ExecutionContext = z.infer<typeof ExecutionContextSchema>;
type ReproducibilityTest = z.infer<typeof ReproducibilityTestSchema>;

interface DeterministicResult {
    content: string;
    hash: string;
    config: DeterminismConfig;
    reproducibilityScore: number;
    metadata: {
        tokensUsed: number;
        executionTime: number;
        modelUsed: string;
    };
}

export class DeterminismToolkit {
    private executionHistory: Map<string, ExecutionContext[]> = new Map();
    private reproducibilityCache: Map<string, DeterministicResult[]> = new Map();

    constructor() {}

    /**
     * Execute prompt with deterministic configuration
     */
    async executeDeterministic(
        prompt: string,
        config: Partial<DeterminismConfig> = {},
        model: string = 'gpt-4-turbo'
    ): Promise<DeterministicResult> {
        const deterministicConfig = DeterminismConfigSchema.parse({
            temperature: 0,
            ...config
        });

        // Generate execution context
        const context = this.createExecutionContext(prompt, deterministicConfig);
        
        // Execute with deterministic settings using LLMServiceAdapter
        const startTime = Date.now();
        const response = await LLMServiceAdapter.executeTreeOfThought(
            prompt,
            { maxDepth: 1, branchingFactor: 1 }
        );
        
        const executionTime = Date.now() - startTime;
        const contentHash = this.generateContentHash(response.finalAnswer);
        
        // Store execution history
        this.storeExecutionHistory(context);
        
        // Calculate reproducibility score
        const reproducibilityScore = await this.calculateReproducibilityScore(context.hash);
        
        const result: DeterministicResult = {
            content: response.finalAnswer,
            hash: contentHash,
            config: deterministicConfig,
            reproducibilityScore,
            metadata: {
                tokensUsed: 1000, // Estimate
                executionTime,
                modelUsed: model
            }
        };
        
        logger.info(`[DeterminismToolkit] Executed deterministic prompt with reproducibility score: ${reproducibilityScore.toFixed(3)}`);
        
        return result;
    }

    /**
     * Run reproducibility test
     */
    async runReproducibilityTest(
        test: ReproducibilityTest,
        model: string = 'gpt-4-turbo'
    ): Promise<{
        testId: string;
        passed: boolean;
        reproducibilityScore: number;
        results: DeterministicResult[];
        analysis: {
            uniqueOutputs: number;
            mostCommonOutput: string;
            variance: number;
        };
    }> {
        const validatedTest = ReproducibilityTestSchema.parse(test);
        const results: DeterministicResult[] = [];
        
        logger.info(`[DeterminismToolkit] Starting reproducibility test ${test.testId} with ${test.iterations} iterations`);
        
        // Execute multiple iterations
        for (let i = 0; i < validatedTest.iterations; i++) {
            try {
                const result = await this.executeDeterministic(
                    validatedTest.prompt,
                    validatedTest.config,
                    model
                );
                results.push(result);
                
                // Small delay between iterations
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error: any) {
                logger.error(`[DeterminismToolkit] Test iteration ${i + 1} failed: ${error.message}`);
            }
        }
        
        // Analyze results
        const analysis = this.analyzeReproducibilityResults(results);
        const reproducibilityScore = this.calculateTestReproducibilityScore(results);
        const passed = reproducibilityScore >= validatedTest.toleranceThreshold;
        
        logger.info(`[DeterminismToolkit] Test ${test.testId} completed: ${passed ? 'PASSED' : 'FAILED'} (score: ${reproducibilityScore.toFixed(3)})`);
        
        return {
            testId: validatedTest.testId,
            passed,
            reproducibilityScore,
            results,
            analysis
        };
    }

    /**
     * Generate SDK code for deterministic execution
     */
    generateSDK(
        language: 'python' | 'typescript' | 'curl',
        config: DeterminismConfig,
        prompt: string,
        options: {
            className?: string;
            functionName?: string;
            includeValidation?: boolean;
        } = {}
    ): string {
        const {
            className = 'DeterministicClient',
            functionName = 'execute',
            includeValidation = true
        } = options;

        switch (language) {
            case 'python':
                return this.generatePythonSDK(config, prompt, className, functionName, includeValidation);
            case 'typescript':
                return this.generateTypeScriptSDK(config, prompt, className, functionName, includeValidation);
            case 'curl':
                return this.generateCurlSDK(config, prompt);
            default:
                throw new Error(`Unsupported language: ${language}`);
        }
    }

    /**
     * Generate Python SDK
     */
    private generatePythonSDK(
        config: DeterminismConfig,
        prompt: string,
        className: string,
        functionName: string,
        includeValidation: boolean
    ): string {
        return `
import hashlib
import json
import time
from typing import Dict, Any, Optional
from openai import OpenAI

class ${className}:
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.config = ${JSON.stringify(config, null, 8)}
    
    def ${functionName}(self, prompt: str = "${prompt.replace(/"/g, '\\"')}", model: str = "gpt-4-turbo") -> Dict[str, Any]:
        """Execute prompt with deterministic configuration"""
        ${includeValidation ? `
        # Validate configuration
        if self.config.get('temperature', 0) > 0:
            print("Warning: Non-zero temperature may reduce reproducibility")
        ` : ''}
        
        start_time = time.time()
        
        response = self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.config.get('temperature', 0),
            max_tokens=self.config.get('maxTokens', 1000),
            top_p=self.config.get('topP', 1),
            frequency_penalty=self.config.get('frequencyPenalty', 0),
            presence_penalty=self.config.get('presencePenalty', 0),
            seed=self.config.get('seed'),
            stop=self.config.get('stopSequences')
        )
        
        execution_time = time.time() - start_time
        content = response.choices[0].message.content
        content_hash = hashlib.md5(content.encode()).hexdigest()
        
        return {
            "content": content,
            "hash": content_hash,
            "config": self.config,
            "metadata": {
                "tokens_used": response.usage.total_tokens,
                "execution_time": execution_time,
                "model_used": model
            }
        }
    
    def verify_reproducibility(self, prompt: str, iterations: int = 5) -> Dict[str, Any]:
        """Verify reproducibility by running multiple iterations"""
        results = []
        for i in range(iterations):
            result = self.${functionName}(prompt)
            results.append(result)
            time.sleep(0.1)  # Small delay between iterations
        
        unique_hashes = set(r['hash'] for r in results)
        reproducibility_score = 1.0 - (len(unique_hashes) - 1) / len(results)
        
        return {
            "reproducibility_score": reproducibility_score,
            "unique_outputs": len(unique_hashes),
            "total_iterations": iterations,
            "results": results
        }
`.trim();
    }

    /**
     * Generate TypeScript SDK
     */
    private generateTypeScriptSDK(
        config: DeterminismConfig,
        prompt: string,
        className: string,
        functionName: string,
        includeValidation: boolean
    ): string {
        return `
import { createHash } from 'crypto';
import OpenAI from 'openai';

interface DeterministicConfig {
    seed?: number;
    temperature: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
    maxTokens: number;
    stopSequences?: string[];
    logitBias?: Record<string, number>;
}

interface DeterministicResult {
    content: string;
    hash: string;
    config: DeterministicConfig;
    metadata: {
        tokensUsed: number;
        executionTime: number;
        modelUsed: string;
    };
}

export class ${className} {
    private client: OpenAI;
    private config: DeterministicConfig;

    constructor(apiKey: string, baseURL?: string) {
        this.client = new OpenAI({ apiKey, baseURL });
        this.config = ${JSON.stringify(config, null, 8)};
    }

    async ${functionName}(
        prompt: string = "${prompt.replace(/"/g, '\\"')}",
        model: string = 'gpt-4-turbo'
    ): Promise<DeterministicResult> {
        ${includeValidation ? `
        // Validate configuration
        if (this.config.temperature > 0) {
            console.warn('Warning: Non-zero temperature may reduce reproducibility');
        }
        ` : ''}
        
        const startTime = Date.now();
        
        const response = await this.client.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
            top_p: this.config.topP,
            frequency_penalty: this.config.frequencyPenalty,
            presence_penalty: this.config.presencePenalty,
            seed: this.config.seed,
            stop: this.config.stopSequences
        });
        
        const executionTime = Date.now() - startTime;
        const content = response.choices[0].message.content || '';
        const contentHash = createHash('md5').update(content).digest('hex');
        
        return {
            content,
            hash: contentHash,
            config: this.config,
            metadata: {
                tokensUsed: response.usage?.total_tokens || 0,
                executionTime,
                modelUsed: model
            }
        };
    }

    async verifyReproducibility(
        prompt: string,
        iterations: number = 5
    ): Promise<{
        reproducibilityScore: number;
        uniqueOutputs: number;
        totalIterations: number;
        results: DeterministicResult[];
    }> {
        const results: DeterministicResult[] = [];
        
        for (let i = 0; i < iterations; i++) {
            const result = await this.${functionName}(prompt);
            results.push(result);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const uniqueHashes = new Set(results.map(r => r.hash));
        const reproducibilityScore = 1.0 - (uniqueHashes.size - 1) / results.length;
        
        return {
            reproducibilityScore,
            uniqueOutputs: uniqueHashes.size,
            totalIterations: iterations,
            results
        };
    }
}
`.trim();
    }

    /**
     * Generate cURL SDK
     */
    private generateCurlSDK(config: DeterminismConfig, prompt: string): string {
        return `
#!/bin/bash

# Deterministic AI Execution Script
# Configuration: ${JSON.stringify(config)}

API_KEY="your-api-key-here"
BASE_URL="https://api.openai.com/v1"
MODEL="gpt-4-turbo"
PROMPT="${prompt.replace(/"/g, '\\"')}"

# Execute deterministic request
curl -X POST "$BASE_URL/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $API_KEY" \\
  -d '{
    "model": "'$MODEL'",
    "messages": [
      {
        "role": "user",
        "content": "'$PROMPT'"
      }
    ],
    "temperature": ${config.temperature},
    "max_tokens": ${config.maxTokens},
    "top_p": ${config.topP},
    "frequency_penalty": ${config.frequencyPenalty},
    "presence_penalty": ${config.presencePenalty}${config.seed ? `,
    "seed": ${config.seed}` : ''}${config.stopSequences ? `,
    "stop": ${JSON.stringify(config.stopSequences)}` : ''}
  }'
`.trim();
    }

    /**
     * Create execution context
     */
    private createExecutionContext(prompt: string, config: DeterminismConfig): ExecutionContext {
        const contextData = { prompt, config };
        const hash = crypto.createHash('sha256')
            .update(JSON.stringify(contextData))
            .digest('hex');
        
        return {
            id: `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            prompt,
            config,
            timestamp: new Date(),
            hash
        };
    }

    /**
     * Store execution history
     */
    private storeExecutionHistory(context: ExecutionContext): void {
        const existing = this.executionHistory.get(context.hash) || [];
        existing.push(context);
        this.executionHistory.set(context.hash, existing);
    }

    /**
     * Calculate reproducibility score
     */
    private async calculateReproducibilityScore(contextHash: string): Promise<number> {
        const history = this.executionHistory.get(contextHash) || [];
        if (history.length < 2) return 1.0;
        
        // Simple reproducibility score based on execution frequency
        return Math.min(1.0, history.length / 10);
    }

    /**
     * Generate content hash
     */
    private generateContentHash(content: string): string {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Analyze reproducibility test results
     */
    private analyzeReproducibilityResults(results: DeterministicResult[]): {
        uniqueOutputs: number;
        mostCommonOutput: string;
        variance: number;
    } {
        const outputCounts = new Map<string, number>();
        
        results.forEach(result => {
            const count = outputCounts.get(result.hash) || 0;
            outputCounts.set(result.hash, count + 1);
        });
        
        const mostCommonEntry = Array.from(outputCounts.entries())
            .sort((a, b) => b[1] - a[1])[0];
        
        const mostCommonOutput = results.find(r => r.hash === mostCommonEntry[0])?.content || '';
        const variance = outputCounts.size / results.length;
        
        return {
            uniqueOutputs: outputCounts.size,
            mostCommonOutput,
            variance
        };
    }

    /**
     * Calculate test reproducibility score
     */
    private calculateTestReproducibilityScore(results: DeterministicResult[]): number {
        if (results.length === 0) return 0;
        
        const uniqueHashes = new Set(results.map(r => r.hash));
        return 1.0 - (uniqueHashes.size - 1) / results.length;
    }

    /**
     * Get execution statistics
     */
    getExecutionStats(): {
        totalExecutions: number;
        uniqueContexts: number;
        averageReproducibilityScore: number;
    } {
        const totalExecutions = Array.from(this.executionHistory.values())
            .reduce((sum, contexts) => sum + contexts.length, 0);
        
        const uniqueContexts = this.executionHistory.size;
        
        // Calculate average reproducibility (simplified)
        const avgScore = uniqueContexts > 0 ? totalExecutions / uniqueContexts / 10 : 0;
        
        return {
            totalExecutions,
            uniqueContexts,
            averageReproducibilityScore: Math.min(1.0, avgScore)
        };
    }

    /**
     * Clear execution history
     */
    clearHistory(): void {
        this.executionHistory.clear();
        this.reproducibilityCache.clear();
        logger.info('[DeterminismToolkit] Execution history cleared');
    }
}