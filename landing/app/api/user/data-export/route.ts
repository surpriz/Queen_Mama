import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/user/data-export
 * Export all user data for GDPR compliance
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch all user data
    const [
      user,
      accounts,
      sessions,
      devices,
      apiKeys,
      subscription,
      invoices,
      syncedSessions,
      usageLogs,
    ] = await Promise.all([
      // User profile
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          stripeCustomerId: true,
        },
      }),

      // OAuth accounts (without tokens)
      prisma.account.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          provider: true,
          providerAccountId: true,
        },
      }),

      // Active sessions
      prisma.session.findMany({
        where: { userId },
        select: {
          id: true,
          expires: true,
        },
      }),

      // Registered devices
      prisma.device.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          platform: true,
          osVersion: true,
          appVersion: true,
          lastSeenAt: true,
          createdAt: true,
          isActive: true,
        },
      }),

      // API keys (without actual key values)
      prisma.apiKey.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          provider: true,
          keyPrefix: true,
          createdAt: true,
          lastUsedAt: true,
          isActive: true,
        },
      }),

      // Subscription
      prisma.subscription.findUnique({
        where: { userId },
        select: {
          id: true,
          plan: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      // Invoices
      prisma.invoice.findMany({
        where: { subscription: { userId } },
        select: {
          id: true,
          amountPaid: true,
          currency: true,
          status: true,
          invoicePdfUrl: true,
          periodStart: true,
          periodEnd: true,
          createdAt: true,
        },
      }),

      // Synced sessions
      prisma.syncedSession.findMany({
        where: { userId },
        select: {
          id: true,
          deviceId: true,
          title: true,
          startTime: true,
          endTime: true,
          duration: true,
          transcript: true,
          summary: true,
          actionItems: true,
          modeUsed: true,
          createdAt: true,
          aiResponses: {
            select: {
              id: true,
              type: true,
              content: true,
              provider: true,
              latencyMs: true,
              timestamp: true,
            },
          },
        },
      }),

      // Usage logs (last 90 days to keep size reasonable)
      prisma.usageLog.findMany({
        where: {
          userId,
          createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          action: true,
          provider: true,
          tokensUsed: true,
          cost: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Compile all data
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0",
      user: {
        profile: user,
        oauthAccounts: accounts.map((a) => ({
          ...a,
          // Don't include providerAccountId in full
          providerAccountId: `${a.providerAccountId.slice(0, 4)}***`,
        })),
        activeSessions: sessions.length,
      },
      devices,
      apiKeys,
      billing: {
        subscription,
        invoices,
      },
      data: {
        syncedSessions: syncedSessions.map((session) => ({
          ...session,
          // Include transcript only if it exists
          transcriptLength: session.transcript?.length || 0,
        })),
        usageLogs: {
          period: "last 90 days",
          count: usageLogs.length,
          logs: usageLogs,
        },
      },
    };

    // Return as JSON with download headers
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="queenmama-data-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Data export error:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
