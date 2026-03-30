import Link from "next/link";

export default function MiniFooter() {
  return (
    <footer className="py-8 border-t border-[var(--qm-border-subtle)]">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link
          href="/"
          className="text-sm font-semibold text-[var(--qm-text-secondary)] hover:text-[var(--qm-text-primary)] transition-colors"
        >
          Queen Mama
        </Link>
        <div className="flex items-center gap-4 text-xs text-[var(--qm-text-tertiary)]">
          <Link href="/privacy" className="hover:text-[var(--qm-text-secondary)] transition-colors">
            Confidentialité
          </Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-[var(--qm-text-secondary)] transition-colors">
            Conditions
          </Link>
          <span>·</span>
          <Link href="/" className="hover:text-[var(--qm-text-secondary)] transition-colors">
            queenmama.co
          </Link>
        </div>
      </div>
    </footer>
  );
}
