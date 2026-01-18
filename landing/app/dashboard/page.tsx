import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatsCard } from "@/components/dashboard";
import { GlassCard, GradientButton } from "@/components/ui";
import Link from "next/link";

export const metadata = {
  title: "Dashboard - Queen Mama",
  description: "Your Queen Mama dashboard",
};

export default async function DashboardPage() {
  const session = await auth();

  const [user, sessionsCount, recentSessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session!.user.id },
      include: {
        subscription: true,
        _count: {
          select: { syncedSessions: true, usageLogs: true },
        },
      },
    }),
    prisma.syncedSession.count({
      where: { userId: session!.user.id },
    }),
    prisma.syncedSession.findMany({
      where: { userId: session!.user.id },
      orderBy: { startTime: "desc" },
      take: 5,
    }),
  ]);

  const currentPlan = user?.subscription?.plan || "FREE";
  const isPro = currentPlan === "PRO" || currentPlan === "ENTERPRISE";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="mt-1 text-[var(--qm-text-secondary)]">
          Here&apos;s an overview of your Queen Mama activity
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Sessions"
          value={sessionsCount}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          title="This Month"
          value={0}
          change={{ value: 0, trend: "neutral" }}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatsCard
          title="AI Requests"
          value={user?._count.usageLogs || 0}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatsCard
          title="Current Plan"
          value={currentPlan === "FREE" ? "Free" : currentPlan === "PRO" ? "Pro" : "Enterprise"}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassCard hover={false} padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Sessions</h2>
            <Link href="/dashboard/sessions" className="text-sm text-[var(--qm-accent)] hover:text-[var(--qm-accent-light)]">
              View all
            </Link>
          </div>
          {recentSessions.length > 0 ? (
            <ul className="space-y-3">
              {recentSessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)]">
                  <div>
                    <p className="text-sm font-medium text-white">{s.title}</p>
                    <p className="text-xs text-[var(--qm-text-tertiary)]">
                      {new Date(s.startTime).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {s.duration && (
                    <span className="text-xs text-[var(--qm-text-secondary)]">
                      {Math.round(s.duration / 60)} min
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8">
              <svg className="w-12 h-12 mx-auto text-[var(--qm-text-tertiary)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[var(--qm-text-secondary)]">No sessions yet</p>
              <p className="text-sm text-[var(--qm-text-tertiary)] mt-1">
                Start using Queen Mama on your Mac to see sessions here
              </p>
            </div>
          )}
        </GlassCard>

        <GlassCard hover={false} padding="lg">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {!isPro && (
              <Link href="/dashboard/account/api-keys" className="flex items-center gap-3 p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)] hover:bg-[var(--qm-surface-hover)] transition-colors">
                <div className="p-2 rounded-[var(--qm-radius-sm)] bg-[var(--qm-surface-medium)]">
                  <svg className="w-5 h-5 text-[var(--qm-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Configure API Keys</p>
                  <p className="text-xs text-[var(--qm-text-tertiary)]">Set up your AI provider keys</p>
                </div>
              </Link>
            )}

            {!isPro && (
              <Link href="/dashboard/billing" className="flex items-center gap-3 p-3 rounded-[var(--qm-radius-md)] bg-gradient-to-r from-[var(--qm-primary)]/20 to-[var(--qm-secondary)]/20 border border-[var(--qm-accent)]/20 hover:border-[var(--qm-accent)]/40 transition-colors">
                <div className="p-2 rounded-[var(--qm-radius-sm)] gradient-bg">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Upgrade to Pro</p>
                  <p className="text-xs text-[var(--qm-text-tertiary)]">Unlock Smart Mode and more features</p>
                </div>
              </Link>
            )}

            {isPro && (
              <Link href="/dashboard/billing" className="flex items-center gap-3 p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)] hover:bg-[var(--qm-surface-hover)] transition-colors">
                <div className="p-2 rounded-[var(--qm-radius-sm)] bg-[var(--qm-surface-medium)]">
                  <svg className="w-5 h-5 text-[var(--qm-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Manage Subscription</p>
                  <p className="text-xs text-[var(--qm-text-tertiary)]">View billing and invoices</p>
                </div>
              </Link>
            )}

            <a href="/" target="_blank" className="flex items-center gap-3 p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)] hover:bg-[var(--qm-surface-hover)] transition-colors">
              <div className="p-2 rounded-[var(--qm-radius-sm)] bg-[var(--qm-surface-medium)]">
                <svg className="w-5 h-5 text-[var(--qm-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Download App</p>
                <p className="text-xs text-[var(--qm-text-tertiary)]">Get Queen Mama for macOS</p>
              </div>
            </a>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
