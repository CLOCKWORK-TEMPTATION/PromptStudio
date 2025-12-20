import { createEmbedding, cosineSimilarity } from './embedding-util';

export interface VectorCacheEntry {
  prompt: string;
  embedding: number[];
  response: string;
  createdAt: Date;
}

const vectorCache: VectorCacheEntry[] = [];

export async function getCachedResponse(prompt: string, threshold = 0.85): Promise<string | undefined> {
  const embedding = await createEmbedding(prompt);
  let bestScore = 0;
  let bestResponse: string | undefined = undefined;
  for (const entry of vectorCache) {
    const score = cosineSimilarity(embedding, entry.embedding);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestResponse = entry.response;
    }
  }
  return bestResponse;
}

export async function cacheResponse(prompt: string, response: string): Promise<void> {
  const embedding = await createEmbedding(prompt);
  vectorCache.push({ prompt, embedding, response, createdAt: new Date() });
}
