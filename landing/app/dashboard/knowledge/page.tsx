import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { GlassCard } from "@/components/ui";
import { KnowledgeType } from "@prisma/client";
import { DeleteAtomButton } from "./DeleteAtomButton";
import { ManagementPanel } from "./ManagementPanel";
import { LIMITS } from "@/lib/knowledge-management";

export const metadata = {
  title: "Knowledge Base - Queen Mama",
  description: "View and manage your personalized knowledge base",
};

const TYPE_LABELS: Record<KnowledgeType, string> = {
  OBJECTION_RESPONSE: "Objection Handling",
  TALKING_POINT: "Talking Point",
  QUESTION: "Discovery Question",
  CLOSING_TECHNIQUE: "Closing Technique",
  TOPIC_EXPERTISE: "Expertise",
};

const TYPE_COLORS: Record<KnowledgeType, string> = {
  OBJECTION_RESPONSE: "bg-red-500/20 text-red-400",
  TALKING_POINT: "bg-blue-500/20 text-blue-400",
  QUESTION: "bg-green-500/20 text-green-400",
  CLOSING_TECHNIQUE: "bg-purple-500/20 text-purple-400",
  TOPIC_EXPERTISE: "bg-yellow-500/20 text-yellow-400",
};

const TYPE_ICONS: Record<KnowledgeType, string> = {
  OBJECTION_RESPONSE: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  TALKING_POINT: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  QUESTION: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  CLOSING_TECHNIQUE: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  TOPIC_EXPERTISE: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
};

export default async function KnowledgePage() {
  const session = await auth();

  // Check subscription
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    include: { subscription: true },
  });

  if (user?.subscription?.plan !== "ENTERPRISE") {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
          <p className="mt-1 text-[var(--qm-text-secondary)]">
            Your personalized knowledge extracted from conversations
          </p>
        </div>
        <GlassCard hover={false} padding="lg">
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 mx-auto text-[var(--qm-accent)] mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">Enterprise Feature</h3>
            <p className="text-[var(--qm-text-secondary)] max-w-md mx-auto mb-4">
              The Knowledge Base feature extracts valuable patterns from your conversations
              and uses them to personalize AI suggestions. Available on Enterprise plan.
            </p>
            <a
              href="/dashboard/billing"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-[var(--qm-accent)] text-white font-medium hover:bg-[var(--qm-accent)]/90 transition-colors"
            >
              Upgrade to Enterprise
            </a>
          </div>
        </GlassCard>
      </div>
    );
  }

  // Fetch knowledge atoms and stats
  const [atoms, stats, typeStats] = await Promise.all([
    prisma.knowledgeAtom.findMany({
      where: { userId: session!.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        session: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
    prisma.knowledgeAtom.aggregate({
      where: { userId: session!.user.id },
      _count: true,
      _sum: {
        usageCount: true,
        helpfulCount: true,
      },
    }),
    prisma.knowledgeAtom.groupBy({
      by: ["type"],
      where: { userId: session!.user.id },
      _count: { id: true },
    }),
  ]);

  const totalAtoms = stats._count;
  const totalUsage = stats._sum.usageCount || 0;
  const totalHelpful = stats._sum.helpfulCount || 0;
  const helpfulRate = totalUsage > 0 ? (totalHelpful / totalUsage) * 100 : 0;

  const typeCountMap = typeStats.reduce(
    (acc, item) => {
      acc[item.type] = item._count.id;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
        <p className="mt-1 text-[var(--qm-text-secondary)]">
          Your personalized knowledge extracted from conversations
        </p>
      </div>

      {/* Management Panel */}
      <ManagementPanel />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--qm-accent)]/20">
              <svg className="w-5 h-5 text-[var(--qm-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[var(--qm-text-tertiary)]">Total Knowledge</p>
              <p className="text-xl font-semibold text-white">{totalAtoms} <span className="text-sm text-[var(--qm-text-tertiary)] font-normal">/ {LIMITS.MAX_ATOMS_PER_USER}</span></p>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[var(--qm-text-tertiary)]">Times Used</p>
              <p className="text-xl font-semibold text-white">{totalUsage}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[var(--qm-text-tertiary)]">Helpful Rate</p>
              <p className="text-xl font-semibold text-white">{helpfulRate.toFixed(0)}%</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[var(--qm-text-tertiary)]">Categories</p>
              <p className="text-xl font-semibold text-white">{Object.keys(typeCountMap).length}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Type Breakdown */}
      <GlassCard padding="md">
        <h2 className="text-lg font-medium text-white mb-4">Knowledge by Type</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {(Object.keys(TYPE_LABELS) as KnowledgeType[]).map((type) => (
            <div
              key={type}
              className={`p-3 rounded-lg ${TYPE_COLORS[type]} flex items-center gap-2`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={TYPE_ICONS[type]} />
              </svg>
              <div>
                <p className="text-xs opacity-75">{TYPE_LABELS[type]}</p>
                <p className="text-lg font-semibold">{typeCountMap[type] || 0}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Knowledge Atoms List */}
      {atoms.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-white">Your Knowledge Atoms</h2>
          {atoms.map((atom) => {
            const metadata = atom.metadata as { context?: string; confidence?: number } | null;
            const helpfulRatio = atom.usageCount > 0 ? atom.helpfulCount / atom.usageCount : null;

            return (
              <GlassCard key={atom.id} padding="md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[atom.type]}`}>
                        {TYPE_LABELS[atom.type]}
                      </span>
                      {atom.session && (
                        <span className="text-xs text-[var(--qm-text-tertiary)]">
                          from &quot;{atom.session.title}&quot;
                        </span>
                      )}
                    </div>
                    <p className="text-white">{atom.content}</p>
                    {metadata?.context && (
                      <p className="mt-2 text-sm text-[var(--qm-text-secondary)] italic">
                        Context: {metadata.context}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--qm-text-tertiary)]">
                      <span>Used {atom.usageCount} times</span>
                      {helpfulRatio !== null && (
                        <span
                          className={
                            helpfulRatio >= 0.7
                              ? "text-green-400"
                              : helpfulRatio >= 0.4
                                ? "text-yellow-400"
                                : "text-red-400"
                          }
                        >
                          {(helpfulRatio * 100).toFixed(0)}% helpful
                        </span>
                      )}
                      <span>
                        Added{" "}
                        {new Date(atom.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <DeleteAtomButton atomId={atom.id} />
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        <GlassCard hover={false} padding="lg">
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 mx-auto text-[var(--qm-text-tertiary)] mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">No knowledge yet</h3>
            <p className="text-[var(--qm-text-secondary)] max-w-md mx-auto">
              Knowledge atoms will be automatically extracted from your sessions.
              Start some conversations and Queen Mama will learn from your patterns.
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
