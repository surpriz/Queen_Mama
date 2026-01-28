/**
 * Embeddings Utility
 *
 * Generates text embeddings using OpenAI's text-embedding-3-small model
 * for semantic search in the Context Intelligence System.
 */

import { getProviderApiKey } from "@/lib/ai-providers";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536; // Default dimensions for text-embedding-3-small
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokensUsed: number;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const apiKey = await getProviderApiKey("openai");

  if (!apiKey) {
    throw new Error("OpenAI API key not configured for embeddings");
  }

  // Clean and truncate text if needed (max ~8191 tokens for text-embedding-3-small)
  const cleanedText = cleanTextForEmbedding(text);

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: cleanedText,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding generation failed: ${error}`);
  }

  const data = await response.json();

  return {
    embedding: data.data[0].embedding,
    model: EMBEDDING_MODEL,
    tokensUsed: data.usage.total_tokens,
  };
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<EmbeddingResult[]> {
  const apiKey = await getProviderApiKey("openai");

  if (!apiKey) {
    throw new Error("OpenAI API key not configured for embeddings");
  }

  // Clean texts
  const cleanedTexts = texts.map(cleanTextForEmbedding);

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: cleanedTexts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Batch embedding generation failed: ${error}`);
  }

  const data = await response.json();
  const tokensPerText = Math.ceil(data.usage.total_tokens / texts.length);

  return data.data.map((item: { embedding: number[] }) => ({
    embedding: item.embedding,
    model: EMBEDDING_MODEL,
    tokensUsed: tokensPerText,
  }));
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have the same dimensions");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Clean text for embedding generation
 * - Remove excessive whitespace
 * - Truncate to approximately 8000 tokens (~32000 chars)
 */
function cleanTextForEmbedding(text: string): string {
  // Remove excessive whitespace
  let cleaned = text
    .replace(/\s+/g, " ")
    .trim();

  // Truncate if too long (approximate 4 chars per token)
  const maxChars = 32000;
  if (cleaned.length > maxChars) {
    cleaned = cleaned.substring(0, maxChars);
  }

  return cleaned;
}

/**
 * Format embedding array for PostgreSQL pgvector
 * pgvector expects format: [0.1, 0.2, ...]
 */
export function formatForPgVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Parse embedding from PostgreSQL pgvector format
 */
export function parseFromPgVector(pgVectorStr: string): number[] {
  return JSON.parse(pgVectorStr.replace(/^\[/, "[").replace(/\]$/, "]"));
}
