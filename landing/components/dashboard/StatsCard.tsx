"use client";

import { GlassCard } from "@/components/ui";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: "up" | "down" | "neutral";
  };
  icon?: React.ReactNode;
}

export function StatsCard({ title, value, change, icon }: StatsCardProps) {
  return (
    <GlassCard hover={false} padding="md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[var(--qm-text-tertiary)]">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {change && (
            <p className={cn(
              "mt-1 text-sm flex items-center gap-1",
              change.trend === "up" && "text-[var(--qm-success)]",
              change.trend === "down" && "text-[var(--qm-error)]",
              change.trend === "neutral" && "text-[var(--qm-text-tertiary)]"
            )}>
              {change.trend === "up" && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
              {change.trend === "down" && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              {change.value > 0 ? "+" : ""}{change.value}% vs last month
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)] text-[var(--qm-accent)]">
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
