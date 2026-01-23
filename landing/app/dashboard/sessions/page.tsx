import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GlassCard } from "@/components/ui";
import Link from "next/link";
import { DeleteSessionButton } from "./DeleteSessionButton";

export const metadata = {
  title: "Sessions - Queen Mama",
  description: "View your Queen Mama session history",
};

export default async function SessionsPage() {
  const session = await auth();

  const sessions = await prisma.syncedSession.findMany({
    where: { userId: session!.user.id },
    orderBy: { startTime: "desc" },
    include: {
      _count: {
        select: { aiResponses: true },
      },
    },
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // Strip markdown syntax for preview
  const stripMarkdown = (text: string) => {
    return text
      .replace(/#{1,6}\s?/g, "") // Remove headers
      .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold
      .replace(/\*([^*]+)\*/g, "$1") // Remove italic
      .replace(/__([^_]+)__/g, "$1") // Remove bold (underscore)
      .replace(/_([^_]+)_/g, "$1") // Remove italic (underscore)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links
      .replace(/`([^`]+)`/g, "$1") // Remove inline code
      .replace(/^[-*+]\s/gm, "") // Remove list markers
      .replace(/^\d+\.\s/gm, "") // Remove numbered list markers
      .replace(/\n{2,}/g, " ") // Replace multiple newlines with space
      .replace(/\n/g, " ") // Replace single newlines with space
      .trim();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Sessions</h1>
        <p className="mt-1 text-[var(--qm-text-secondary)]">
          View and manage your Queen Mama session history
        </p>
      </div>

      {sessions.length > 0 ? (
        <div className="space-y-4">
          {sessions.map((s) => (
            <Link key={s.id} href={`/dashboard/sessions/${s.id}`}>
              <GlassCard padding="md" className="cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-white truncate">{s.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--qm-text-tertiary)]">
                      <span>
                        {new Date(s.startTime).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span>
                        {new Date(s.startTime).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {s.duration && <span>{formatDuration(s.duration)}</span>}
                      {s.modeUsed && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--qm-surface-hover)] text-xs">
                          {s.modeUsed}
                        </span>
                      )}
                    </div>
                    {s.summary && (
                      <p className="mt-2 text-sm text-[var(--qm-text-secondary)] line-clamp-2">
                        {stripMarkdown(s.summary)}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--qm-text-tertiary)]">
                        {s._count.aiResponses} AI responses
                      </span>
                      <DeleteSessionButton sessionId={s.id} sessionTitle={s.title} />
                    </div>
                    <svg
                      className="w-5 h-5 text-[var(--qm-text-tertiary)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </GlassCard>
            </Link>
          ))}
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">No sessions yet</h3>
            <p className="text-[var(--qm-text-secondary)] max-w-md mx-auto">
              Sessions will appear here once you start using Queen Mama on your Mac.
              Make sure you&apos;re signed in with the same account in the app.
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
