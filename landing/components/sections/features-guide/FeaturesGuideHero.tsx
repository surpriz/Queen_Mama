"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui";
import { Badge } from "@/components/ui";

export function FeaturesGuideHero() {
  const t = useTranslations("FeaturesGuide");

  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[var(--qm-purple)] rounded-full opacity-[0.08] blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-[var(--qm-blue)] rounded-full opacity-[0.08] blur-[120px]" />
      </div>

      <Container size="xl">
        <motion.div
          className="text-center max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <Badge variant="accent" className="mb-6">
            {t("hero.badge")}
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            {t.rich("hero.title", {
              highlight: (chunks) => (
                <span className="gradient-text">{chunks}</span>
              ),
            })}
          </h1>

          <p className="text-lg sm:text-xl text-[var(--qm-text-secondary)] mb-10 max-w-2xl mx-auto">
            {t("hero.description")}
          </p>

          {/* Stats strip */}
          <motion.div
            className="inline-flex items-center gap-6 sm:gap-8 px-6 sm:px-8 py-4 rounded-full bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-white">12</div>
              <div className="text-xs text-[var(--qm-text-tertiary)]">
                {t("hero.statFeatures")}
              </div>
            </div>
            <div className="w-px h-8 bg-[var(--qm-border-subtle)]" />
            <div className="text-center">
              <div className="text-2xl font-bold text-white">9</div>
              <div className="text-xs text-[var(--qm-text-tertiary)]">
                {t("hero.statShortcuts")}
              </div>
            </div>
            <div className="w-px h-8 bg-[var(--qm-border-subtle)]" />
            <div className="text-center">
              <div className="text-2xl font-bold text-white">5</div>
              <div className="text-xs text-[var(--qm-text-tertiary)]">
                {t("hero.statModes")}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
