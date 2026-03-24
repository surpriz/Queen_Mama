"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Container, GlassCard, Badge } from "@/components/ui";

export function Modes() {
  const t = useTranslations("Modes");
  const [activeMode, setActiveMode] = useState("interview");

  const modes = [
    {
      id: "default",
      name: t("default.name"),
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      ),
      description: t("default.description"),
      features: [
        t("default.feature1"),
        t("default.feature2"),
        t("default.feature3"),
      ],
      example: t("default.example"),
    },
    {
      id: "interview",
      name: t("interview.name"),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      description: t("interview.description"),
      features: [
        t("interview.feature1"),
        t("interview.feature2"),
        t("interview.feature3"),
      ],
      example: t("interview.example"),
    },
    {
      id: "sales",
      name: t("sales.name"),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      description: t("sales.description"),
      features: [
        t("sales.feature1"),
        t("sales.feature2"),
        t("sales.feature3"),
      ],
      example: t("sales.example"),
    },
    {
      id: "professional",
      name: t("professional.name"),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      description: t("professional.description"),
      features: [
        t("professional.feature1"),
        t("professional.feature2"),
        t("professional.feature3"),
      ],
      example: t("professional.example"),
    },
    {
      id: "limitless",
      name: t("limitless.name"),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      description: t("limitless.description"),
      features: [
        t("limitless.feature1"),
        t("limitless.feature2"),
        t("limitless.feature3"),
      ],
      example: t("limitless.example"),
    },
    {
      id: "developerExam",
      name: t("developerExam.name"),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
      description: t("developerExam.description"),
      features: [
        t("developerExam.feature1"),
        t("developerExam.feature2"),
        t("developerExam.feature3"),
      ],
      example: t("developerExam.example"),
    },
  ];

  const currentMode = modes.find((m) => m.id === activeMode) || modes[0];

  return (
    <section id="modes" className="py-24 relative">
      {/* Background Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--qm-purple)] rounded-full blur-[200px] opacity-10" />
      </div>

      <Container className="relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {t.rich("title", {
              highlight: (chunks) => <span className="gradient-text">{chunks}</span>,
            })}
          </h2>
          <p className="text-lg text-[var(--qm-text-secondary)] max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </motion.div>

        {/* Mode Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium transition-all duration-200 ${
                activeMode === mode.id
                  ? "bg-gradient-to-r from-[var(--qm-purple)] to-[var(--qm-blue)] text-white shadow-[var(--qm-shadow-glow)]"
                  : "bg-[var(--qm-surface-medium)] text-[var(--qm-text-secondary)] hover:text-white hover:bg-[var(--qm-surface-hover)]"
              }`}
            >
              <span className={activeMode === mode.id ? "text-white" : "text-[var(--qm-accent)]"}>
                {mode.icon}
              </span>
              {mode.name}
            </button>
          ))}
        </motion.div>

        {/* Mode Detail */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard padding="lg" hover={false} className="max-w-4xl mx-auto">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Left - Info */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-[rgba(139,92,246,0.15)] flex items-center justify-center text-[var(--qm-accent)]">
                        {currentMode.icon}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">
                          {t("modeLabel", { name: currentMode.name })}
                        </h3>
                        <p className="text-sm text-[var(--qm-text-tertiary)]">
                          {currentMode.description}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {currentMode.features.map((feature, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-[var(--qm-text-secondary)]"
                        >
                          <svg
                            className="w-4 h-4 text-[var(--qm-success)] flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6">
                      <Badge variant="accent" size="sm">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        {t("createCustom")}
                      </Badge>
                    </div>
                  </div>

                  {/* Right - Example */}
                  <div className="bg-[var(--qm-bg-secondary)] rounded-xl p-4 border border-[var(--qm-border-subtle)]">
                    <div className="flex items-center gap-2 mb-3">
                      <svg
                        className="w-4 h-4 text-[var(--qm-accent)]"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      <span className="text-xs font-medium text-[var(--qm-text-tertiary)] uppercase tracking-wide">
                        {t("exampleResponse")}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--qm-text-secondary)] leading-relaxed italic">
                      &ldquo;{currentMode.example}&rdquo;
                    </p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </Container>
    </section>
  );
}
