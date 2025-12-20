import OpenAI from 'openai';
import { config } from '../config/index.js';

/**
 * Embedding Utility Service
 * يوفر أدوات مساعدة لتوليد وإدارة embeddings
 */
export class EmbeddingUtil {
  private static openai: OpenAI | null = null;

  /**
   * Initialize OpenAI client
   */
  private static getClient(): OpenAI {
    if (!this.openai) {
      if (!config.openai.apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    }
    return this.openai;
  }

  /**
   * Generate embedding using OpenAI
   */
  static async generateEmbedding(text: string, model = 'text-embedding-3-small'): Promise<number[]> {
    try {
      const client = this.getClient();
      const response = await client.embeddings.create({
        model,
        input: text.slice(0, 8000), // Limit input length
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Fallback: simple hash-based pseudo-embedding for testing
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Generate fallback embedding (for testing/development)
   */
  static generateFallbackEmbedding(text: string): number[] {
    const vector: number[] = new Array(1536).fill(0);

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      vector[i % vector.length] += charCode;
    }

    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(v => v / magnitude) : vector;
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

    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Batch generate embeddings for multiple texts
   */
  static async batchGenerateEmbeddings(
    texts: string[],
    model = 'text-embedding-3-small',
    batchSize = 100
  ): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.generateEmbedding(text, model))
      );
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  /**
   * Calculate average embedding from multiple embeddings
   */
  static averageEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      throw new Error('Cannot average empty embeddings array');
    }

    const dimension = embeddings[0].length;
    const avgEmbedding = new Array(dimension).fill(0);

    for (const embedding of embeddings) {
      if (embedding.length !== dimension) {
        throw new Error('All embeddings must have the same dimension');
      }
      for (let i = 0; i < dimension; i++) {
        avgEmbedding[i] += embedding[i];
      }
    }

    return avgEmbedding.map(val => val / embeddings.length);
  }

  /**
   * Find top-k most similar embeddings
   */
  static findTopKSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: Array<{ embedding: number[]; metadata?: any }>,
    k: number,
    minSimilarity = 0.0
  ): Array<{ similarity: number; metadata?: any; index: number }> {
    const similarities = candidateEmbeddings.map((candidate, index) => ({
      similarity: this.cosineSimilarity(queryEmbedding, candidate.embedding),
      metadata: candidate.metadata,
      index,
    }));

    return similarities
      .filter(item => item.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  /**
   * Chunk text into smaller pieces with overlap
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
   * Estimate token count (rough approximation)
   */
  static estimateTokenCount(text: string): number {
    // Rough estimate: 1 token ~= 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Normalize embedding vector
   */
  static normalizeEmbedding(embedding: number[]): number[] {
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(v => v / magnitude) : embedding;
  }

  /**
   * Calculate euclidean distance between two vectors
   */
  static euclideanDistance(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      const diff = vec1[i] - vec2[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }
}
