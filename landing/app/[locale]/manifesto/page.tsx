"use client";

import { motion } from "framer-motion";
import { Container, GradientButton } from "@/components/ui";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { useTranslations } from "next-intl";

export default function ManifestoPage() {
  const t = useTranslations("Manifesto");
  return (
    <>
      <Navbar />
      <main className="pt-32 pb-24 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-[var(--qm-purple)] rounded-full blur-[200px] opacity-15" />
          <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-[var(--qm-blue)] rounded-full blur-[200px] opacity-15" />
        </div>

        <Container size="md" className="relative z-10">
          {/* Opening */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-8">
              {t.rich("headline", {
                highlight: (chunks) => <span className="gradient-text">{chunks}</span>,
              })}
            </h1>
            <p className="text-xl sm:text-2xl text-[var(--qm-text-secondary)]">
              {t("subheadline")}
            </p>
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-16"
          >
            {/* Section 1 */}
            <section className="space-y-6">
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                {t("section1p1")}
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                {t("section1p2")}
              </p>
              <p className="text-2xl text-white font-medium">
                {t("section1p3")}
              </p>
            </section>

            {/* Section 2 - The History */}
            <section className="space-y-6">
              <h2 className="text-3xl font-bold text-white">
                {t("section2title")}
              </h2>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                {t("section2p1")}
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                {t("section2p2")}
              </p>
              <p className="text-xl text-white font-medium">
                {t("section2p3")}
              </p>
            </section>

            {/* Section 3 - The Reality */}
            <section className="space-y-6">
              <h2 className="text-3xl font-bold text-white">
                {t("section3title")}
              </h2>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                {t("section3p1")}
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                {t("section3p2")}
              </p>
              <p className="text-xl text-white font-medium">
                {t("section3p3")}
              </p>
            </section>

            {/* Section 4 - The Truth */}
            <section className="py-12 border-y border-[var(--qm-border-subtle)]">
              <blockquote className="text-3xl sm:text-4xl font-bold text-center leading-tight">
                <span className="gradient-text">
                  {t("section4quote")}
                </span>
              </blockquote>
            </section>

            {/* Section 5 - The Shift */}
            <section className="space-y-6">
              <h2 className="text-3xl font-bold text-white">
                {t("section5title")}
              </h2>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                {t("section5p1")}
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                {t("section5p2")}
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                {t("section5p3")}
              </p>
              <p className="text-xl text-white font-medium">
                {t("section5p4")}
              </p>
            </section>

            {/* Section 6 - The Privacy Promise */}
            <section className="space-y-6">
              <h2 className="text-3xl font-bold text-white">
                {t("section6title")}
              </h2>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                {t("section6p1")}
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                {t.rich("section6p2", {
                  gone: (chunks) => <span className="text-white">{chunks}</span>,
                })}
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                {t("section6p3")}
              </p>
            </section>

            {/* Section 7 - The Choice */}
            <section className="space-y-6">
              <h2 className="text-3xl font-bold text-white">
                {t("section7title")}
              </h2>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                {t("section7p1")}
              </p>
              <p className="text-xl text-white font-medium">{t("section7p2")}</p>
            </section>

            {/* Closing */}
            <section className="text-center pt-8 space-y-8">
              <p className="text-2xl sm:text-3xl font-bold text-white">
                {t("closingLine")}
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)]">
                {t("closingSub")}
              </p>

              <div className="pt-8">
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
                  {t("downloadCTA")}
                </GradientButton>
              </div>
            </section>
          </motion.div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
