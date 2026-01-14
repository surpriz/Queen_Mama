"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface DashboardNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

const mobileNavigation = [
  { name: "Overview", href: "/dashboard" },
  { name: "Sessions", href: "/dashboard/sessions" },
  { name: "Analytics", href: "/dashboard/analytics" },
  { name: "Account", href: "/dashboard/account" },
  { name: "API Keys", href: "/dashboard/account/api-keys" },
  { name: "Billing", href: "/dashboard/billing" },
];

export function DashboardNav({ user }: DashboardNavProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-[var(--qm-border-subtle)] bg-[var(--qm-bg-primary)]/80 backdrop-blur-xl px-4 sm:gap-x-6 sm:px-6 lg:px-8">
      <button
        type="button"
        className="lg:hidden -m-2.5 p-2.5 text-[var(--qm-text-secondary)]"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1 items-center">
          <Link href="/dashboard" className="lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-full gradient-bg" />
            <span className="text-lg font-bold gradient-text">Queen Mama</span>
          </Link>
        </div>

        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-x-3 p-1.5 rounded-full hover:bg-[var(--qm-surface-light)] transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Avatar
                src={user.image}
                fallback={user.name || user.email || "U"}
                size="sm"
              />
              <span className="hidden lg:block text-sm font-medium text-white">
                {user.name || user.email}
              </span>
              <svg className="hidden lg:block w-4 h-4 text-[var(--qm-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-[var(--qm-radius-lg)] bg-[var(--qm-bg-elevated)] border border-[var(--qm-border-subtle)] shadow-[var(--qm-shadow-lg)] py-2">
                  <div className="px-4 py-2 border-b border-[var(--qm-border-subtle)]">
                    <p className="text-sm font-medium text-white truncate">{user.name}</p>
                    <p className="text-xs text-[var(--qm-text-tertiary)] truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/dashboard/account"
                    className="block px-4 py-2 text-sm text-[var(--qm-text-secondary)] hover:bg-[var(--qm-surface-light)] hover:text-white"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Account Settings
                  </Link>
                  <Link
                    href="/dashboard/billing"
                    className="block px-4 py-2 text-sm text-[var(--qm-text-secondary)] hover:bg-[var(--qm-surface-light)] hover:text-white"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Billing
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--qm-error)] hover:bg-[var(--qm-surface-light)]"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-40 w-64 bg-[var(--qm-bg-secondary)] border-r border-[var(--qm-border-subtle)] lg:hidden">
            <div className="flex h-16 items-center px-6 border-b border-[var(--qm-border-subtle)]">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full gradient-bg" />
                <span className="text-xl font-bold gradient-text">Queen Mama</span>
              </Link>
            </div>
            <nav className="p-4">
              <ul className="space-y-1">
                {mobileNavigation.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          "block rounded-[var(--qm-radius-md)] p-3 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-[var(--qm-surface-hover)] text-white"
                            : "text-[var(--qm-text-secondary)] hover:bg-[var(--qm-surface-light)] hover:text-white"
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
