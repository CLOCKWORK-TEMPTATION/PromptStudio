import prisma from '../lib/prisma.js';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { EmbeddingUtil } from './embedding-util.js';

/**
 * Types for Adaptive RAG
 */
export interface AdaptiveRAGOptions {
  maxChunks?: number;
  minRelevance?: number;
  minTrust?: number;
  enableSummarization?: boolean;
  maxContextLength?: number;
  includeSourceTrace?: boolean;
}

export interface ContextMask {
  allowedSources: string[];
  blockedSources: string[];
  trustThreshold: number;
  verifiedOnly: boolean;
}

export interface EnrichedChunk {
  id: string;
  content: string;
  summary?: string;
  source: string;
  sourceTitle: string;
  relevanceScore: number;
  trustScore: number;
  confidenceScore: number;
  isVerified: boolean;
  metadata?: Record<string, any>;
}

export interface AdaptiveRAGResult {
  sessionId: string;
  query: string;
  enrichedChunks: EnrichedChunk[];
  finalPrompt: string;
  contextStats: {
    totalChunks: number;
    avgRelevance: number;
    avgTrust: number;
    avgConfidence: number;
    totalTokens: number;
  };
  sourceTraces: SourceTrace[];
}

export interface SourceTrace {
  id: string;
  sourceDocument: string;
  sourceTitle: string;
  sourceUrl?: string;
  position: number;
  attribution: string;
}

/**
 * Adaptive RAG Service
 * خدمة RAG تكيفية مع حزم سياق ديناميكية
 */
export class AdaptiveRAGService {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openai.apiKey) {
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    }
  }

  /**
   * Build context mask to identify trusted sources
   * بناء ماسك سياق يحدد المصادر الموثوقة
   */
  async buildContextMask(
    knowledgeBaseId: string,
    options: {
      trustThreshold?: number;
      verifiedOnly?: boolean;
      allowedDomains?: string[];
      blockedDomains?: string[];
    } = {}
  ): Promise<ContextMask> {
    const {
      trustThreshold = 0.5,
      verifiedOnly = false,
      allowedDomains = [],
      blockedDomains = [],
    } = options;

    // Get trusted sources from registry
    const trustedSources = await prisma.trustedSource.findMany({
      where: {
        baseTrustScore: { gte: trustThreshold },
      },
    });

    const allowedSources = trustedSources
      .filter(source => {
        if (allowedDomains.length > 0 && source.domain) {
          return allowedDomains.includes(source.domain);
        }
        return true;
      })
      .map(source => source.domain || source.name)
      .filter(Boolean);

    return {
      allowedSources: [...new Set([...allowedSources, ...allowedDomains])],
      blockedSources: blockedDomains,
      trustThreshold,
      verifiedOnly,
    };
  }

  /**
   * Summarize chunks with confidence indicators
   * تلخيص المقتطفات مع مؤشرات الثقة
   */
  async summarizeChunks(
    chunks: Array<{
      id: string;
      content: string;
      source: string;
      title: string;
      relevanceScore: number;
      trustScore: number;
      isVerified: boolean;
      metadata?: Record<string, any>;
    }>,
    query: string
  ): Promise<EnrichedChunk[]> {
    if (!this.openai) {
      // Fallback: return chunks without summarization
      return chunks.map(chunk => ({
        ...chunk,
        sourceTitle: chunk.title,
        confidenceScore: this.calculateConfidenceScore(
          chunk.relevanceScore,
          chunk.trustScore,
          chunk.isVerified
        ),
      }));
    }

    const enrichedChunks: EnrichedChunk[] = [];

    for (const chunk of chunks) {
      try {
        // Generate summary using GPT
        const summary = await this.generateSummary(chunk.content, query);

        // Calculate confidence score based on multiple factors
        const confidenceScore = this.calculateConfidenceScore(
          chunk.relevanceScore,
          chunk.trustScore,
          chunk.isVerified
        );

        enrichedChunks.push({
          id: chunk.id,
          content: chunk.content,
          summary,
          source: chunk.source,
          sourceTitle: chunk.title,
          relevanceScore: chunk.relevanceScore,
          trustScore: chunk.trustScore,
          confidenceScore,
          isVerified: chunk.isVerified,
          metadata: chunk.metadata,
        });
      } catch (error) {
        console.error('Error summarizing chunk:', error);
        // Add chunk without summary on error
        enrichedChunks.push({
          id: chunk.id,
          content: chunk.content,
          source: chunk.source,
          sourceTitle: chunk.title,
          relevanceScore: chunk.relevanceScore,
          trustScore: chunk.trustScore,
          confidenceScore: this.calculateConfidenceScore(
            chunk.relevanceScore,
            chunk.trustScore,
            chunk.isVerified
          ),
          isVerified: chunk.isVerified,
          metadata: chunk.metadata,
        });
      }
    }

    return enrichedChunks;
  }

  /**
   * Generate summary for a chunk
   */
  private async generateSummary(content: string, query: string): Promise<string> {
    if (!this.openai) {
      return content.slice(0, 200) + '...';
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a summarization assistant. Summarize the provided text in the context of the query. Keep it concise (2-3 sentences) while preserving key information relevant to the query.`,
        },
        {
          role: 'user',
          content: `Query: ${query}\n\nText to summarize:\n${content}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 150,
    });

    return response.choices[0]?.message?.content?.trim() || content.slice(0, 200) + '...';
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(
    relevanceScore: number,
    trustScore: number,
    isVerified: boolean
  ): number {
    // Weighted combination of factors
    const verificationBonus = isVerified ? 0.1 : 0;
    const confidence = (
      relevanceScore * 0.4 +
      trustScore * 0.5 +
      verificationBonus
    );

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Inject context into prompt with source trace
   * حقن السياق في البرومبت النهائي مع حفظ أثر المصدر
   */
  async injectContextWithTrace(
    originalPrompt: string,
    enrichedChunks: EnrichedChunk[],
    sessionId: string,
    options: {
      maxContextLength?: number;
      citationFormat?: 'inline' | 'footnote' | 'endnote';
      includeConfidenceScores?: boolean;
    } = {}
  ): Promise<{ prompt: string; traces: SourceTrace[] }> {
    const {
      maxContextLength = 4000,
      citationFormat = 'inline',
      includeConfidenceScores = true,
    } = options;

    const traces: SourceTrace[] = [];
    let contextSection = '# Context from Knowledge Base\n\n';
    let currentLength = 0;
    let position = 0;

    // Sort chunks by relevance and confidence
    const sortedChunks = [...enrichedChunks].sort(
      (a, b) => (b.relevanceScore * b.confidenceScore) - (a.relevanceScore * a.confidenceScore)
    );

    for (const chunk of sortedChunks) {
      // Use summary if available, otherwise use original content
      const chunkText = chunk.summary || chunk.content;

      // Build attribution
      const attribution = this.buildAttribution(
        chunk,
        position + 1,
        citationFormat,
        includeConfidenceScores
      );

      const chunkWithAttribution = `${attribution}\n${chunkText}\n\n`;

      // Check if we exceed max context length
      if (currentLength + chunkWithAttribution.length > maxContextLength) {
        break;
      }

      contextSection += chunkWithAttribution;
      currentLength += chunkWithAttribution.length;

      // Create trace record
      const trace: SourceTrace = {
        id: chunk.id,
        sourceDocument: chunk.source,
        sourceTitle: chunk.sourceTitle,
        sourceUrl: chunk.metadata?.url,
        position: position + 1,
        attribution,
      };

      traces.push(trace);

      // Store trace in database
      await prisma.contextTrace.create({
        data: {
          sessionId,
          sourceDocument: chunk.source,
          sourceTitle: chunk.sourceTitle,
          sourceUrl: chunk.metadata?.url,
          injectedAt: position + 1,
          chunkSize: chunkText.length,
          citationFormat,
          attributionText: attribution,
        },
      });

      position++;
    }

    // Build final prompt
    const finalPrompt = `${contextSection}\n---\n\n# User Query\n${originalPrompt}\n\n# Instructions\nPlease use the context provided above to inform your response. Cite sources using the reference numbers [1], [2], etc. when applicable.`;

    return {
      prompt: finalPrompt,
      traces,
    };
  }

  /**
   * Build attribution text for a chunk
   */
  private buildAttribution(
    chunk: EnrichedChunk,
    position: number,
    format: 'inline' | 'footnote' | 'endnote',
    includeConfidence: boolean
  ): string {
    const baseAttribution = `[${position}] Source: ${chunk.sourceTitle}`;

    const metadata: string[] = [];

    if (chunk.isVerified) {
      metadata.push('✓ Verified');
    }

    if (includeConfidence) {
      metadata.push(`Relevance: ${(chunk.relevanceScore * 100).toFixed(0)}%`);
      metadata.push(`Trust: ${(chunk.trustScore * 100).toFixed(0)}%`);
      metadata.push(`Confidence: ${(chunk.confidenceScore * 100).toFixed(0)}%`);
    }

    if (metadata.length > 0) {
      return `${baseAttribution} (${metadata.join(', ')})`;
    }

    return baseAttribution;
  }

  /**
   * Retrieve adaptive context - Main method
   * استرجاع السياق التكيفي - الوظيفة الرئيسية
   */
  async retrieveAdaptiveContext(
    knowledgeBaseId: string,
    query: string,
    options: AdaptiveRAGOptions = {}
  ): Promise<AdaptiveRAGResult> {
    const {
      maxChunks = 5,
      minRelevance = 0.7,
      minTrust = 0.5,
      enableSummarization = true,
      maxContextLength = 4000,
      includeSourceTrace = true,
    } = options;

    // 1. Build context mask
    const contextMask = await this.buildContextMask(knowledgeBaseId, {
      trustThreshold: minTrust,
    });

    // 2. Generate query embedding
    const queryEmbedding = await EmbeddingUtil.generateEmbedding(query);

    // 3. Retrieve relevant documents
    const documents = await prisma.knowledgeDocument.findMany({
      where: {
        knowledgeBaseId,
        trustScore: { gte: minTrust },
        ...(contextMask.verifiedOnly && { isVerified: true }),
      },
    });

    // 4. Calculate relevance scores and filter
    const relevantChunks = documents
      .map(doc => {
        const docEmbedding = doc.embedding as any as number[];
        const relevanceScore = EmbeddingUtil.cosineSimilarity(queryEmbedding, docEmbedding);

        // Check if source is in context mask
        const sourceAllowed = contextMask.allowedSources.length === 0 ||
          contextMask.allowedSources.some(allowed => doc.source?.includes(allowed));
        const sourceBlocked = contextMask.blockedSources.some(blocked =>
          doc.source?.includes(blocked)
        );

        if (!sourceAllowed || sourceBlocked) {
          return null;
        }

        return {
          id: doc.id,
          content: doc.content,
          source: doc.source || 'Unknown',
          title: doc.title,
          relevanceScore,
          trustScore: doc.trustScore,
          isVerified: doc.isVerified,
          metadata: doc.metadata as Record<string, any>,
        };
      })
      .filter((chunk): chunk is NonNullable<typeof chunk> =>
        chunk !== null && chunk.relevanceScore >= minRelevance
      )
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxChunks);

    // 5. Create RAG session
    const session = await prisma.rAGContextSession.create({
      data: {
        query,
        queryEmbedding,
        maxChunks,
        minRelevance,
        minTrust,
        totalChunks: relevantChunks.length,
        avgRelevance: relevantChunks.reduce((sum, c) => sum + c.relevanceScore, 0) / relevantChunks.length,
        avgTrust: relevantChunks.reduce((sum, c) => sum + c.trustScore, 0) / relevantChunks.length,
      },
    });

    // 6. Summarize chunks if enabled
    let enrichedChunks: EnrichedChunk[];
    if (enableSummarization) {
      enrichedChunks = await this.summarizeChunks(relevantChunks, query);
    } else {
      enrichedChunks = relevantChunks.map(chunk => ({
        ...chunk,
        sourceTitle: chunk.title,
        confidenceScore: this.calculateConfidenceScore(
          chunk.relevanceScore,
          chunk.trustScore,
          chunk.isVerified
        ),
      }));
    }

    // 7. Store summaries in database
    for (let i = 0; i < enrichedChunks.length; i++) {
      const chunk = enrichedChunks[i];
      await prisma.contextSummary.create({
        data: {
          sessionId: session.id,
          documentId: chunk.id,
          originalChunk: chunk.content,
          summary: chunk.summary || chunk.content,
          relevanceScore: chunk.relevanceScore,
          trustScore: chunk.trustScore,
          confidenceScore: chunk.confidenceScore,
          position: i + 1,
          tokenCount: EmbeddingUtil.estimateTokenCount(chunk.summary || chunk.content),
          compressionRatio: chunk.summary
            ? chunk.content.length / chunk.summary.length
            : 1.0,
        },
      });
    }

    // 8. Inject context into prompt with trace
    const { prompt: finalPrompt, traces } = await this.injectContextWithTrace(
      query,
      enrichedChunks,
      session.id,
      { maxContextLength }
    );

    // 9. Calculate statistics
    const totalTokens = enrichedChunks.reduce(
      (sum, chunk) => sum + EmbeddingUtil.estimateTokenCount(chunk.summary || chunk.content),
      0
    );

    const avgConfidence = enrichedChunks.reduce((sum, c) => sum + c.confidenceScore, 0) / enrichedChunks.length;

    // 10. Update retrieval counts
    await prisma.knowledgeDocument.updateMany({
      where: {
        id: { in: enrichedChunks.map(c => c.id) },
      },
      data: {
        retrievalCount: { increment: 1 },
        lastRetrieved: new Date(),
      },
    });

    return {
      sessionId: session.id,
      query,
      enrichedChunks,
      finalPrompt,
      contextStats: {
        totalChunks: enrichedChunks.length,
        avgRelevance: session.avgRelevance || 0,
        avgTrust: session.avgTrust || 0,
        avgConfidence,
        totalTokens,
      },
      sourceTraces: includeSourceTrace ? traces : [],
    };
  }

  /**
   * Get session history
   */
  async getSessionHistory(sessionId: string) {
    const session = await prisma.rAGContextSession.findUnique({
      where: { id: sessionId },
      include: {
        summaries: {
          include: {
            document: true,
          },
          orderBy: { position: 'asc' },
        },
        traces: {
          orderBy: { injectedAt: 'asc' },
        },
      },
    });

    return session;
  }

  /**
   * Register a trusted source
   */
  async registerTrustedSource(data: {
    name: string;
    domain?: string;
    url?: string;
    sourceType?: string;
    baseTrustScore?: number;
    autoVerify?: boolean;
  }) {
    return await prisma.trustedSource.create({
      data: {
        name: data.name,
        domain: data.domain,
        url: data.url,
        sourceType: data.sourceType || 'document',
        baseTrustScore: data.baseTrustScore || 0.8,
        autoVerify: data.autoVerify || false,
      },
    });
  }
}

export const adaptiveRAGService = new AdaptiveRAGService();
export default adaptiveRAGService;
