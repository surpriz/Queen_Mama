"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

const baseNavigation = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: "Sessions",
    href: "/dashboard/sessions",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    name: "Account",
    href: "/dashboard/account",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    name: "Billing",
    href: "/dashboard/billing",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
];

const adminNavigation = {
  name: "Admin Panel",
  href: "/dashboard/admin",
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
};

export function Sidebar({ userRole }: { userRole?: UserRole }) {
  const pathname = usePathname();

  // Build navigation based on user role
  const navigation = userRole === "ADMIN"
    ? [...baseNavigation, adminNavigation]
    : baseNavigation;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-[var(--qm-bg-secondary)] border-r border-[var(--qm-border-subtle)] px-6 pb-4">
        <div className="flex h-16 shrink-0 items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full gradient-bg" />
            <span className="text-xl font-bold gradient-text">Queen Mama</span>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-x-3 rounded-[var(--qm-radius-md)] p-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[var(--qm-surface-hover)] text-white"
                        : "text-[var(--qm-text-secondary)] hover:bg-[var(--qm-surface-light)] hover:text-white"
                    )}
                  >
                    <span className={cn(
                      "transition-colors",
                      isActive ? "text-[var(--qm-accent)]" : "text-[var(--qm-text-tertiary)] group-hover:text-white"
                    )}>
                      {item.icon}
                    </span>
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto space-y-2">
          <Link
            href="/#download"
            className="flex items-center gap-x-3 rounded-[var(--qm-radius-md)] p-3 text-sm font-semibold gradient-bg text-white hover:opacity-90 transition-opacity"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download App
          </Link>
          <Link
            href="/"
            className="flex items-center gap-x-3 rounded-[var(--qm-radius-md)] p-3 text-sm font-medium text-[var(--qm-text-secondary)] hover:bg-[var(--qm-surface-light)] hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    </aside>
  );
}
