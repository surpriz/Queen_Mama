"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getCategoryById, type UseCase } from "./data";

interface UseCaseCardProps {
  useCase: UseCase;
  index: number;
}

export function UseCaseCard({ useCase, index }: UseCaseCardProps) {
  const category = getCategoryById(useCase.category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group relative"
    >
      {/* Glow effect on hover */}
      <div
        className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"
        style={{ background: `${category?.color}30` }}
      />

      {/* Card */}
      <div
        className={cn(
          "relative h-full",
          "bg-[var(--qm-surface-medium)]",
          "backdrop-blur-xl",
          "border border-[var(--qm-border-subtle)]",
          "rounded-xl",
          "overflow-hidden",
          "transition-all duration-300",
          "group-hover:border-opacity-50"
        )}
        style={{
          borderColor:
            "color-mix(in srgb, var(--qm-border-subtle), transparent 50%)",
        }}
      >
        {/* Category Accent Bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: category?.color }}
        />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              {/* Category Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: category?.bgLight }}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  style={{ color: category?.color }}
                >
                  <CategoryIconPath icon={category?.icon || "briefcase"} />
                </svg>
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-white group-hover:text-white/90 transition-colors">
                {useCase.title}
              </h3>
            </div>

            {/* Mode Badge */}
            <span
              className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                background: category?.bgLight,
                color: category?.color,
              }}
            >
              {useCase.mode}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-[var(--qm-text-secondary)] mb-4 leading-relaxed">
            {useCase.description}
          </p>

          {/* AI Suggestion Preview */}
          <div className="relative">
            {/* Widget Simulation */}
            <div className="bg-black/60 rounded-lg border border-[var(--qm-border-subtle)] p-3 overflow-hidden">
              {/* Mini Header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center">
                  <svg
                    className="w-2.5 h-2.5 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <span className="text-[10px] font-medium text-[var(--qm-text-tertiary)] uppercase tracking-wider">
                  QueenMama Suggestion
                </span>
              </div>

              {/* Suggestion Text */}
              <p className="text-sm text-[var(--qm-text-secondary)] italic leading-relaxed line-clamp-3">
                {useCase.suggestion}
              </p>
            </div>

            {/* Sparkle decoration */}
            <div
              className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: category?.bgLight }}
            >
              <svg
                className="w-3 h-3"
                style={{ color: category?.color }}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CategoryIconPath({ icon }: { icon: string }) {
  const paths: Record<string, React.ReactNode> = {
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
  };

  return <>{paths[icon] || paths.briefcase}</>;
}
