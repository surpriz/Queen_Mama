"use client";

import { motion } from "framer-motion";
import { Container, GlassCard, KeyboardShortcut } from "@/components/ui";

const steps = [
  {
    number: "01",
    title: "Install & Configure",
    description:
      "Download Queen Mama and add your API keys for OpenAI, Claude, or Gemini. Set up takes just minutes.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    details: ["Works with any AI provider", "Secure API key storage", "One-time setup"],
  },
  {
    number: "02",
    title: "Choose Your Mode",
    description:
      "Select the AI mode that matches your situation - Interview, Sales, Professional, or create a custom one.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    details: ["4 built-in modes", "Custom mode creation", "Mode-specific prompts"],
  },
  {
    number: "03",
    title: "Start Your Session",
    description:
      "Hit the shortcut, and Queen Mama listens to your conversation and screen. Get real-time AI suggestions instantly.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    details: ["Real-time transcription", "Screen context awareness", "Automatic suggestions"],
  },
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

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative bg-[var(--qm-bg-secondary)]">
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
            Get Started in <span className="gradient-text">Minutes</span>
          </h2>
          <p className="text-lg text-[var(--qm-text-secondary)] max-w-2xl mx-auto">
            Three simple steps to transform your conversations with AI-powered
            real-time coaching.
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
          {steps.map((step, index) => (
            <motion.div key={step.number} variants={itemVariants}>
              <div className="relative h-full">
                {/* Connecting Line (desktop only) */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-[var(--qm-border-medium)] to-transparent z-0" />
                )}

                <GlassCard className="h-full relative z-10">
                  {/* Step Number */}
                  <div className="absolute -top-4 -left-2 w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-bold text-sm shadow-[var(--qm-shadow-glow)]">
                    {step.number}
                  </div>

                  <div className="pt-4">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-[rgba(139,92,246,0.15)] flex items-center justify-center text-[var(--qm-accent)] mb-4">
                      {step.icon}
                    </div>

                    {/* Content */}
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-[var(--qm-text-secondary)] mb-4">
                      {step.description}
                    </p>

                    {/* Details */}
                    <ul className="space-y-2">
                      {step.details.map((detail, i) => (
                        <li
                          key={i}
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
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Keyboard Shortcuts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-16"
        >
          <GlassCard
            hover={false}
            className="max-w-3xl mx-auto text-center"
            padding="lg"
          >
            <h3 className="text-lg font-semibold text-white mb-6">
              Pro Tip: Master the Shortcuts
            </h3>
            <div className="flex flex-wrap justify-center gap-6">
              <div className="flex items-center gap-3">
                <KeyboardShortcut shortcut="Cmd+Shift+S" />
                <span className="text-sm text-[var(--qm-text-secondary)]">
                  Start Session
                </span>
              </div>
              <div className="flex items-center gap-3">
                <KeyboardShortcut shortcut="Cmd+\\" />
                <span className="text-sm text-[var(--qm-text-secondary)]">
                  Toggle Widget
                </span>
              </div>
              <div className="flex items-center gap-3">
                <KeyboardShortcut shortcut="Cmd+Enter" />
                <span className="text-sm text-[var(--qm-text-secondary)]">
                  Ask AI
                </span>
              </div>
              <div className="flex items-center gap-3">
                <KeyboardShortcut shortcut="Cmd+R" />
                <span className="text-sm text-[var(--qm-text-secondary)]">
                  Clear Context
                </span>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </Container>
    </section>
  );
}
