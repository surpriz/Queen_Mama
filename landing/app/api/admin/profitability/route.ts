import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

// 1 transcription_token log ≈ 15 min session × $0.0043/min (Deepgram Nova-3)
const TRANSCRIPTION_COST_PER_LOG = 0.0645;

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const monthParam = request.nextUrl.searchParams.get("month");
    if (monthParam && !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: "Invalid month format, expected YYYY-MM" }, { status: 400 });
    }

    const now = new Date();
    const [year, month] = monthParam
      ? monthParam.split("-").map(Number)
      : [now.getFullYear(), now.getMonth() + 1];

    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 1));

    // Get all non-FREE subscription IDs first (for reliable filtering)
    const paidSubscriptions = await prisma.subscription.findMany({
      where: { plan: { not: "FREE" } },
      select: { id: true, userId: true, plan: true },
    });

    const paidUserIds = paidSubscriptions.map((s) => s.userId);
    const subscriptionIds = paidSubscriptions.map((s) => s.id);
    const planByUser = Object.fromEntries(
      paidSubscriptions.map((s) => [s.userId, s.plan])
    );

    if (paidUserIds.length === 0) {
      return NextResponse.json({
        month: `${year}-${String(month).padStart(2, "0")}`,
        summary: { totalRevenue: 0, totalCosts: 0, totalMargin: 0, userCount: 0 },
        users: [],
      });
    }

    // Run queries in parallel
    const [invoices, usageAggregates, users] = await Promise.all([
      // Invoices paid during the period (use createdAt since Stripe billing
      // periods may not align with calendar months)
      prisma.invoice.findMany({
        where: {
          subscriptionId: { in: subscriptionIds },
          createdAt: { gte: periodStart, lt: periodEnd },
          status: "paid",
        },
        select: {
          amountPaid: true,
          subscription: { select: { userId: true } },
        },
      }),

      // UsageLog aggregates by user and action
      prisma.usageLog.groupBy({
        by: ["userId", "action"],
        where: {
          userId: { in: paidUserIds },
          createdAt: { gte: periodStart, lt: periodEnd },
          action: { in: ["ai_request", "smart_mode", "transcription_token"] },
        },
        _sum: { cost: true },
        _count: { id: true },
      }),

      // User identities
      prisma.user.findMany({
        where: { id: { in: paidUserIds } },
        select: { id: true, name: true, email: true },
      }),
    ]);

    // Build revenue map (amountPaid is in cents)
    const revenueByUser: Record<string, number> = {};
    for (const inv of invoices) {
      const uid = inv.subscription.userId;
      revenueByUser[uid] = (revenueByUser[uid] ?? 0) + inv.amountPaid / 100;
    }

    // Build cost and count maps
    const aiCostByUser: Record<string, number> = {};
    const aiCountByUser: Record<string, number> = {};
    const transcCostByUser: Record<string, number> = {};
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

    // Merge all data — include users with revenue OR usage
    const usersWithActivity = new Set([
      ...Object.keys(revenueByUser),
      ...usageAggregates.map((a) => a.userId),
    ]);

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const rows = [...usersWithActivity]
      .filter((uid) => userMap[uid] && planByUser[uid])
      .map((uid) => {
        const u = userMap[uid];
        const revenue = revenueByUser[uid] ?? 0;
        const aiCost = aiCostByUser[uid] ?? 0;
        const transcriptionCost = transcCostByUser[uid] ?? 0;
        const totalCost = aiCost + transcriptionCost;
        return {
          userId: uid,
          name: u.name,
          email: u.email,
          plan: planByUser[uid] as "PRO" | "ENTERPRISE",
          revenue,
          aiCost,
          transcriptionCost,
          totalCost,
          margin: revenue - totalCost,
          aiRequestCount: aiCountByUser[uid] ?? 0,
          transcriptionTokenCount: transcCountByUser[uid] ?? 0,
        };
      })
      .sort((a, b) => a.margin - b.margin); // Worst margin first

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalCosts = rows.reduce((s, r) => s + r.totalCost, 0);

    return NextResponse.json({
      month: `${year}-${String(month).padStart(2, "0")}`,
      summary: {
        totalRevenue,
        totalCosts,
        totalMargin: totalRevenue - totalCosts,
        userCount: rows.length,
      },
      users: rows,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "Forbidden")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error fetching profitability:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
