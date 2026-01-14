import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GlassCard } from "@/components/ui";
import { StatsCard } from "@/components/dashboard";

export const metadata = {
  title: "Analytics - Queen Mama",
  description: "View your Queen Mama usage analytics",
};

export default async function AnalyticsPage() {
  const session = await auth();

  const [totalSessions, totalAiRequests, thisMonthSessions, providerUsage] = await Promise.all([
    prisma.syncedSession.count({
      where: { userId: session!.user.id },
    }),
    prisma.usageLog.count({
      where: { userId: session!.user.id },
    }),
    prisma.syncedSession.count({
      where: {
        userId: session!.user.id,
        startTime: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.usageLog.groupBy({
      by: ["provider"],
      where: { userId: session!.user.id },
      _count: { provider: true },
    }),
  ]);

  const totalDuration = await prisma.syncedSession.aggregate({
    where: { userId: session!.user.id },
    _sum: { duration: true },
  });

  const totalMinutes = Math.round((totalDuration._sum.duration || 0) / 60);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="mt-1 text-[var(--qm-text-secondary)]">
          Track your Queen Mama usage and performance
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Sessions"
          value={totalSessions}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          title="This Month"
          value={thisMonthSessions}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatsCard
          title="Total Minutes"
          value={totalMinutes}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          title="AI Requests"
          value={totalAiRequests}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassCard hover={false} padding="lg">
          <h2 className="text-lg font-semibold text-white mb-4">AI Provider Usage</h2>
          {providerUsage.length > 0 ? (
            <div className="space-y-4">
              {providerUsage.map((item) => {
                const percentage = totalAiRequests > 0
                  ? Math.round((item._count.provider / totalAiRequests) * 100)
                  : 0;
                return (
                  <div key={item.provider}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white capitalize">{item.provider?.toLowerCase() || "Unknown"}</span>
                      <span className="text-sm text-[var(--qm-text-tertiary)]">{item._count.provider} requests</span>
                    </div>
                    <div className="h-2 bg-[var(--qm-surface-light)] rounded-full overflow-hidden">
                      <div
                        className="h-full gradient-bg rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-[var(--qm-text-secondary)]">No AI usage data yet</p>
            </div>
          )}
        </GlassCard>

        <GlassCard hover={false} padding="lg">
          <h2 className="text-lg font-semibold text-white mb-4">Usage Over Time</h2>
          <div className="text-center py-12">
            <svg
              className="w-12 h-12 mx-auto text-[var(--qm-text-tertiary)] mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p className="text-[var(--qm-text-secondary)]">Charts coming soon</p>
            <p className="text-sm text-[var(--qm-text-tertiary)] mt-1">
              Start using Queen Mama to see your usage trends
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
