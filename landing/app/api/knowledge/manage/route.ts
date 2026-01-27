import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  getManagementStats,
  purgeUserAtoms,
  consolidateUserAtoms,
  runFullMaintenance,
  LIMITS,
} from "@/lib/knowledge-management";
import { z } from "zod";

/**
 * GET /api/knowledge/manage
 * Get management stats for the authenticated user's knowledge base
 */
export async function GET() {
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
        { error: "enterprise_required", message: "Knowledge management requires Enterprise subscription" },
        { status: 403 }
      );
    }

    const stats = await getManagementStats(session.user.id);

    return NextResponse.json({
      stats,
      limits: LIMITS,
      recommendations: generateRecommendations(stats),
    });
  } catch (error) {
    console.error("Get management stats error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

const actionSchema = z.object({
  action: z.enum(["purge", "consolidate", "full_maintenance"]),
  maxToPurge: z.number().optional(),
});

/**
 * POST /api/knowledge/manage
 * Execute management actions (purge, consolidate, or full maintenance)
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
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action, maxToPurge } = parsed.data;
    const userId = session.user.id;

    let result: unknown;

    switch (action) {
      case "purge":
        result = await purgeUserAtoms(userId, maxToPurge);
        break;

      case "consolidate":
        result = await consolidateUserAtoms(userId);
        break;

      case "full_maintenance":
        result = await runFullMaintenance(userId, true);
        break;
    }

    // Get updated stats
    const updatedStats = await getManagementStats(userId);

    return NextResponse.json({
      success: true,
      action,
      result,
      updatedStats,
    });
  } catch (error) {
    console.error("Execute management action error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/**
 * Generate recommendations based on stats
 */
function generateRecommendations(stats: Awaited<ReturnType<typeof getManagementStats>>): string[] {
  const recommendations: string[] = [];

  // Check usage percentage
  const usagePercent = (stats.total / stats.limit) * 100;
  if (usagePercent > 90) {
    recommendations.push(
      `Your knowledge base is ${usagePercent.toFixed(0)}% full. Consider running a cleanup.`
    );
  } else if (usagePercent > 70) {
    recommendations.push(
      `Your knowledge base is ${usagePercent.toFixed(0)}% full. Plan for cleanup soon.`
    );
  }

  // Check low quality atoms
  if (stats.lowQualityCount > 0) {
    recommendations.push(
      `${stats.lowQualityCount} atoms have low helpfulness. Running purge will remove these.`
    );
  }

  // Check stale atoms
  if (stats.staleCount > 0) {
    recommendations.push(
      `${stats.staleCount} atoms haven't been used in 90+ days and may be outdated.`
    );
  }

  // Check duplicates
  if (stats.duplicateEstimate > 5) {
    recommendations.push(
      `Estimated ~${stats.duplicateEstimate} duplicate atoms. Run consolidation to merge similar knowledge.`
    );
  }

  // Health score
  if (stats.healthScore < 60) {
    recommendations.push(
      `Knowledge base health is low (${stats.healthScore}%). Run full maintenance to improve quality.`
    );
  } else if (stats.healthScore >= 80) {
    recommendations.push(
      `Knowledge base health is good (${stats.healthScore}%). Keep up the quality!`
    );
  }

  return recommendations;
}
