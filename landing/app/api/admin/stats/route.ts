import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  try {
    // Verify admin authentication
    await requireAdmin();

    // Get start of current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Fetch all stats in parallel
    const [totalUsers, newUsersThisMonth, proUsers, blockedUsers] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            createdAt: { gte: startOfMonth },
          },
        }),
        prisma.user.count({
          where: {
            subscription: {
              plan: "PRO",
              status: "ACTIVE",
            },
          },
        }),
        prisma.user.count({
          where: { role: "BLOCKED" },
        }),
      ]);

    return NextResponse.json({
      totalUsers,
      newUsersThisMonth,
      proUsers,
      blockedUsers,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
