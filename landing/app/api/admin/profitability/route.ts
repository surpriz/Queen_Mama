import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

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

    // All usage logs in the period — no plan filter
    const usageAggregates = await prisma.usageLog.groupBy({
      by: ["userId", "action"],
      where: {
        createdAt: { gte: periodStart, lt: periodEnd },
        action: { in: ["ai_request", "smart_mode", "transcription_token"] },
      },
      _sum: { cost: true },
      _count: { id: true },
    });

    // Invoices paid in the period (for revenue — works when Stripe is active)
    const invoicesInPeriod = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: periodStart, lt: periodEnd },
        status: "paid",
      },
      select: {
        amountPaid: true,
        subscription: { select: { userId: true } },
      },
    });

    // All user IDs with activity this period
    const activeUserIds = [
      ...new Set([
        ...usageAggregates.map((a) => a.userId),
        ...invoicesInPeriod.map((i) => i.subscription.userId),
      ]),
    ];

    if (activeUserIds.length === 0) {
      return NextResponse.json({
        month: `${year}-${String(month).padStart(2, "0")}`,
        summary: { totalRevenue: 0, totalCosts: 0, totalMargin: 0, userCount: 0 },
        users: [],
      });
    }

    // User identities + current plan
    const users = await prisma.user.findMany({
      where: { id: { in: activeUserIds } },
      select: {
        id: true,
        name: true,
        email: true,
        subscription: { select: { plan: true } },
      },
    });

    // Reconstruct historical plan for each user at the end of the period.
    // Walk backwards: start from the current plan, undo each plan change that
    // occurred at or after periodEnd (chronological order = earliest first).
    const planChangeLogs = await prisma.usageLog.findMany({
      where: { action: { in: ["ADMIN_PLAN_CHANGED", "STRIPE_PLAN_CHANGED"] } },
      select: { createdAt: true, metadata: true },
      orderBy: { createdAt: "asc" },
    });

    type Plan = "FREE" | "PRO" | "ENTERPRISE";
    const planAtPeriod: Record<string, Plan> = {};
    for (const u of users) {
      let plan: Plan = (u.subscription?.plan ?? "FREE") as Plan;
      for (const log of planChangeLogs) {
        if (log.createdAt < periodEnd) continue;
        const meta = log.metadata as { targetUserId?: string; oldPlan?: string } | null;
        if (meta?.targetUserId !== u.id || !meta?.oldPlan) continue;
        plan = meta.oldPlan as Plan;
      }
      planAtPeriod[u.id] = plan;
    }

    // Revenue map
    const revenueByUser: Record<string, number> = {};
    for (const inv of invoicesInPeriod) {
      const uid = inv.subscription.userId;
      revenueByUser[uid] = (revenueByUser[uid] ?? 0) + inv.amountPaid / 100;
    }

    // Cost maps
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

    const rows = users
      .map((u) => {
        const revenue = revenueByUser[u.id] ?? 0;
        const aiCost = aiCostByUser[u.id] ?? 0;
        const transcriptionCost = transcCostByUser[u.id] ?? 0;
        const totalCost = aiCost + transcriptionCost;
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          plan: planAtPeriod[u.id] ?? "FREE",
          revenue,
          aiCost,
          transcriptionCost,
          totalCost,
          margin: revenue - totalCost,
          aiRequestCount: aiCountByUser[u.id] ?? 0,
          transcriptionTokenCount: transcCountByUser[u.id] ?? 0,
        };
      })
      .sort((a, b) => a.margin - b.margin);

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
