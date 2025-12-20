import prisma from '../lib/prisma';

export interface RAGContext {
  chunks: ContextChunk[];
  totalRelevance: number;
  sources: string[];
}

export interface ContextChunk {
  content: string;
  source: string;
  relevanceScore: number;
  trustScore: number;
  metadata?: Record<string, any>;
}

export interface EmbeddingResult {
  embedding: number[];
  text: string;
}

export class RAGService {
  /**
   * Generate embeddings for text
   * In production, this would call OpenAI or similar service
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    // Placeholder: In real implementation, call embedding API
    // For now, return a simple hash-based vector
    const vector: number[] = new Array(1536).fill(0);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      vector[i % vector.length] += charCode;
    }

    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(v => v / magnitude);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }

  /**
   * Chunk text into smaller pieces
   */
  static chunkText(
    text: string,
    options: {
      chunkSize?: number;
      overlap?: number;
      separator?: string;
    } = {}
  ): string[] {
    const { chunkSize = 1000, overlap = 200, separator = '\n' } = options;

    const chunks: string[] = [];
    const sentences = text.split(separator);
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());

        // Add overlap
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.floor(overlap / 5));
        currentChunk = overlapWords.join(' ') + ' ';
      }

      currentChunk += sentence + separator;
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Add documents to knowledge base
   */
  static async addToKnowledgeBase(
    knowledgeBaseId: string,
    documents: Array<{
      title: string;
      content: string;
      source?: string;
      trustScore?: number;
      metadata?: Record<string, any>;
    }>
  ) {
    const createdDocs = [];

    for (const doc of documents) {
      // Chunk the document
      const chunks = this.chunkText(doc.content);

      // Create embeddings for each chunk
      for (const chunk of chunks) {
        const embedding = await this.generateEmbedding(chunk);

        const created = await prisma.knowledgeDocument.create({
          data: {
            knowledgeBaseId,
            title: doc.title,
            content: chunk,
            source: doc.source,
            trustScore: doc.trustScore || 1.0,
            metadata: doc.metadata || {},
            embedding: embedding,
          },
        });

        createdDocs.push(created);
      }
    }

    return createdDocs;
  }

  /**
   * Retrieve relevant context for a query
   */
  static async retrieveContext(
    knowledgeBaseId: string,
    query: string,
    options: {
      topK?: number;
      minRelevance?: number;
      minTrust?: number;
    } = {}
  ): Promise<RAGContext> {
    const { topK = 5, minRelevance = 0.7, minTrust = 0.5 } = options;

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Get all documents from knowledge base
    const documents = await prisma.knowledgeDocument.findMany({
      where: {
        knowledgeBaseId,
        trustScore: { gte: minTrust },
      },
    });

    // Calculate relevance scores
    const scoredChunks: ContextChunk[] = documents
      .map(doc => {
        const docEmbedding = doc.embedding as any as number[];
        const relevanceScore = this.cosineSimilarity(queryEmbedding, docEmbedding);

        return {
          content: doc.content,
          source: doc.source || 'Unknown',
          relevanceScore,
          trustScore: doc.trustScore,
          metadata: doc.metadata as Record<string, any>,
        };
      })
      .filter(chunk => chunk.relevanceScore >= minRelevance)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, topK);

    const totalRelevance = scoredChunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0);
    const sources = [...new Set(scoredChunks.map(chunk => chunk.source))];

    return {
      chunks: scoredChunks,
      totalRelevance,
      sources,
    };
  }

  /**
   * Build RAG-enhanced prompt
   */
  static buildRAGPrompt(
    originalPrompt: string,
    context: RAGContext,
    options: {
      includeSourceAttribution?: boolean;
      maxContextLength?: number;
    } = {}
  ): string {
    const { includeSourceAttribution = true, maxContextLength = 4000 } = options;

    // Build context section
    let contextSection = '# Relevant Context\n\n';
    let currentLength = 0;

    for (const chunk of context.chunks) {
      const chunkText = includeSourceAttribution
        ? `[Source: ${chunk.source}, Relevance: ${chunk.relevanceScore.toFixed(2)}, Trust: ${chunk.trustScore.toFixed(2)}]\n${chunk.content}\n\n`
        : `${chunk.content}\n\n`;

      if (currentLength + chunkText.length > maxContextLength) {
        break;
      }

      contextSection += chunkText;
      currentLength += chunkText.length;
    }

    // Combine with original prompt
    return `${contextSection}\n# Task\n${originalPrompt}\n\nPlease use the context provided above to inform your response. Cite sources when applicable.`;
  }

  /**
   * Create a new knowledge base
   */
  static async createKnowledgeBase(data: {
    name: string;
    description?: string;
    domain?: string;
    embeddingModel?: string;
    chunkSize?: number;
    chunkOverlap?: number;
  }) {
    return await prisma.knowledgeBase.create({
      data: {
        name: data.name,
        description: data.description,
        domain: data.domain,
        embeddingModel: data.embeddingModel || 'text-embedding-ada-002',
        chunkSize: data.chunkSize || 1000,
        chunkOverlap: data.chunkOverlap || 200,
      },
    });
  }

  /**
   * Update document trust scores based on feedback
   */
  static async updateTrustScores(
    knowledgeBaseId: string,
    feedback: Array<{
      source: string;
      accuracyRating: number; // 0-1
    }>
  ) {
    for (const item of feedback) {
      await prisma.knowledgeDocument.updateMany({
        where: {
          knowledgeBaseId,
          source: item.source,
        },
        data: {
          trustScore: item.accuracyRating,
        },
      });
    }
  }
}
