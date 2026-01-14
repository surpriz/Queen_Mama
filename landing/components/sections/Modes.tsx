"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Container, GlassCard, Badge } from "@/components/ui";

const modes = [
  {
    id: "default",
    name: "Default",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    description: "General professional assistant for any conversation",
    features: [
      "Concise, professional responses",
      "Adapts to conversation context",
      "Multi-language support",
    ],
    example:
      "Based on the discussion, I suggest highlighting your experience with agile methodologies and team leadership...",
  },
  {
    id: "interview",
    name: "Interview",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: "Navigate job interviews with confidence",
    features: [
      "STAR-format responses",
      "Highlights relevant skills",
      "Technical question support",
    ],
    example:
      "Use the STAR method: 'In my previous role (Situation), I was tasked with improving deployment speed (Task). I implemented CI/CD pipelines (Action), reducing deployment time by 60% (Result).'",
  },
  {
    id: "sales",
    name: "Sales",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    description: "Close deals and handle objections effectively",
    features: [
      "Objection handling",
      "Value proposition focus",
      "Buying signal detection",
    ],
    example:
      "I notice they mentioned budget concerns. Try: 'I understand budget is a priority. Let me show you how our solution typically delivers 3x ROI within the first year...'",
  },
  {
    id: "professional",
    name: "Professional",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    description: "Formal business and executive presence",
    features: [
      "Executive-level language",
      "Strategic recommendations",
      "Clear, structured responses",
    ],
    example:
      "For maximum impact, I recommend structuring your response around three key pillars: strategic alignment, operational efficiency, and measurable outcomes...",
  },
];

export function Modes() {
  const [activeMode, setActiveMode] = useState("interview");

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
            <span className="gradient-text">AI Modes</span> for Every Scenario
          </h2>
          <p className="text-lg text-[var(--qm-text-secondary)] max-w-2xl mx-auto">
            Pre-configured AI personalities tailored for specific situations. Choose
            the right mode or create your own custom assistant.
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
                          {currentMode.name} Mode
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
                        Create custom modes
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
                        Example Response
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
