"use client";

import { Badge } from "@/components/ui/Badge";

interface ChangelogBadgeProps {
  isNew?: boolean;
}

export function ChangelogBadge({ isNew }: ChangelogBadgeProps) {
  if (!isNew) return null;

  return (
    <Badge variant="accent" className="animate-pulse">
      New
    </Badge>
  );
}
