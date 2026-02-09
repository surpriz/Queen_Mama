"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { GlassCard, Badge, KeyboardShortcut } from "@/components/ui";
import type { Feature } from "./data";

interface FeatureDetailCardProps {
  feature: Feature;
  categoryColor: string;
}

export function FeatureDetailCard({ feature, categoryColor }: FeatureDetailCardProps) {
  const t = useTranslations("FeaturesGuide");
  const [activeSubType, setActiveSubType] = useState(0);

  const planBadges: Record<string, { variant: "accent" | "warning" | "success" }> = {
    pro: { variant: "accent" },
    enterprise: { variant: "warning" },
  };
  const planBadge = planBadges[feature.planRequired];

  const currentSteps =
    feature.subTypes && feature.subTypes.length > 0
      ? feature.subTypes[activeSubType].steps
      : feature.howToUse;

  const currentSubTypeId =
    feature.subTypes && feature.subTypes.length > 0
      ? feature.subTypes[activeSubType].id
      : null;

  return (
    <GlassCard hover={false} padding="none" id={feature.id}>
      {/* Top accent line */}
      <div className="h-0.5" style={{ backgroundColor: categoryColor }} />

      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-[var(--qm-radius-md)] flex items-center justify-center text-lg"
              style={{ backgroundColor: `${categoryColor}20` }}
            >
              {feature.icon}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">
                {t(`features.${feature.id}.title`)}
              </h3>
              <p className="text-sm text-[var(--qm-text-tertiary)]">
                {t(`features.${feature.id}.subtitle`)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {planBadge && (
              <Badge variant={planBadge.variant} size="sm">
                {t(`detail.${feature.planRequired}`)}
              </Badge>
            )}
            {feature.shortcuts.length > 0 && (
              <KeyboardShortcut shortcut={feature.shortcuts[0].keys} size="sm" />
            )}
          </div>
        </div>

        {/* What it is */}
        <div className="px-4 py-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)] text-sm text-[var(--qm-text-secondary)]">
          {t(`features.${feature.id}.whatItIs`)}
        </div>
      </div>

      {/* Sub-type tabs for AI Assistant */}
      {feature.subTypes && feature.subTypes.length > 0 && (
        <div className="px-6 pb-2">
          <div className="flex gap-1 p-1 rounded-full bg-[var(--qm-surface-light)] overflow-x-auto">
            {feature.subTypes.map((sub, idx) => (
              <button
                key={sub.id}
                onClick={() => setActiveSubType(idx)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all duration-200 ${
                  idx === activeSubType
                    ? "bg-[var(--qm-surface-hover)] text-white"
                    : "text-[var(--qm-text-tertiary)] hover:text-[var(--qm-text-secondary)]"
                }`}
              >
                {t(`features.${feature.id}.subTypes.${sub.id}.label`)}
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={feature.subTypes[activeSubType].id}
              className="mt-3 text-sm text-[var(--qm-text-secondary)]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {t(`features.${feature.id}.subTypes.${feature.subTypes[activeSubType].id}.description`)}
            </motion.p>
          </AnimatePresence>
        </div>
      )}

      {/* Body: How to Use + What Happens / Why Valuable */}
      <div className="p-6 pt-4 grid md:grid-cols-[1.2fr_1fr] gap-6">
        {/* Left: How to Use */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--qm-text-tertiary)] mb-4">
            {t("detail.howToUse")}
          </h4>
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-[11px] top-3 bottom-3 w-px bg-[var(--qm-border-subtle)]" />
            <AnimatePresence mode="wait">
              <motion.div
                key={feature.subTypes ? feature.subTypes[activeSubType].id : "default"}
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {currentSteps.map((step, idx) => (
                  <div key={idx} className="flex gap-3 relative">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10"
                      style={{
                        backgroundColor: `${categoryColor}30`,
                        color: categoryColor,
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white leading-relaxed">
                        {currentSubTypeId
                          ? t(`features.${feature.id}.subTypes.${currentSubTypeId}.steps.${idx}.action`)
                          : t(`features.${feature.id}.steps.${idx}.action`)}
                      </p>
                      <p className="text-xs text-[var(--qm-text-tertiary)] mt-0.5">
                        &rarr;{" "}
                        {currentSubTypeId
                          ? t(`features.${feature.id}.subTypes.${currentSubTypeId}.steps.${idx}.result`)
                          : t(`features.${feature.id}.steps.${idx}.result`)}
                      </p>
                    </div>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Right: What Happens + Why Valuable */}
        <div className="space-y-5">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--qm-text-tertiary)] mb-2">
              {t("detail.whatHappens")}
            </h4>
            <p className="text-sm text-[var(--qm-text-secondary)] leading-relaxed">
              {t(`features.${feature.id}.whatHappens`)}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--qm-text-tertiary)] mb-2">
              {t("detail.whyValuable")}
            </h4>
            <p className="text-sm text-[var(--qm-text-secondary)] leading-relaxed">
              {t(`features.${feature.id}.whyValuable`)}
            </p>
          </div>
        </div>
      </div>

      {/* Footer: Shortcuts */}
      {feature.shortcuts.length > 1 && (
        <div className="px-6 py-4 border-t border-[var(--qm-border-subtle)] flex flex-wrap items-center gap-4">
          {feature.shortcuts.map((sc) => (
            <div key={sc.keys} className="flex items-center gap-2">
              <KeyboardShortcut shortcut={sc.keys} size="sm" />
              <span className="text-xs text-[var(--qm-text-tertiary)]">
                {t(`features.${feature.id}.shortcuts.${sc.keys}.label`)}
              </span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
