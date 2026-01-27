/**
 * Knowledge Management Service
 *
 * Handles knowledge atom lifecycle management:
 * - Enforces per-user atom limits (500 max)
 * - Auto-purges low-quality and stale atoms
 * - Consolidates similar atoms to reduce redundancy
 */

import { prisma } from "@/lib/prisma";
import { KnowledgeType } from "@prisma/client";

// Configuration limits
export const LIMITS = {
  MAX_ATOMS_PER_USER: 500,
  PURGE_MIN_USES: 5,           // Minimum usages before quality evaluation
  PURGE_MIN_HELPFUL_RATIO: 0.3, // Ratio minimum to keep
  STALE_DAYS: 90,               // Days without usage = stale
  CONSOLIDATION_SIMILARITY: 0.85, // Threshold for merging similar atoms
};

export interface AtomLimitStatus {
  current: number;
  limit: number;
  remaining: number;
  canCreate: boolean;
  usagePercentage: number;
}

export interface PurgeResult {
  purgedCount: number;
  lowQualityCount: number;
  staleCount: number;
  errors: string[];
}

export interface ConsolidationResult {
  groupsFound: number;
  atomsMerged: number;
  atomsRemaining: number;
  errors: string[];
}

export interface ManagementStats {
  total: number;
  limit: number;
  lowQualityCount: number;
  staleCount: number;
  duplicateEstimate: number;
  byType: Record<string, number>;
  healthScore: number; // 0-100
}

/**
 * Check if user has room for new atoms
 */
export async function checkAtomLimit(userId: string): Promise<AtomLimitStatus> {
  const current = await prisma.knowledgeAtom.count({
    where: { userId },
  });

  const remaining = Math.max(0, LIMITS.MAX_ATOMS_PER_USER - current);

  return {
    current,
    limit: LIMITS.MAX_ATOMS_PER_USER,
    remaining,
    canCreate: remaining > 0,
    usagePercentage: (current / LIMITS.MAX_ATOMS_PER_USER) * 100,
  };
}

/**
 * Make room for new atoms by purging low-quality ones
 * Returns the number of slots freed
 */
export async function makeRoomForNewAtoms(
  userId: string,
  slotsNeeded: number
): Promise<number> {
  const limitStatus = await checkAtomLimit(userId);

  if (limitStatus.remaining >= slotsNeeded) {
    return limitStatus.remaining;
  }

  const slotsToFree = slotsNeeded - limitStatus.remaining;

  // First, try purging low-quality atoms
  const purgeResult = await purgeUserAtoms(userId, slotsToFree);
  let freed = purgeResult.purgedCount;

  // If still not enough, force-remove lowest quality atoms
  if (freed < slotsToFree) {
    const additionalNeeded = slotsToFree - freed;
    const forcePurged = await forceRemoveLowestQuality(userId, additionalNeeded);
    freed += forcePurged;
  }

  return limitStatus.remaining + freed;
}

/**
 * Purge low-quality and stale atoms for a user
 */
export async function purgeUserAtoms(
  userId: string,
  maxToPurge?: number
): Promise<PurgeResult> {
  const result: PurgeResult = {
    purgedCount: 0,
    lowQualityCount: 0,
    staleCount: 0,
    errors: [],
  };

  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - LIMITS.STALE_DAYS);

  try {
    // Find low-quality atoms (used 5+ times but less than 30% helpful)
    const lowQualityAtoms = await prisma.knowledgeAtom.findMany({
      where: {
        userId,
        usageCount: { gte: LIMITS.PURGE_MIN_USES },
      },
      select: {
        id: true,
        usageCount: true,
        helpfulCount: true,
      },
    });

    const lowQualityIds = lowQualityAtoms
      .filter((atom) => {
        const ratio = atom.usageCount > 0 ? atom.helpfulCount / atom.usageCount : 0;
        return ratio < LIMITS.PURGE_MIN_HELPFUL_RATIO;
      })
      .map((atom) => atom.id);

    // Find stale atoms (not used in 90+ days)
    const staleAtoms = await prisma.knowledgeAtom.findMany({
      where: {
        userId,
        OR: [
          { lastUsedAt: { lt: staleDate } },
          {
            lastUsedAt: null,
            createdAt: { lt: staleDate },
          },
        ],
      },
      select: { id: true },
    });

    const staleIds = staleAtoms.map((atom) => atom.id);

    // Combine and dedupe IDs
    const idsToDelete = [...new Set([...lowQualityIds, ...staleIds])];

    // Limit if maxToPurge specified
    const finalIds = maxToPurge
      ? idsToDelete.slice(0, maxToPurge)
      : idsToDelete;

    if (finalIds.length > 0) {
      await prisma.knowledgeAtom.deleteMany({
        where: { id: { in: finalIds } },
      });
    }

    result.purgedCount = finalIds.length;
    result.lowQualityCount = lowQualityIds.filter((id) => finalIds.includes(id)).length;
    result.staleCount = staleIds.filter((id) => finalIds.includes(id)).length;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Purge failed: ${errorMsg}`);
  }

  return result;
}

/**
 * Force-remove the lowest quality atoms when at limit
 */
async function forceRemoveLowestQuality(
  userId: string,
  count: number
): Promise<number> {
  // Get atoms sorted by quality score (lower is worse)
  const atoms = await prisma.knowledgeAtom.findMany({
    where: { userId },
    select: {
      id: true,
      usageCount: true,
      helpfulCount: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: [
      { usageCount: "asc" },
      { helpfulCount: "asc" },
      { createdAt: "asc" },
    ],
    take: count,
  });

  if (atoms.length === 0) return 0;

  const idsToDelete = atoms.map((a) => a.id);
  await prisma.knowledgeAtom.deleteMany({
    where: { id: { in: idsToDelete } },
  });

  return idsToDelete.length;
}

/**
 * Consolidate similar atoms using embedding similarity
 */
export async function consolidateUserAtoms(
  userId: string
): Promise<ConsolidationResult> {
  const result: ConsolidationResult = {
    groupsFound: 0,
    atomsMerged: 0,
    atomsRemaining: 0,
    errors: [],
  };

  try {
    // Group by type first (only consolidate within same type)
    const types: KnowledgeType[] = [
      "OBJECTION_RESPONSE",
      "TALKING_POINT",
      "QUESTION",
      "CLOSING_TECHNIQUE",
      "TOPIC_EXPERTISE",
    ];

    for (const type of types) {
      const atoms = await prisma.knowledgeAtom.findMany({
        where: { userId, type },
        select: {
          id: true,
          content: true,
          embedding: true,
          usageCount: true,
          helpfulCount: true,
        },
      });

      if (atoms.length < 2) continue;

      // Find similar pairs using cosine similarity
      const groups = findSimilarGroups(atoms, LIMITS.CONSOLIDATION_SIMILARITY);

      for (const group of groups) {
        if (group.length < 2) continue;

        result.groupsFound++;

        // Keep the atom with best helpful ratio
        const sorted = group.sort((a, b) => {
          const ratioA = a.usageCount > 0 ? a.helpfulCount / a.usageCount : 0;
          const ratioB = b.usageCount > 0 ? b.helpfulCount / b.usageCount : 0;
          return ratioB - ratioA;
        });

        const keeper = sorted[0];
        const toMerge = sorted.slice(1);

        // Merge usage counts into keeper
        const totalUsage = group.reduce((sum, a) => sum + a.usageCount, 0);
        const totalHelpful = group.reduce((sum, a) => sum + a.helpfulCount, 0);

        await prisma.knowledgeAtom.update({
          where: { id: keeper.id },
          data: {
            usageCount: totalUsage,
            helpfulCount: totalHelpful,
          },
        });

        // Delete duplicates
        await prisma.knowledgeAtom.deleteMany({
          where: { id: { in: toMerge.map((a) => a.id) } },
        });

        result.atomsMerged += toMerge.length;
      }
    }

    result.atomsRemaining = await prisma.knowledgeAtom.count({ where: { userId } });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Consolidation failed: ${errorMsg}`);
  }

  return result;
}

/**
 * Find groups of similar atoms using Union-Find algorithm
 */
interface AtomForSimilarity {
  id: string;
  embedding: number[];
  usageCount: number;
  helpfulCount: number;
}

function findSimilarGroups(
  atoms: AtomForSimilarity[],
  threshold: number
): AtomForSimilarity[][] {
  const n = atoms.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    if (parent[i] !== i) {
      parent[i] = find(parent[i]);
    }
    return parent[i];
  }

  function union(i: number, j: number): void {
    parent[find(i)] = find(j);
  }

  // Compare all pairs
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const similarity = cosineSimilarity(atoms[i].embedding, atoms[j].embedding);
      if (similarity >= threshold) {
        union(i, j);
      }
    }
  }

  // Group by root
  const groups = new Map<number, AtomForSimilarity[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(atoms[i]);
  }

  // Only return groups with 2+ atoms (duplicates)
  return Array.from(groups.values()).filter((g) => g.length >= 2);
}

/**
 * Calculate cosine similarity between two embeddings
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Get comprehensive management stats for a user
 */
export async function getManagementStats(userId: string): Promise<ManagementStats> {
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - LIMITS.STALE_DAYS);

  const [total, byType, lowQualityAtoms, staleCount] = await Promise.all([
    prisma.knowledgeAtom.count({ where: { userId } }),
    prisma.knowledgeAtom.groupBy({
      by: ["type"],
      where: { userId },
      _count: { id: true },
    }),
    prisma.knowledgeAtom.findMany({
      where: {
        userId,
        usageCount: { gte: LIMITS.PURGE_MIN_USES },
      },
      select: { usageCount: true, helpfulCount: true },
    }),
    prisma.knowledgeAtom.count({
      where: {
        userId,
        OR: [
          { lastUsedAt: { lt: staleDate } },
          { lastUsedAt: null, createdAt: { lt: staleDate } },
        ],
      },
    }),
  ]);

  const lowQualityCount = lowQualityAtoms.filter((atom) => {
    const ratio = atom.usageCount > 0 ? atom.helpfulCount / atom.usageCount : 0;
    return ratio < LIMITS.PURGE_MIN_HELPFUL_RATIO;
  }).length;

  // Estimate duplicates (rough heuristic based on type distribution)
  const typeCounts = byType.map((t) => t._count.id);
  const duplicateEstimate = Math.floor(
    typeCounts.reduce((sum, c) => sum + Math.max(0, c - 10) * 0.1, 0)
  );

  // Calculate health score (0-100)
  const usageRatio = total / LIMITS.MAX_ATOMS_PER_USER;
  const lowQualityRatio = total > 0 ? lowQualityCount / total : 0;
  const staleRatio = total > 0 ? staleCount / total : 0;

  const healthScore = Math.round(
    100 -
      (usageRatio > 0.9 ? 30 : usageRatio > 0.7 ? 15 : 0) -
      lowQualityRatio * 40 -
      staleRatio * 30
  );

  return {
    total,
    limit: LIMITS.MAX_ATOMS_PER_USER,
    lowQualityCount,
    staleCount,
    duplicateEstimate,
    byType: byType.reduce(
      (acc, item) => {
        acc[item.type] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    ),
    healthScore: Math.max(0, Math.min(100, healthScore)),
  };
}

/**
 * Run full maintenance for a user (purge + consolidation)
 */
export async function runFullMaintenance(
  userId: string,
  includeConsolidation: boolean = false
): Promise<{
  purge: PurgeResult;
  consolidation?: ConsolidationResult;
}> {
  const purge = await purgeUserAtoms(userId);

  let consolidation: ConsolidationResult | undefined;
  if (includeConsolidation) {
    consolidation = await consolidateUserAtoms(userId);
  }

  return { purge, consolidation };
}
