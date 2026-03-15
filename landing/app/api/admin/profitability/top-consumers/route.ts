import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

const TRANSCRIPTION_COST_PER_LOG = 0.0645;

export async function GET() {
  try {
    await requireAdmin();

    const paidSubscriptions = await prisma.subscription.findMany({
      where: { plan: { not: "FREE" } },
      select: { userId: true, plan: true },
    });

    if (paidSubscriptions.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const paidUserIds = paidSubscriptions.map((s) => s.userId);
    const planByUser = Object.fromEntries(
      paidSubscriptions.map((s) => [s.userId, s.plan])
    );

    const [usageAggregates, users] = await Promise.all([
      prisma.usageLog.groupBy({
        by: ["userId", "action"],
        where: {
          userId: { in: paidUserIds },
          action: { in: ["ai_request", "smart_mode", "transcription_token"] },
        },
        _sum: { cost: true },
        _count: { id: true },
      }),
      prisma.user.findMany({
        where: { id: { in: paidUserIds } },
        select: { id: true, name: true, email: true },
      }),
    ]);

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

    const rows = paidUserIds
      .filter((uid) => userMap[uid])
      .map((uid) => {
        const aiCost = aiCostByUser[uid] ?? 0;
        const transcriptionCost = transcCostByUser[uid] ?? 0;
        return {
          userId: uid,
          name: userMap[uid].name,
          email: userMap[uid].email,
          plan: planByUser[uid] as "PRO" | "ENTERPRISE",
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
