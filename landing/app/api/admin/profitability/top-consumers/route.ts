import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

const TRANSCRIPTION_COST_PER_LOG = 0.0645;

export async function GET() {
  try {
    await requireAdmin();

    // All usage logs ever — no plan filter
    const usageAggregates = await prisma.usageLog.groupBy({
      by: ["userId", "action"],
      where: {
        action: { in: ["ai_request", "smart_mode", "transcription_token"] },
      },
      _sum: { cost: true },
      _count: { id: true },
    });

    const activeUserIds = [...new Set(usageAggregates.map((a) => a.userId))];

    if (activeUserIds.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: activeUserIds } },
      select: {
        id: true,
        name: true,
        email: true,
        subscription: { select: { plan: true } },
      },
    });

    const aiCostByUser: Record<string, number> = {};
    const transcCostByUser: Record<string, number> = {};
    const aiCountByUser: Record<string, number> = {};
    const transcCountByUser: Record<string, number> = {};

    for (const agg of usageAggregates) {
      if (agg.action === "ai_request" || agg.action === "smart_mode") {
        aiCostByUser[agg.userId] = (aiCostByUser[agg.userId] ?? 0) + (agg._sum.cost ?? 0);
        aiCountByUser[agg.userId] = (aiCountByUser[agg.userId] ?? 0) + agg._count.id;
      } else if (agg.action === "transcription_token") {
        const count = agg._count.id;
        transcCountByUser[agg.userId] = (transcCountByUser[agg.userId] ?? 0) + count;
        transcCostByUser[agg.userId] =
          (transcCostByUser[agg.userId] ?? 0) + count * TRANSCRIPTION_COST_PER_LOG;
      }
    }

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const rows = activeUserIds
      .filter((uid) => userMap[uid])
      .map((uid) => {
        const u = userMap[uid];
        const aiCost = aiCostByUser[uid] ?? 0;
        const transcriptionCost = transcCostByUser[uid] ?? 0;
        return {
          userId: uid,
          name: u.name,
          email: u.email,
          plan: (u.subscription?.plan ?? "FREE") as "FREE" | "PRO" | "ENTERPRISE",
          aiCost,
          transcriptionCost,
          totalCost: aiCost + transcriptionCost,
          aiRequestCount: aiCountByUser[uid] ?? 0,
          transcriptionTokenCount: transcCountByUser[uid] ?? 0,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5);

    return NextResponse.json({ users: rows });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "Forbidden")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error fetching top consumers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
