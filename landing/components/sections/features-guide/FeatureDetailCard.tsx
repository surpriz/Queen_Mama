"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard, Badge, KeyboardShortcut } from "@/components/ui";
import type { Feature } from "./data";

interface FeatureDetailCardProps {
  feature: Feature;
  categoryColor: string;
}

const planLabels: Record<string, { label: string; variant: "accent" | "warning" | "success" }> = {
  pro: { label: "Pro", variant: "accent" },
  enterprise: { label: "Enterprise", variant: "warning" },
};

export function FeatureDetailCard({ feature, categoryColor }: FeatureDetailCardProps) {
  const [activeSubType, setActiveSubType] = useState(0);
  const planBadge = planLabels[feature.planRequired];

  const currentSteps =
    feature.subTypes && feature.subTypes.length > 0
      ? feature.subTypes[activeSubType].steps
      : feature.howToUse;

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
                {feature.title}
              </h3>
              <p className="text-sm text-[var(--qm-text-tertiary)]">
                {feature.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {planBadge && (
              <Badge variant={planBadge.variant} size="sm">
                {planBadge.label}
              </Badge>
            )}
            {feature.shortcuts.length > 0 && (
              <KeyboardShortcut shortcut={feature.shortcuts[0].keys} size="sm" />
            )}
          </div>
        </div>

        {/* What it is */}
        <div className="px-4 py-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)] text-sm text-[var(--qm-text-secondary)]">
          {feature.whatItIs}
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
                {sub.label}
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
              {feature.subTypes[activeSubType].description}
            </motion.p>
          </AnimatePresence>
        </div>
      )}

      {/* Body: How to Use + What Happens / Why Valuable */}
      <div className="p-6 pt-4 grid md:grid-cols-[1.2fr_1fr] gap-6">
        {/* Left: How to Use */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--qm-text-tertiary)] mb-4">
            How to Use
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
                        {step.action}
                      </p>
                      <p className="text-xs text-[var(--qm-text-tertiary)] mt-0.5">
                        → {step.result}
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
              What Happens
            </h4>
            <p className="text-sm text-[var(--qm-text-secondary)] leading-relaxed">
              {feature.whatHappens}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--qm-text-tertiary)] mb-2">
              Why It&apos;s Valuable
            </h4>
            <p className="text-sm text-[var(--qm-text-secondary)] leading-relaxed">
              {feature.whyValuable}
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
                {sc.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
