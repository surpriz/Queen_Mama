import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { GlassCard } from "@/components/ui";
import { KnowledgeType } from "@prisma/client";

export const metadata = {
  title: "Admin - Knowledge Base - Queen Mama",
  description: "View all users knowledge atoms",
};

const TYPE_LABELS: Record<KnowledgeType, string> = {
  OBJECTION_RESPONSE: "Objection",
  TALKING_POINT: "Talking Point",
  QUESTION: "Question",
  CLOSING_TECHNIQUE: "Closing",
  TOPIC_EXPERTISE: "Expertise",
};

const TYPE_COLORS: Record<KnowledgeType, string> = {
  OBJECTION_RESPONSE: "bg-red-500/20 text-red-400",
  TALKING_POINT: "bg-blue-500/20 text-blue-400",
  QUESTION: "bg-green-500/20 text-green-400",
  CLOSING_TECHNIQUE: "bg-purple-500/20 text-purple-400",
  TOPIC_EXPERTISE: "bg-yellow-500/20 text-yellow-400",
};

export default async function AdminKnowledgePage() {
  const session = await auth();

  // Check admin access
  const currentUser = await prisma.user.findUnique({
    where: { id: session!.user.id },
  });

  if (currentUser?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Fetch all knowledge atoms grouped by user
  const [globalStats, userStats, recentAtoms] = await Promise.all([
    // Global stats
    prisma.knowledgeAtom.aggregate({
      _count: true,
      _sum: {
        usageCount: true,
        helpfulCount: true,
      },
    }),
    // Stats per user (Enterprise users with atoms)
    prisma.$queryRaw<Array<{
      userId: string;
      userName: string | null;
      userEmail: string;
      atomCount: bigint;
      totalUsage: bigint;
      totalHelpful: bigint;
    }>>`
      SELECT
        u.id as "userId",
        u.name as "userName",
        u.email as "userEmail",
        COUNT(k.id) as "atomCount",
        COALESCE(SUM(k."usageCount"), 0) as "totalUsage",
        COALESCE(SUM(k."helpfulCount"), 0) as "totalHelpful"
      FROM "User" u
      LEFT JOIN "KnowledgeAtom" k ON k."userId" = u.id
      WHERE k.id IS NOT NULL
      GROUP BY u.id, u.name, u.email
      ORDER BY COUNT(k.id) DESC
      LIMIT 50
    `,
    // Recent atoms across all users
    prisma.knowledgeAtom.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const totalAtoms = globalStats._count;
  const totalUsage = globalStats._sum.usageCount || 0;
  const totalHelpful = globalStats._sum.helpfulCount || 0;
  const helpfulRate = totalUsage > 0 ? (totalHelpful / totalUsage) * 100 : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Knowledge Base - Admin</h1>
        <p className="mt-1 text-[var(--qm-text-secondary)]">
          Overview of all users&apos; knowledge atoms
        </p>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard padding="sm">
          <p className="text-sm text-[var(--qm-text-tertiary)]">Total Atoms</p>
          <p className="text-2xl font-semibold text-white">{totalAtoms}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-sm text-[var(--qm-text-tertiary)]">Users with Atoms</p>
          <p className="text-2xl font-semibold text-white">{userStats.length}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-sm text-[var(--qm-text-tertiary)]">Total Usage</p>
          <p className="text-2xl font-semibold text-white">{totalUsage}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-sm text-[var(--qm-text-tertiary)]">Helpful Rate</p>
          <p className="text-2xl font-semibold text-white">{helpfulRate.toFixed(0)}%</p>
        </GlassCard>
      </div>

      {/* Users Table */}
      <GlassCard padding="md">
        <h2 className="text-lg font-medium text-white mb-4">Knowledge by User</h2>
        {userStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-[var(--qm-text-tertiary)] border-b border-white/10">
                  <th className="pb-3 font-medium">User</th>
                  <th className="pb-3 font-medium text-right">Atoms</th>
                  <th className="pb-3 font-medium text-right">Usage</th>
                  <th className="pb-3 font-medium text-right">Helpful %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {userStats.map((user) => {
                  const helpfulPct = Number(user.totalUsage) > 0
                    ? (Number(user.totalHelpful) / Number(user.totalUsage)) * 100
                    : 0;
                  return (
                    <tr key={user.userId} className="text-sm">
                      <td className="py-3">
                        <div>
                          <p className="text-white font-medium">{user.userName || "—"}</p>
                          <p className="text-[var(--qm-text-tertiary)] text-xs">{user.userEmail}</p>
                        </div>
                      </td>
                      <td className="py-3 text-right text-white">{Number(user.atomCount)}</td>
                      <td className="py-3 text-right text-[var(--qm-text-secondary)]">{Number(user.totalUsage)}</td>
                      <td className="py-3 text-right">
                        <span className={
                          helpfulPct >= 70 ? "text-green-400" :
                          helpfulPct >= 40 ? "text-yellow-400" :
                          "text-[var(--qm-text-tertiary)]"
                        }>
                          {helpfulPct.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[var(--qm-text-tertiary)] text-center py-8">
            No knowledge atoms yet
          </p>
        )}
      </GlassCard>

      {/* Recent Atoms */}
      <GlassCard padding="md">
        <h2 className="text-lg font-medium text-white mb-4">Recent Extractions</h2>
        {recentAtoms.length > 0 ? (
          <div className="space-y-3">
            {recentAtoms.map((atom) => (
              <div
                key={atom.id}
                className="p-3 rounded-lg bg-white/5 border border-white/5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[atom.type]}`}>
                    {TYPE_LABELS[atom.type]}
                  </span>
                  <span className="text-xs text-[var(--qm-text-tertiary)]">
                    {atom.user.name || atom.user.email}
                  </span>
                  <span className="text-xs text-[var(--qm-text-tertiary)]">
                    • {new Date(atom.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-white line-clamp-2">{atom.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--qm-text-tertiary)] text-center py-8">
            No recent extractions
          </p>
        )}
      </GlassCard>
    </div>
  );
}
