"use client";

import { motion } from "framer-motion";
import { Container, GlassCard } from "@/components/ui";
import { useTranslations } from "next-intl";

const stepKeys = ["step1", "step2", "step3"] as const;
const stepNumbers = ["01", "02", "03"];

const stepIcons = [
  <svg key="0" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>,
  <svg key="1" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
  </svg>,
  <svg key="2" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>,
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut" as const,
    },
  },
};

export function HowMemoryPalaceWorks() {
  const t = useTranslations("MemoryPalace");

  return (
    <section className="py-24 relative bg-[var(--qm-bg-secondary)]">
      <Container>
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {t.rich("howItWorks.title", {
              highlight: (chunks) => (
                <span className="gradient-text">{chunks}</span>
              ),
            })}
          </h2>
          <p className="text-lg text-[var(--qm-text-secondary)] max-w-2xl mx-auto">
            {t("howItWorks.description")}
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid md:grid-cols-3 gap-8"
        >
          {stepKeys.map((stepKey, index) => (
            <motion.div key={stepKey} variants={itemVariants}>
              <div className="relative h-full">
                {/* Connecting Line (desktop only) */}
                {index < stepKeys.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-[var(--qm-border-medium)] to-transparent z-0" />
                )}

                <GlassCard className="h-full relative z-10">
                  {/* Step Number */}
                  <div className="absolute -top-4 -left-2 w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-bold text-sm shadow-[var(--qm-shadow-glow)]">
                    {stepNumbers[index]}
                  </div>

                  <div className="pt-4">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-[rgba(139,92,246,0.15)] flex items-center justify-center text-[var(--qm-accent)] mb-4">
                      {stepIcons[index]}
                    </div>

                    {/* Content */}
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {t(`howItWorks.${stepKey}.title`)}
                    </h3>
                    <p className="text-sm text-[var(--qm-text-secondary)] mb-4">
                      {t(`howItWorks.${stepKey}.description`)}
                    </p>

                    {/* Details */}
                    <ul className="space-y-2">
                      {(["detail1", "detail2", "detail3"] as const).map((detailKey) => (
                        <li
                          key={detailKey}
                          className="flex items-center gap-2 text-xs text-[var(--qm-text-tertiary)]"
                        >
                          <svg
                            className="w-3 h-3 text-[var(--qm-success)] flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {t(`howItWorks.${stepKey}.${detailKey}`)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
