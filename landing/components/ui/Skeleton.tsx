"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--qm-radius-md)]",
        "bg-[var(--qm-surface-hover)]",
        className
      )}
    />
  );
}

export { Skeleton };
