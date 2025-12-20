import { Configuration, OpenAIApi } from 'openai';

const apiKey = process.env.OPENAI_API_KEY || '';
const openai = new OpenAIApi(new Configuration({ apiKey }));

export async function createEmbedding(text: string): Promise<number[]> {
  const res = await openai.createEmbedding({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return res.data.data[0].embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Embedding size mismatch');
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
