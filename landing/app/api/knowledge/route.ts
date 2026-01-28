import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getKnowledgeStats, getTopPerformingAtoms } from "@/lib/knowledge-retrieval";
import { getExtractionStats } from "@/lib/knowledge-extraction";
import { KnowledgeType, Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * GET /api/knowledge
 * Get knowledge atoms for the authenticated user
 */
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Check if user is Enterprise
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true },
    });

    if (user?.subscription?.plan !== "ENTERPRISE") {
      return NextResponse.json(
        { error: "enterprise_required", message: "Knowledge Base requires Enterprise subscription" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";

    // Build where clause
    const where: Prisma.KnowledgeAtomWhereInput = { userId: session.user.id };
    if (type) {
      where.type = type as KnowledgeType;
    }

    // Build orderBy clause
    const orderBy: Record<string, "asc" | "desc"> = {};
    if (["createdAt", "usageCount", "helpfulCount", "lastUsedAt"].includes(sortBy)) {
      orderBy[sortBy] = sortOrder === "asc" ? "asc" : "desc";
    } else {
      orderBy.createdAt = "desc";
    }

    // Fetch atoms and stats
    const [atoms, total, stats, topAtoms] = await Promise.all([
      prisma.knowledgeAtom.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        select: {
          id: true,
          type: true,
          content: true,
          metadata: true,
          usageCount: true,
          helpfulCount: true,
          lastUsedAt: true,
          createdAt: true,
          session: {
            select: {
              id: true,
              title: true,
              startTime: true,
            },
          },
        },
      }),
      prisma.knowledgeAtom.count({ where }),
      getExtractionStats(session.user.id),
      getTopPerformingAtoms(session.user.id, 5),
    ]);

    // Calculate helpful ratio for each atom
    const atomsWithRatio = atoms.map((atom) => ({
      ...atom,
      helpfulRatio: atom.usageCount > 0 ? atom.helpfulCount / atom.usageCount : null,
    }));

    return NextResponse.json({
      atoms: atomsWithRatio,
      total,
      limit,
      offset,
      stats,
      topPerforming: topAtoms,
    });
  } catch (error) {
    console.error("Get knowledge error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/knowledge
 * Delete a knowledge atom
 */
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const atomId = url.searchParams.get("id");

    if (!atomId) {
      return NextResponse.json(
        { error: "invalid_request", message: "Atom ID required" },
        { status: 400 }
      );
    }

    // Delete atom (only if user owns it)
    const result = await prisma.knowledgeAtom.deleteMany({
      where: {
        id: atomId,
        userId: session.user.id,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "not_found", message: "Knowledge atom not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: atomId });
  } catch (error) {
    console.error("Delete knowledge error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}

// Schema for manual atom creation
const createAtomSchema = z.object({
  type: z.enum([
    "OBJECTION_RESPONSE",
    "TALKING_POINT",
    "QUESTION",
    "CLOSING_TECHNIQUE",
    "TOPIC_EXPERTISE",
  ]),
  content: z.string().min(10).max(1000),
  context: z.string().max(500).optional(),
});

/**
 * POST /api/knowledge
 * Manually create a knowledge atom (without embedding - for manual entries)
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Check if user is Enterprise
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true },
    });

    if (user?.subscription?.plan !== "ENTERPRISE") {
      return NextResponse.json(
        { error: "enterprise_required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createAtomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Import embedding generator dynamically to avoid issues if not needed
    const { generateEmbedding } = await import("@/lib/embeddings");
    const embeddingResult = await generateEmbedding(parsed.data.content);

    const atom = await prisma.knowledgeAtom.create({
      data: {
        userId: session.user.id,
        type: parsed.data.type,
        content: parsed.data.content,
        embedding: embeddingResult.embedding,
        metadata: {
          context: parsed.data.context,
          confidence: 1.0, // Manual entries have full confidence
          source: "manual",
          createdAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      atom: {
        id: atom.id,
        type: atom.type,
        content: atom.content,
        createdAt: atom.createdAt,
      },
    });
  } catch (error) {
    console.error("Create knowledge error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
