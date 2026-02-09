"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";

interface ChangelogBadgeProps {
  isNew?: boolean;
}

export function ChangelogBadge({ isNew }: ChangelogBadgeProps) {
  const t = useTranslations("Changelog");

  if (!isNew) return null;

  return (
    <Badge variant="accent" className="animate-pulse">
      {t("badgeNew")}
    </Badge>
  );
}
