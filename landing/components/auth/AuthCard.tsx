"use client";

import { GlassCard } from "@/components/ui";
import Link from "next/link";

interface AuthCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: {
    text: string;
    linkText: string;
    linkHref: string;
  };
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--qm-bg-primary)] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-full gradient-bg" />
            <span className="text-2xl font-bold gradient-text">Queen Mama</span>
          </Link>
          <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
          <p className="text-[var(--qm-text-secondary)]">{description}</p>
        </div>

        <GlassCard hover={false} padding="lg">
          {children}
        </GlassCard>

        {footer && (
          <p className="mt-6 text-center text-[var(--qm-text-secondary)]">
            {footer.text}{" "}
            <Link
              href={footer.linkHref}
              className="text-[var(--qm-accent)] hover:text-[var(--qm-accent-light)] transition-colors"
            >
              {footer.linkText}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
