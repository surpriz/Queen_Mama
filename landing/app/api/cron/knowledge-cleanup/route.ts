import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runFullMaintenance } from "@/lib/knowledge-management";

/**
 * GET /api/cron/knowledge-cleanup
 *
 * Vercel Cron Job endpoint for daily knowledge base cleanup.
 * Runs at 3:00 AM UTC daily, with full consolidation on Sundays.
 *
 * Protected by CRON_SECRET environment variable.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error("[KnowledgeCleanup] Invalid or missing CRON_SECRET");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  console.log("[KnowledgeCleanup] Starting daily cleanup job...");

  const startTime = Date.now();
  const results: {
    userId: string;
    email: string;
    purged: number;
    merged: number;
    errors: string[];
  }[] = [];

  try {
    // Get all Enterprise users with knowledge atoms
    const usersWithKnowledge = await prisma.user.findMany({
      where: {
        subscription: {
          plan: "ENTERPRISE",
        },
        knowledgeAtoms: {
          some: {},
        },
      },
      select: {
        id: true,
        email: true,
        _count: {
          select: { knowledgeAtoms: true },
        },
      },
    });

    console.log(
      `[KnowledgeCleanup] Found ${usersWithKnowledge.length} Enterprise users with knowledge atoms`
    );

    // Check if today is Sunday (day 0) for consolidation
    const isSunday = new Date().getDay() === 0;
    console.log(
      `[KnowledgeCleanup] Today is ${isSunday ? "Sunday - running full maintenance with consolidation" : "not Sunday - running purge only"}`
    );

    // Process each user
    for (const user of usersWithKnowledge) {
      try {
        console.log(
          `[KnowledgeCleanup] Processing user ${user.email} (${user._count.knowledgeAtoms} atoms)`
        );

        const result = await runFullMaintenance(user.id, isSunday);

        results.push({
          userId: user.id,
          email: user.email,
          purged: result.purge.purgedCount,
          merged: result.consolidation?.atomsMerged ?? 0,
          errors: [
            ...result.purge.errors,
            ...(result.consolidation?.errors ?? []),
          ],
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `[KnowledgeCleanup] Failed for user ${user.email}:`,
          errorMsg
        );
        results.push({
          userId: user.id,
          email: user.email,
          purged: 0,
          merged: 0,
          errors: [errorMsg],
        });
      }
    }

    const duration = Date.now() - startTime;
    const totalPurged = results.reduce((sum, r) => sum + r.purged, 0);
    const totalMerged = results.reduce((sum, r) => sum + r.merged, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    console.log(
      `[KnowledgeCleanup] Completed in ${duration}ms: ${totalPurged} purged, ${totalMerged} merged, ${totalErrors} errors`
    );

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      usersProcessed: usersWithKnowledge.length,
      totalPurged,
      totalMerged,
      totalErrors,
      includeConsolidation: isSunday,
      details: results,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[KnowledgeCleanup] Job failed:", errorMsg);

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}

// Support for Vercel Edge runtime (optional - remove if using Node.js runtime only)
// export const runtime = 'edge';

// Set max duration for long-running cleanup jobs
export const maxDuration = 60; // 60 seconds max for Pro/Enterprise Vercel plans
