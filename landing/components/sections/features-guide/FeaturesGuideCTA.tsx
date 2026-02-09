"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { GradientButton } from "@/components/ui";

export function FeaturesGuideCTA() {
  const t = useTranslations("FeaturesGuide");

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-[var(--qm-purple)] rounded-full opacity-[0.06] blur-[100px]" />
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-[var(--qm-blue)] rounded-full opacity-[0.06] blur-[100px]" />
      </div>

      <motion.div
        className="text-center relative z-10"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          {t("cta.title")}
        </h2>
        <p className="text-lg text-[var(--qm-text-secondary)] mb-8 max-w-xl mx-auto">
          {t("cta.description")}
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/download">
            <GradientButton size="lg">{t("cta.downloadMac")}</GradientButton>
          </Link>
          <Link href="/">
            <GradientButton variant="secondary" size="lg">
              {t("cta.backToHome")}
            </GradientButton>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
