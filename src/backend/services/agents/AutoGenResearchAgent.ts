// @ts-nocheck
/**
 * AutoGen Multi-Step Research Agent with MCP Integration
 *
 * This agent implements a Plan-and-Execute pattern for complex research tasks
 * with shared context across MCP (Model Context Protocol) for efficient coordination.
 */

import { LLMServiceAdapter } from '../LLMServiceAdapter.js';
import { SemanticCacheService } from '../SemanticCacheService.js';
import type { ReasoningHistoryServiceType } from '../ReasoningHistoryService.js';
import { MCPClient } from '../../lib/mcp-client.js';
import { logger } from '../../lib/logger.js';
import { z } from 'zod';

// Define schemas for validation
const ResearchPlanSchema = z.object({
    objective: z.string().min(10, "Objective must be at least 10 characters"),
    steps: z.array(z.object({
        stepId: z.string(),
        description: z.string(),
        requiredTools: z.array(z.string()),
        dependencies: z.array(z.string()).optional(),
        expectedOutput: z.string()
    })),
    contextRequirements: z.array(z.string()),
    successCriteria: z.array(z.string())
});

const ResearchStepResultSchema = z.object({
    stepId: z.string(),
    status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
    output: z.any(),
    metadata: z.object({
        tokensUsed: z.number(),
        durationMs: z.number(),
        confidenceScore: z.number().min(0).max(1),
        sources: z.array(z.string())
    }),
    error: z.string().optional()
});

type ResearchPlan = z.infer<typeof ResearchPlanSchema>;
type ResearchStepResult = z.infer<typeof ResearchStepResultSchema>;

export class AutoGenResearchAgent {
    private llmService: LLMServiceAdapter;
    private cacheService: SemanticCacheService;
    private reasoningHistory: ReasoningHistoryServiceType;
    private mcpClient: MCPClient;
    private maxSteps: number;
    private maxTokensPerStep: number;

    constructor(
        llmService: LLMServiceAdapter,
        cacheService: SemanticCacheService,
        reasoningHistory: ReasoningHistoryServiceType,
        mcpClient: MCPClient,
        config: {
            maxSteps?: number;
            maxTokensPerStep?: number;
        } = {}
    ) {
        this.llmService = llmService;
        this.cacheService = cacheService;
        this.reasoningHistory = reasoningHistory;
        this.mcpClient = mcpClient;
        this.maxSteps = config.maxSteps || 10;
        this.maxTokensPerStep = config.maxTokensPerStep || 4000;
    }

    /**
     * Execute multi-step research with plan-and-execute pattern
     */
    async executeResearch(
        objective: string,
        initialContext: Record<string, any> = {},
        sessionId: string = `research_${Date.now()}`
    ): Promise<{
        finalAnswer: string;
        executionPlan: ResearchPlan;
        stepResults: ResearchStepResult[];
        sessionId: string;
    }> {
        // Validate input
        if (!objective || objective.length < 10) {
            throw new Error("Research objective must be at least 10 characters");
        }

        logger.info(`[AutoGenResearchAgent] Starting research session ${sessionId}: ${objective}`);

        // Step 1: Generate research plan
        const executionPlan = await this.generateResearchPlan(objective, initialContext);
        logger.debug(`[AutoGenResearchAgent] Generated research plan with ${executionPlan.steps.length} steps`);

        // Step 2: Execute plan step-by-step
        const stepResults: ResearchStepResult[] = [];
        let accumulatedContext = { ...initialContext };

        for (const [stepIndex, step] of executionPlan.steps.entries()) {
            if (stepIndex >= this.maxSteps) {
                logger.warn(`[AutoGenResearchAgent] Maximum steps (${this.maxSteps}) reached, stopping execution`);
                break;
            }

            try {
                logger.info(`[AutoGenResearchAgent] Executing step ${stepIndex + 1}/${executionPlan.steps.length}: ${step.description}`);

                // Check cache first
                const cacheKey = this.generateCacheKey(sessionId, step.stepId, accumulatedContext);
                const cachedResult = await this.cacheService.lookup({
                    prompt: cacheKey,
                    model: 'gpt-4-turbo'
                });

                if (cachedResult.hit && cachedResult.entry) {
                    logger.info(`[AutoGenResearchAgent] Cache hit for step ${step.stepId}`);
                    stepResults.push({
                        stepId: step.stepId,
                        status: 'completed',
                        output: cachedResult.entry.response,
                        metadata: {
                            tokensUsed: 0,
                            durationMs: 0,
                            confidenceScore: cachedResult.similarity || 0.9,
                            sources: []
                        }
                    });
                    continue;
                }

                // Execute step
                const startTime = Date.now();
                const stepResult = await this.executeResearchStep(step, accumulatedContext, executionPlan);
                const durationMs = Date.now() - startTime;

                // Validate step result
                const validatedResult = ResearchStepResultSchema.parse({
                    ...stepResult,
                    metadata: {
                        ...stepResult.metadata,
                        durationMs
                    }
                });

                stepResults.push(validatedResult);

                // Update accumulated context
                accumulatedContext = {
                    ...accumulatedContext,
                    [step.stepId]: validatedResult.output
                };

                // Cache the result
                await this.cacheService.store({
                    prompt: cacheKey,
                    response: validatedResult.output,
                    model: 'gpt-4-turbo',
                    ttlSeconds: 3600
                });

                logger.info(`[AutoGenResearchAgent] Completed step ${step.stepId} in ${durationMs}ms`);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error(`[AutoGenResearchAgent] Step ${step.stepId} failed: ${errorMessage}`);
                stepResults.push({
                    stepId: step.stepId,
                    status: 'failed',
                    output: null,
                    metadata: {
                        tokensUsed: 0,
                        durationMs: 0,
                        confidenceScore: 0,
                        sources: []
                    },
                    error: errorMessage
                });
                break;
            }
        }

        // Step 3: Generate final answer
        const finalAnswer = await this.generateFinalAnswer(executionPlan, stepResults, accumulatedContext);

        // Save reasoning history
        await this.reasoningHistory.saveSession({
            sessionId,
            objective,
            executionPlan,
            stepResults,
            finalAnswer,
            status: stepResults.some(s => s.status === 'failed') ? 'partial' : 'completed',
            metadata: {
                totalSteps: executionPlan.steps.length,
                completedSteps: stepResults.filter(s => s.status === 'completed').length,
                totalTokens: stepResults.reduce((sum, s) => sum + s.metadata.tokensUsed, 0)
            }
        });

        logger.info(`[AutoGenResearchAgent] Research session ${sessionId} completed`);

        return {
            finalAnswer,
            executionPlan,
            stepResults,
            sessionId
        };
    }

    /**
     * Generate a comprehensive research plan
     */
    private async generateResearchPlan(
        objective: string,
        context: Record<string, any>
    ): Promise<ResearchPlan> {
        const systemPrompt = `
You are an expert research planner. Create a detailed, step-by-step plan to achieve the following objective:

Objective: ${objective}

Context: ${JSON.stringify(context, null, 2)}

Guidelines:
1. Break down the objective into logical, sequential steps
2. Each step should have a clear description and expected output
3. Specify any tools or resources required for each step
4. Identify dependencies between steps
5. Define success criteria for the overall research
6. Consider potential risks and mitigation strategies
7. Estimate complexity and resource requirements

Return the plan as a JSON object matching the ResearchPlan schema.
`.trim();

        try {
            const response = await LLMServiceAdapter.executeTreeOfThought(systemPrompt, {
                maxDepth: 2,
                branchingFactor: 2
            });

            const planData = JSON.parse(response.finalAnswer);
            return ResearchPlanSchema.parse(planData);

        } catch (error: any) {
            logger.error(`[AutoGenResearchAgent] Failed to generate research plan: ${error.message}`);
            throw new Error(`Research plan generation failed: ${error.message}`);
        }
    }

    /**
     * Execute a single research step with MCP integration
     */
    private async executeResearchStep(
        step: ResearchPlan['steps'][0],
        context: Record<string, any>,
        plan: ResearchPlan
    ): Promise<Omit<ResearchStepResult, 'metadata'> & { metadata: Omit<ResearchStepResult['metadata'], 'durationMs'> }> {
        const startTokens = 0; // Token counting not available

        // Use MCP for tool coordination
        const mcpContext = await this.mcpClient.createContext({
            stepId: step.stepId,
            description: step.description,
            requiredTools: step.requiredTools,
            context: context
        });

        try {
            const systemPrompt = `
You are executing step "${step.description}" as part of a larger research objective.

Context from previous steps:
${JSON.stringify(context, null, 2)}

Expected output: ${step.expectedOutput}

Available tools: ${step.requiredTools.join(', ')}

Provide a comprehensive response that directly addresses the step requirements.
`.trim();

            const response = await LLMServiceAdapter.executeTreeOfThought(
                `Execute step: ${step.description}\n\nContext: ${JSON.stringify(context)}`,
                { maxDepth: 1, branchingFactor: 1 }
            );

            const endTokens = startTokens + 1000; // Estimate tokens
            const tokensUsed = endTokens - startTokens;

            // Extract sources and confidence from response
            const sources = this.extractSources(response.finalAnswer);
            const confidenceScore = this.calculateConfidence(response.finalAnswer, step);

            return {
                stepId: step.stepId,
                status: 'completed',
                output: response.finalAnswer,
                metadata: {
                    tokensUsed,
                    confidenceScore,
                    sources
                }
            };

        } catch (error: any) {
            logger.error(`[AutoGenResearchAgent] Step execution failed: ${error.message}`);
            return {
                stepId: step.stepId,
                status: 'failed',
                output: null,
                metadata: {
                    tokensUsed: 0,
                    confidenceScore: 0,
                    sources: []
                },
                error: error.message
            };
        } finally {
            await this.mcpClient.closeContext(mcpContext.id);
        }
    }

    /**
     * Generate final comprehensive answer
     */
    private async generateFinalAnswer(
        plan: ResearchPlan,
        stepResults: ResearchStepResult[],
        context: Record<string, any>
    ): Promise<string> {
        const completedSteps = stepResults.filter(s => s.status === 'completed');
        
        const systemPrompt = `
You are synthesizing the final answer for a research objective.

Original Objective: ${plan.objective}

Completed Research Steps:
${completedSteps.map(s => `- ${s.stepId}: ${s.output}`).join('\n')}

Success Criteria:
${plan.successCriteria.map(c => `- ${c}`).join('\n')}

Provide a comprehensive, well-structured final answer that:
1. Directly addresses the original objective
2. Synthesizes insights from all completed steps
3. Acknowledges any limitations or gaps
4. Provides actionable conclusions
`.trim();

        try {
            const response = await LLMServiceAdapter.executeTreeOfThought(
                `Synthesize final answer for: ${plan.objective}\n\nCompleted steps: ${completedSteps.map(s => s.output).join('\n')}`,
                { maxDepth: 1, branchingFactor: 1 }
            );

            return response.finalAnswer;

        } catch (error: any) {
            logger.error(`[AutoGenResearchAgent] Final answer generation failed: ${error.message}`);
            return `Research completed with ${completedSteps.length}/${stepResults.length} successful steps. Unable to generate comprehensive final answer due to: ${error.message}`;
        }
    }

    /**
     * Generate cache key for step results
     */
    private generateCacheKey(sessionId: string, stepId: string, context: Record<string, any>): string {
        const contextHash = require('crypto')
            .createHash('md5')
            .update(JSON.stringify(context))
            .digest('hex');
        return `research:${sessionId}:${stepId}:${contextHash}`;
    }

    /**
     * Extract sources from response content
     */
    private extractSources(content: string): string[] {
        const sourceRegex = /(?:source|reference|from):\s*([^\n]+)/gi;
        const matches = content.match(sourceRegex) || [];
        return matches.map(match => match.replace(/(?:source|reference|from):\s*/i, '').trim());
    }

    /**
     * Calculate confidence score based on response quality
     */
    private calculateConfidence(content: string, step: ResearchPlan['steps'][0]): number {
        let confidence = 0.5; // Base confidence
        
        // Increase confidence based on content length and structure
        if (content.length > 200) confidence += 0.1;
        if (content.includes('evidence') || content.includes('data')) confidence += 0.1;
        if (content.includes('conclusion') || content.includes('therefore')) confidence += 0.1;
        
        // Decrease confidence for uncertainty indicators
        if (content.includes('uncertain') || content.includes('unclear')) confidence -= 0.2;
        if (content.includes('might') || content.includes('possibly')) confidence -= 0.1;
        
        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Get research session status
     */
    async getSessionStatus(sessionId: string): Promise<any> {
        return await this.reasoningHistory.getSession(sessionId);
    }

    /**
     * Cancel ongoing research session
     */
    async cancelSession(sessionId: string): Promise<void> {
        await this.reasoningHistory.updateSessionStatus(sessionId, 'cancelled');
        logger.info(`[AutoGenResearchAgent] Session ${sessionId} cancelled`);
    }

    /**
     * List available tools for research steps
     */
    async listAvailableTools(): Promise<string[]> {
        return [
            'web_search',
            'document_analysis',
            'data_retrieval',
            'code_execution',
            'mathematical_computation',
            'image_analysis'
        ];
    }
}
