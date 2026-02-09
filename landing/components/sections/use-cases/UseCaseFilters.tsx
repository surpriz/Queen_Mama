"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { categories, type Category } from "./data";

interface UseCaseFiltersProps {
  selectedCategory: Category | "all";
  onCategoryChange: (category: Category | "all") => void;
  isSticky?: boolean;
}

function CategoryIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const icons: Record<string, React.ReactNode> = {
    briefcase: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    ),
    "trending-up": (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    ),
    users: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    ),
    presentation: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
      />
    ),
    "graduation-cap": (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
      />
    ),
    heart: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    ),
    all: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    ),
  };

  return (
    <svg
      className={cn("w-4 h-4", className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      {icons[icon] || icons.all}
    </svg>
  );
}

export function UseCaseFilters({
  selectedCategory,
  onCategoryChange,
  isSticky = false,
}: UseCaseFiltersProps) {
  const t = useTranslations("UseCases");

  return (
    <div
      className={cn(
        "py-4 transition-all duration-300 z-40",
        isSticky &&
          "sticky top-16 md:top-20 bg-[var(--qm-bg-primary)]/90 backdrop-blur-xl border-b border-[var(--qm-border-subtle)]"
      )}
    >
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {/* All Filter */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onCategoryChange("all")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
            selectedCategory === "all"
              ? "bg-gradient-to-r from-[var(--qm-purple)] to-[var(--qm-blue)] text-white shadow-lg shadow-[var(--qm-purple)]/25"
              : "bg-[var(--qm-surface-medium)] text-[var(--qm-text-secondary)] hover:text-white hover:bg-[var(--qm-surface-hover)] border border-[var(--qm-border-subtle)]"
          )}
        >
          <CategoryIcon icon="all" />
          <span>{t("filters.all")}</span>
        </motion.button>

        {/* Category Filters */}
        {categories.map((category) => (
          <motion.button
            key={category.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
              selectedCategory === category.id
                ? "text-white shadow-lg"
                : "bg-[var(--qm-surface-medium)] text-[var(--qm-text-secondary)] hover:text-white hover:bg-[var(--qm-surface-hover)] border border-[var(--qm-border-subtle)]"
            )}
            style={
              selectedCategory === category.id
                ? {
                    background: category.color,
                    boxShadow: `0 10px 30px -10px ${category.color}50`,
                  }
                : undefined
            }
          >
            <CategoryIcon
              icon={category.icon}
              className={
                selectedCategory === category.id
                  ? "text-white"
                  : `text-[${category.color}]`
              }
            />
            <span>{t(`categories.${category.id}`)}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
