"use client";

import { useState, useEffect, useCallback } from "react";
import { categories } from "./data";

interface TableOfContentsProps {
  activeCategory: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function TableOfContents({
  activeCategory,
  searchQuery,
  onSearchChange,
}: TableOfContentsProps) {
  const scrollToCategory = useCallback((categoryId: string) => {
    const el = document.querySelector(`[data-category-id="${categoryId}"]`);
    if (el) {
      const offset = 100;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:block sticky top-24 self-start" aria-label="Table of contents">
        <div className="space-y-1 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search features..."
            className="w-full px-3 py-2 text-sm bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)] rounded-[var(--qm-radius-md)] text-white placeholder:text-[var(--qm-text-disabled)] focus:outline-none focus:border-[var(--qm-accent)] transition-colors"
          />
        </div>
        <ul className="space-y-1">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <li key={cat.id}>
                <button
                  onClick={() => scrollToCategory(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-[var(--qm-radius-md)] text-sm transition-all duration-200 flex items-center gap-2 ${
                    isActive
                      ? "bg-[var(--qm-surface-hover)] text-white border-l-2"
                      : "text-[var(--qm-text-tertiary)] hover:text-[var(--qm-text-secondary)] hover:bg-[var(--qm-surface-light)]"
                  }`}
                  style={isActive ? { borderLeftColor: cat.accentColor } : undefined}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cat.accentColor }}
                  />
                  <span className="truncate">{cat.label}</span>
                  <span className="ml-auto text-xs text-[var(--qm-text-disabled)]">
                    {cat.features.length}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile horizontal pills */}
      <div className="lg:hidden sticky top-16 z-30 bg-[var(--qm-bg-primary)]/80 backdrop-blur-xl border-b border-[var(--qm-border-subtle)] px-4 py-3">
        <div className="mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search features..."
            className="w-full px-3 py-2 text-sm bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)] rounded-full text-white placeholder:text-[var(--qm-text-disabled)] focus:outline-none focus:border-[var(--qm-accent)] transition-colors"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? "text-white"
                    : "bg-[var(--qm-surface-light)] text-[var(--qm-text-tertiary)]"
                }`}
                style={
                  isActive
                    ? { backgroundColor: `${cat.accentColor}30`, color: cat.accentColor }
                    : undefined
                }
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// Hook for IntersectionObserver active tracking
export function useActiveCategoryTracking() {
  const [activeCategory, setActiveCategory] = useState(categories[0].id);

  useEffect(() => {
    const elements = categories.map((cat) =>
      document.querySelector(`[data-category-id="${cat.id}"]`)
    );

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.categoryId;
            if (id) setActiveCategory(id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    elements.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return activeCategory;
}
