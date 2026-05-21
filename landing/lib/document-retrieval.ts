/**
 * Document Retrieval — RAG for /api/proxy/ai/stream
 *
 * Searches user's DocumentChunk rows by cosine similarity against an embedded
 * query, returns top matches, and formats them for injection into the AI
 * system prompt.
 */

import { prisma } from "@/lib/prisma";
import { generateEmbedding, cosineSimilarity } from "@/lib/embeddings";

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  filename: string;
  pageNumber: number | null;
  content: string;
  similarity: number;
}

export interface DocumentRetrievalOptions {
  topK?: number;
  minSimilarity?: number;
  maxTotalTokens?: number;
  candidateCap?: number; // max chunks loaded for in-memory scoring per user
}

const DEFAULTS: Required<DocumentRetrievalOptions> = {
  topK: 5,
  minSimilarity: 0.7,
  maxTotalTokens: 3000,
  candidateCap: 500,
};

export async function userHasReadyDocuments(userId: string): Promise<boolean> {
  const count = await prisma.document.count({
    where: { userId, status: "READY" },
  });
  return count > 0;
}

export async function retrieveRelevantChunks(
  userId: string,
  queryText: string,
  options: DocumentRetrievalOptions = {}
): Promise<RetrievedChunk[]> {
  const opts = { ...DEFAULTS, ...options };

  if (!queryText || queryText.trim().length < 5) {
    return [];
  }

  let queryEmbedding: number[];
  try {
    const result = await generateEmbedding(queryText);
    queryEmbedding = result.embedding;
  } catch (err) {
    console.error("[DocumentRAG] Failed to embed query:", err);
    return [];
  }

  const chunks = await prisma.documentChunk.findMany({
    where: {
      userId,
      document: { status: "READY" },
    },
    select: {
      id: true,
      documentId: true,
      content: true,
      embedding: true,
      pageNumber: true,
      tokenCount: true,
      document: { select: { filename: true } },
    },
    orderBy: { createdAt: "desc" },
    take: opts.candidateCap,
  });

  if (chunks.length === 0) {
    return [];
  }

  const scored = chunks.map((c) => ({
    chunkId: c.id,
    documentId: c.documentId,
    filename: c.document.filename,
    pageNumber: c.pageNumber,
    content: c.content,
    tokenCount: c.tokenCount,
    similarity: cosineSimilarity(queryEmbedding, c.embedding),
  }));

  const sortedAll = [...scored].sort((a, b) => b.similarity - a.similarity);
  console.log(
    `[DocumentRAG] similarity distribution (top 5): ${sortedAll
      .slice(0, 5)
      .map((c) => `${c.filename}#${c.chunkId.slice(-4)}=${c.similarity.toFixed(3)}`)
      .join(", ")} (threshold=${opts.minSimilarity})`
  );

  const filtered = sortedAll.filter((c) => c.similarity >= opts.minSimilarity);

  // Cap by topK and by total token budget
  const selected: RetrievedChunk[] = [];
  let tokenBudget = opts.maxTotalTokens;
  for (const c of filtered) {
    if (selected.length >= opts.topK) break;
    if (c.tokenCount > tokenBudget) continue;
    selected.push({
      chunkId: c.chunkId,
      documentId: c.documentId,
      filename: c.filename,
      pageNumber: c.pageNumber,
      content: c.content,
      similarity: c.similarity,
    });
    tokenBudget -= c.tokenCount;
  }

  const avgSim =
    selected.length > 0
      ? (selected.reduce((s, c) => s + c.similarity, 0) / selected.length).toFixed(3)
      : "0";
  console.log(
    `[DocumentRAG] retrieved ${selected.length} chunks (candidates: ${chunks.length}, avg similarity: ${avgSim})`
  );

  return selected;
}

export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const body = chunks
    .map((c) => {
      const source = c.pageNumber
        ? `[Source: ${c.filename}, page ${c.pageNumber}]`
        : `[Source: ${c.filename}]`;
      return `${source}\n${c.content.trim()}`;
    })
    .join("\n\n");

  return `\n\n## Reference Documents\nThe user has uploaded reference documents. Use the following excerpts to ground your answer when relevant. Cite the source filename + page when used.\n\n${body}\n`;
}

export function uniqueFilenames(chunks: RetrievedChunk[]): string[] {
  return Array.from(new Set(chunks.map((c) => c.filename)));
}
