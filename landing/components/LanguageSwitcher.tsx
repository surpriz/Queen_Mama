"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("LanguageSwitcher");

  const switchLocale = (newLocale: "en" | "fr") => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="flex items-center gap-1 bg-[var(--qm-surface-medium)] backdrop-blur-sm rounded-full p-0.5 shadow-lg border border-[var(--qm-border-subtle)]">
      <button
        onClick={() => switchLocale("en")}
        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
          locale === "en"
            ? "bg-[var(--qm-surface-hover)] text-white"
            : "text-[var(--qm-text-tertiary)] hover:text-white"
        }`}
        title={t("en")}
      >
        EN
      </button>
      <button
        onClick={() => switchLocale("fr")}
        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
          locale === "fr"
            ? "bg-[var(--qm-surface-hover)] text-white"
            : "text-[var(--qm-text-tertiary)] hover:text-white"
        }`}
        title={t("fr")}
      >
        FR
      </button>
    </div>
  );
}
