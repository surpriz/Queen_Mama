import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { GlassCard } from "@/components/ui";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const session = await prisma.syncedSession.findUnique({
    where: { id },
    select: { title: true },
  });

  return {
    title: session?.title ? `${session.title} - Queen Mama` : "Session - Queen Mama",
  };
}

export default async function SessionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const authSession = await auth();

  const session = await prisma.syncedSession.findUnique({
    where: { id },
    include: {
      aiResponses: {
        orderBy: { timestamp: "asc" },
      },
    },
  });

  if (!session || session.userId !== authSession!.user.id) {
    notFound();
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard/sessions"
            className="inline-flex items-center gap-1 text-sm text-[var(--qm-text-secondary)] hover:text-white mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Sessions
          </Link>
          <h1 className="text-2xl font-bold text-white">{session.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--qm-text-tertiary)]">
            <span>{formatDate(session.startTime)}</span>
            <span>{formatTime(session.startTime)}</span>
            {session.duration && <span>{formatDuration(session.duration)}</span>}
          </div>
        </div>
      </div>

      {/* Summary */}
      {session.summary && (
        <GlassCard padding="lg">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--qm-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Summary
          </h2>
          <div className="prose prose-invert prose-sm max-w-none text-[var(--qm-text-secondary)]">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-xl font-bold text-white mb-3">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold text-white mb-2 mt-4">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-medium text-white mb-2 mt-3">{children}</h3>,
                p: ({ children }) => <p className="text-[var(--qm-text-secondary)] mb-3">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 text-[var(--qm-text-secondary)]">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-[var(--qm-text-secondary)]">{children}</ol>,
                li: ({ children }) => <li className="text-[var(--qm-text-secondary)]">{children}</li>,
                strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
              }}
            >
              {session.summary}
            </ReactMarkdown>
          </div>
        </GlassCard>
      )}

      {/* Action Items */}
      {session.actionItems && session.actionItems.length > 0 && (
        <GlassCard padding="lg">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--qm-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Action Items
          </h2>
          <ul className="space-y-2">
            {session.actionItems.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded border border-[var(--qm-border)] flex items-center justify-center mt-0.5">
                  <span className="text-xs text-[var(--qm-text-tertiary)]">{index + 1}</span>
                </span>
                <span className="text-[var(--qm-text-secondary)]">{item}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Transcript */}
      {session.transcript && (
        <GlassCard padding="lg">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--qm-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Transcript
          </h2>
          <div className="bg-[var(--qm-surface)] rounded-lg p-4 max-h-96 overflow-y-auto">
            <p className="text-[var(--qm-text-secondary)] whitespace-pre-wrap text-sm font-mono">
              {session.transcript}
            </p>
          </div>
        </GlassCard>
      )}

      {/* AI Responses */}
      {session.aiResponses.length > 0 && (
        <GlassCard padding="lg">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--qm-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Responses ({session.aiResponses.length})
          </h2>
          <div className="space-y-4">
            {session.aiResponses.map((response) => (
              <div key={response.id} className="border border-[var(--qm-border)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-[var(--qm-surface-hover)] text-xs text-[var(--qm-accent)] capitalize">
                      {response.type}
                    </span>
                    <span className="text-xs text-[var(--qm-text-tertiary)]">
                      via {response.provider}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--qm-text-tertiary)]">
                    {formatTime(response.timestamp)}
                  </span>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="text-[var(--qm-text-secondary)] text-sm mb-2">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside text-sm text-[var(--qm-text-secondary)]">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-[var(--qm-text-secondary)]">{children}</ol>,
                      strong: ({ children }) => <strong className="text-white">{children}</strong>,
                    }}
                  >
                    {response.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
