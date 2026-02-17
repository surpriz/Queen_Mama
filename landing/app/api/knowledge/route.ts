import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/device-auth";
import { getKnowledgeStats, getTopPerformingAtoms } from "@/lib/knowledge-retrieval";
import { getExtractionStats } from "@/lib/knowledge-extraction";
import { KnowledgeType, Prisma } from "@prisma/client";
import { z } from "zod";

// CORS headers for desktop app requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * OPTIONS /api/knowledge
 * Handle preflight CORS requests
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * Authenticate via Bearer token (desktop app) or NextAuth session (web).
 * Returns the user ID or null.
 */
async function authenticateRequest(request: Request): Promise<string | null> {
  // Try Bearer token first (desktop app)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = await verifyAccessToken(token);
      return payload.sub;
    } catch {
      return null;
    }
  }
  // Fallback to NextAuth session (web dashboard)
  const session = await auth();
  return session?.user?.id || null;
}

/**
 * GET /api/knowledge
 * Get knowledge atoms for the authenticated user
 */
export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
    }

    // Check if user is Enterprise
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (user?.subscription?.plan !== "ENTERPRISE") {
      return NextResponse.json(
        { error: "enterprise_required", message: "Knowledge Base requires Enterprise subscription" },
        { status: 403, headers: corsHeaders }
      );
    }

    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";

    // Build where clause
    const where: Prisma.KnowledgeAtomWhereInput = { userId };
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
      getExtractionStats(userId),
      getTopPerformingAtoms(userId, 5),
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
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Get knowledge error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/knowledge
 * Delete a knowledge atom
 */
export async function DELETE(request: Request) {
  try {
    const userId = await authenticateRequest(request);

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const atomId = url.searchParams.get("id");

    if (!atomId) {
      return NextResponse.json(
        { error: "invalid_request", message: "Atom ID required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Delete atom (only if user owns it)
    const result = await prisma.knowledgeAtom.deleteMany({
      where: {
        id: atomId,
        userId,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "not_found", message: "Knowledge atom not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json({ success: true, deleted: atomId }, { headers: corsHeaders });
  } catch (error) {
    console.error("Delete knowledge error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500, headers: corsHeaders }
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
    const userId = await authenticateRequest(request);

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
    }

    // Check if user is Enterprise
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (user?.subscription?.plan !== "ENTERPRISE") {
      return NextResponse.json(
        { error: "enterprise_required" },
        { status: 403, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const parsed = createAtomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders }
      );
    }

    // Import embedding generator dynamically to avoid issues if not needed
    const { generateEmbedding } = await import("@/lib/embeddings");
    const embeddingResult = await generateEmbedding(parsed.data.content);

    const atom = await prisma.knowledgeAtom.create({
      data: {
        userId,
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
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Create knowledge error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
