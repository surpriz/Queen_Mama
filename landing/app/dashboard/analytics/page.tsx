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

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const [totalSessions, totalAiRequests, thisMonthSessions, sessions, weekSessions] = await Promise.all([
    prisma.syncedSession.count({
      where: { userId: session!.user.id },
    }),
    prisma.usageLog.count({
      where: { userId: session!.user.id },
    }),
    prisma.syncedSession.count({
      where: {
        userId: session!.user.id,
        startTime: { gte: startOfMonth },
      },
    }),
    prisma.syncedSession.findMany({
      where: { userId: session!.user.id },
      select: { duration: true, startTime: true },
    }),
    prisma.syncedSession.findMany({
      where: {
        userId: session!.user.id,
        startTime: { gte: startOfWeek },
      },
      select: { startTime: true, duration: true },
    }),
  ]);

  const totalDuration = await prisma.syncedSession.aggregate({
    where: { userId: session!.user.id },
    _sum: { duration: true },
  });

  const totalMinutes = Math.round((totalDuration._sum.duration || 0) / 60);

  // Calculate session insights
  const sessionsWithDuration = sessions.filter(s => s.duration && s.duration > 0);
  const avgDuration = sessionsWithDuration.length > 0
    ? Math.round(sessionsWithDuration.reduce((acc, s) => acc + (s.duration || 0), 0) / sessionsWithDuration.length / 60)
    : 0;
  const longestSession = sessionsWithDuration.length > 0
    ? Math.round(Math.max(...sessionsWithDuration.map(s => s.duration || 0)) / 60)
    : 0;

  // Calculate most active day
  const dayCount: Record<string, number> = {};
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  sessions.forEach(s => {
    const day = dayNames[new Date(s.startTime).getDay()];
    dayCount[day] = (dayCount[day] || 0) + 1;
  });
  const mostActiveDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  // Calculate weekly activity grid (last 7 days)
  const weeklyActivity: { day: string; sessions: number; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);

    const daySessions = weekSessions.filter(s => {
      const sessionDate = new Date(s.startTime);
      return sessionDate >= date && sessionDate < nextDate;
    });

    weeklyActivity.push({
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      sessions: daySessions.length,
      minutes: Math.round(daySessions.reduce((acc, s) => acc + (s.duration || 0), 0) / 60),
    });
  }

  // AI assist effectiveness
  const avgAiPerSession = totalSessions > 0 ? (totalAiRequests / totalSessions).toFixed(1) : "0";

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
          <h2 className="text-lg font-semibold text-white mb-4">Session Insights</h2>
          {totalSessions > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-[var(--qm-radius-sm)] bg-[var(--qm-surface-medium)]">
                    <svg className="w-5 h-5 text-[var(--qm-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm text-[var(--qm-text-secondary)]">Average session duration</span>
                </div>
                <span className="text-lg font-semibold text-white">{avgDuration} min</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-[var(--qm-radius-sm)] bg-[var(--qm-surface-medium)]">
                    <svg className="w-5 h-5 text-[var(--qm-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <span className="text-sm text-[var(--qm-text-secondary)]">Longest session</span>
                </div>
                <span className="text-lg font-semibold text-white">{longestSession} min</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-[var(--qm-radius-sm)] bg-[var(--qm-surface-medium)]">
                    <svg className="w-5 h-5 text-[var(--qm-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-sm text-[var(--qm-text-secondary)]">Most active day</span>
                </div>
                <span className="text-lg font-semibold text-white">{mostActiveDay}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-[var(--qm-radius-sm)] bg-[var(--qm-surface-medium)]">
                    <svg className="w-5 h-5 text-[var(--qm-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-sm text-[var(--qm-text-secondary)]">AI requests per session</span>
                </div>
                <span className="text-lg font-semibold text-white">{avgAiPerSession}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="w-12 h-12 mx-auto text-[var(--qm-text-tertiary)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-[var(--qm-text-secondary)]">No session data yet</p>
              <p className="text-sm text-[var(--qm-text-tertiary)] mt-1">
                Start using Queen Mama to see your insights
              </p>
            </div>
          )}
        </GlassCard>

        <GlassCard hover={false} padding="lg">
          <h2 className="text-lg font-semibold text-white mb-4">Weekly Activity</h2>
          <div className="space-y-3">
            {weeklyActivity.map((day) => {
              const maxSessions = Math.max(...weeklyActivity.map(d => d.sessions), 1);
              const percentage = (day.sessions / maxSessions) * 100;
              return (
                <div key={day.day}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white w-12">{day.day}</span>
                    <div className="flex items-center gap-3">
                      {day.sessions > 0 && (
                        <span className="text-xs text-[var(--qm-text-tertiary)]">
                          {day.minutes} min
                        </span>
                      )}
                      <span className="text-sm text-[var(--qm-text-secondary)] w-20 text-right">
                        {day.sessions} {day.sessions === 1 ? "session" : "sessions"}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-[var(--qm-surface-light)] rounded-full overflow-hidden">
                    <div
                      className="h-full gradient-bg rounded-full transition-all duration-500"
                      style={{ width: `${day.sessions > 0 ? percentage : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {totalSessions === 0 && (
            <div className="text-center py-4 mt-4 border-t border-[var(--qm-border-subtle)]">
              <p className="text-sm text-[var(--qm-text-tertiary)]">
                Your weekly activity will appear here
              </p>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
