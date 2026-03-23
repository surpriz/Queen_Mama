"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "framer-motion";
import { Container, GradientButton } from "@/components/ui";

export function CTA() {
  const t = useTranslations("CTA");

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-gradient-to-r from-[var(--qm-purple)] to-[var(--qm-blue)] rounded-full blur-[200px] opacity-20" />
      </div>

      <Container className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            {t.rich("title", {
              highlight: (chunks) => <span className="gradient-text">{chunks}</span>,
            })}
          </h2>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-[var(--qm-text-secondary)] mb-10 max-w-2xl mx-auto">
            {t("subtitle")}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
            <Link href="/download">
              <GradientButton size="lg">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                {t("downloadMac")}
              </GradientButton>
            </Link>
            <Link href="/download">
              <GradientButton size="lg" variant="secondary">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t("downloadWindows")}
              </GradientButton>
            </Link>
          </div>

          {/* Trust Note */}
          <p className="text-sm text-[var(--qm-text-tertiary)]">
            {t("trustNote")}
          </p>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-8 sm:gap-16 mt-12 pt-12 border-t border-[var(--qm-border-subtle)]"
          >
            <div className="text-center">
              <p className="text-3xl font-bold gradient-text">4+</p>
              <p className="text-sm text-[var(--qm-text-tertiary)]">{t("statProviders")}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold gradient-text">6</p>
              <p className="text-sm text-[var(--qm-text-tertiary)]">{t("statModes")}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold gradient-text">100%</p>
              <p className="text-sm text-[var(--qm-text-tertiary)]">{t("statUndetectable")}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold gradient-text">Free</p>
              <p className="text-sm text-[var(--qm-text-tertiary)]">{t("statFree")}</p>
            </div>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
