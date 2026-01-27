/**
 * Knowledge Retrieval Service
 *
 * Retrieves relevant knowledge atoms using vector similarity search
 * and formats them for injection into AI prompts.
 */

import { prisma } from "@/lib/prisma";
import { generateEmbedding, cosineSimilarity } from "@/lib/embeddings";
import { KnowledgeType, Prisma } from "@prisma/client";

export interface RetrievedKnowledge {
  id: string;
  type: KnowledgeType;
  content: string;
  context?: string;
  similarity: number;
  usageCount: number;
  helpfulRatio: number;
}

export interface RetrievalOptions {
  maxResults?: number;
  minSimilarity?: number;
  types?: KnowledgeType[];
  boostHelpful?: boolean;
}

const DEFAULT_OPTIONS: Required<RetrievalOptions> = {
  maxResults: 5,
  minSimilarity: 0.4, // Lowered for better recall
  types: [],
  boostHelpful: true,
};

/**
 * Retrieve relevant knowledge atoms for a given query
 */
export async function retrieveRelevantKnowledge(
  userId: string,
  query: string,
  options: RetrievalOptions = {}
): Promise<RetrievedKnowledge[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  console.log(`[KnowledgeRetrieval] Searching for user ${userId}, query: "${query.slice(0, 50)}..."`);

  // 1. Generate embedding for the query
  let queryEmbedding: number[];
  try {
    const result = await generateEmbedding(query);
    queryEmbedding = result.embedding;
    console.log(`[KnowledgeRetrieval] Generated query embedding (${queryEmbedding.length} dimensions)`);
  } catch (error) {
    console.error("[KnowledgeRetrieval] Failed to generate query embedding:", error);
    return [];
  }

  // 2. Fetch all user's knowledge atoms (for now, filter in application)
  // TODO: Use pgvector <-> operator for native vector similarity when available
  const whereClause: Prisma.KnowledgeAtomWhereInput = {
    userId,
  };

  if (opts.types.length > 0) {
    whereClause.type = { in: opts.types };
  }

  const atoms = await prisma.knowledgeAtom.findMany({
    where: whereClause,
    select: {
      id: true,
      type: true,
      content: true,
      embedding: true,
      metadata: true,
      usageCount: true,
      helpfulCount: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100, // Limit to recent atoms for performance
  });

  console.log(`[KnowledgeRetrieval] Found ${atoms.length} atoms for user`);

  if (atoms.length === 0) {
    return [];
  }

  // 3. Calculate similarity scores
  const scoredAtoms = atoms.map((atom) => {
    const similarity = cosineSimilarity(queryEmbedding, atom.embedding);
    const helpfulRatio =
      atom.usageCount > 0 ? atom.helpfulCount / atom.usageCount : 0.5;

    // Boost score based on helpfulness if enabled
    let finalScore = similarity;
    if (opts.boostHelpful && atom.usageCount >= 3) {
      // Apply helpfulness boost (up to 20% boost for 100% helpful)
      finalScore = similarity * (1 + helpfulRatio * 0.2);
    }

    return {
      id: atom.id,
      type: atom.type,
      content: atom.content,
      context: (atom.metadata as Record<string, unknown>)?.context as string | undefined,
      similarity,
      finalScore,
      usageCount: atom.usageCount,
      helpfulRatio,
    };
  });

  // 4. Filter and sort by score
  const filtered = scoredAtoms
    .filter((atom) => atom.similarity >= opts.minSimilarity)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, opts.maxResults);

  console.log(`[KnowledgeRetrieval] Similarity scores: ${scoredAtoms.map(a => a.similarity.toFixed(3)).join(", ")}`);
  console.log(`[KnowledgeRetrieval] After filtering (min: ${opts.minSimilarity}): ${filtered.length} atoms`);

  return filtered.map(({ finalScore, ...atom }) => atom);
}

/**
 * Format retrieved knowledge for injection into system prompt
 */
export function formatKnowledgeForPrompt(
  knowledge: RetrievedKnowledge[]
): string {
  if (knowledge.length === 0) {
    return "";
  }

  const typeLabels: Record<KnowledgeType, string> = {
    OBJECTION_RESPONSE: "Objection Handling",
    TALKING_POINT: "Effective Argument",
    QUESTION: "Discovery Question",
    CLOSING_TECHNIQUE: "Closing Technique",
    TOPIC_EXPERTISE: "Your Expertise",
  };

  const formattedItems = knowledge.map((item, index) => {
    const label = typeLabels[item.type] || item.type;
    return `${index + 1}. [${label}]: ${item.content}`;
  }).join("\n\n");

  return `
## Your Knowledge Base (based on your past conversations)

Relevant context from your previous interactions:

${formattedItems}

Use this knowledge to personalize your suggestions when relevant.`;
}

/**
 * Record usage of knowledge atoms (called after AI response is generated)
 */
export async function recordKnowledgeUsage(
  atomIds: string[],
  isHelpful?: boolean
): Promise<void> {
  if (atomIds.length === 0) return;

  // Update usage count for all atoms
  await prisma.knowledgeAtom.updateMany({
    where: { id: { in: atomIds } },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  // If feedback provided, update helpful count
  if (isHelpful === true) {
    await prisma.knowledgeAtom.updateMany({
      where: { id: { in: atomIds } },
      data: { helpfulCount: { increment: 1 } },
    });
  }
}

/**
 * Get knowledge atom statistics for a user
 */
export async function getKnowledgeStats(userId: string) {
  const [
    totalAtoms,
    totalUsage,
    avgHelpfulness,
    recentAtoms,
  ] = await Promise.all([
    prisma.knowledgeAtom.count({ where: { userId } }),
    prisma.knowledgeAtom.aggregate({
      where: { userId },
      _sum: { usageCount: true },
    }),
    prisma.knowledgeAtom.aggregate({
      where: { userId, usageCount: { gt: 0 } },
      _avg: { helpfulCount: true },
    }),
    prisma.knowledgeAtom.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        type: true,
        content: true,
        usageCount: true,
        helpfulCount: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    totalAtoms,
    totalUsage: totalUsage._sum.usageCount || 0,
    avgHelpfulness: avgHelpfulness._avg.helpfulCount || 0,
    recentAtoms,
  };
}

/**
 * Delete a knowledge atom
 */
export async function deleteKnowledgeAtom(
  atomId: string,
  userId: string
): Promise<boolean> {
  const result = await prisma.knowledgeAtom.deleteMany({
    where: {
      id: atomId,
      userId, // Ensure user owns the atom
    },
  });

  return result.count > 0;
}

/**
 * Get top performing knowledge atoms
 */
export async function getTopPerformingAtoms(
  userId: string,
  limit: number = 5
) {
  return prisma.knowledgeAtom.findMany({
    where: {
      userId,
      usageCount: { gte: 3 }, // At least 3 uses
    },
    orderBy: [
      { helpfulCount: "desc" },
      { usageCount: "desc" },
    ],
    take: limit,
    select: {
      id: true,
      type: true,
      content: true,
      usageCount: true,
      helpfulCount: true,
      createdAt: true,
    },
  });
}
