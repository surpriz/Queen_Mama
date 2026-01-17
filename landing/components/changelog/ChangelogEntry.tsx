"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { ChangelogSection as ChangelogSectionComponent } from "./ChangelogSection";
import { ChangelogBadge } from "./ChangelogBadge";
import type { ChangelogSection } from "@/lib/changelog-data";

interface ChangelogEntryProps {
  date: string;
  isNew?: boolean;
  sections: ChangelogSection[];
}

export function ChangelogEntry({ date, isNew, sections }: ChangelogEntryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <GlassCard className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[var(--qm-text-primary)]">
            {date}
          </h2>
          <ChangelogBadge isNew={isNew} />
        </div>

        {sections.map((section, index) => (
          <ChangelogSectionComponent
            key={`${section.category}-${index}`}
            category={section.category}
            changes={section.changes}
          />
        ))}
      </GlassCard>
    </motion.div>
  );
}
