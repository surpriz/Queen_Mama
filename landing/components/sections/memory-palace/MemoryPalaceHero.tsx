"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Container, GradientButton, Badge } from "@/components/ui";

const contactFields = [
  { label: "Sarah Chen", delay: 0.4 },
  { label: "VP Engineering @ TechCorp", delay: 0.7 },
  { label: "3 sessions  ·  Last seen 2 days ago", delay: 1.0 },
  { label: '"Interested in Q2 roadmap alignment..."', delay: 1.3 },
];

export function MemoryPalaceHero() {
  const [visibleFields, setVisibleFields] = useState(0);

  useEffect(() => {
    const timers = contactFields.map((_, i) =>
      setTimeout(() => setVisibleFields(i + 1), (i + 1) * 600)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <section className="relative min-h-[70vh] flex items-center pt-28 pb-16 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 -left-1/4 w-[600px] h-[600px] bg-[var(--qm-purple)] rounded-full blur-[200px] opacity-15" />
        <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-[var(--qm-blue)] rounded-full blur-[200px] opacity-15" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-[var(--qm-success)] to-[var(--qm-accent)] rounded-full blur-[300px] opacity-5" />

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(var(--qm-text-tertiary) 1px, transparent 1px),
                              linear-gradient(90deg, var(--qm-text-tertiary) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <Container className="relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <Badge variant="accent" size="md" className="px-4 py-2">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                New Feature
              </Badge>
            </motion.div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Never Walk Into a Meeting{" "}
              <span className="gradient-text">Unprepared</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-[var(--qm-text-secondary)] mb-8 max-w-xl">
              Memory Palace automatically builds your personal CRM from
              conversations. Every name, every role, every detail — remembered.
            </p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <a href="#features">
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
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                  Explore Features
                </GradientButton>
              </a>
              <Link href="/download">
                <GradientButton size="lg" variant="secondary">
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
                  Download Free
                </GradientButton>
              </Link>
            </motion.div>
          </motion.div>

          {/* Right: Animated Contact Card Mock */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden lg:block"
          >
            <div className="relative p-6 rounded-2xl bg-[var(--qm-surface-medium)] border border-[var(--qm-border-subtle)] backdrop-blur-xl shadow-2xl max-w-md mx-auto">
              {/* Card Header */}
              <div className="flex items-center gap-4 mb-5">
                {/* Avatar */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.5 }}
                  className="w-14 h-14 rounded-full gradient-bg flex items-center justify-center text-white text-lg font-bold shadow-[var(--qm-shadow-glow)]"
                >
                  SC
                </motion.div>
                <div className="flex-1 space-y-2">
                  {visibleFields >= 1 && (
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-white font-semibold text-lg"
                    >
                      {contactFields[0].label}
                    </motion.p>
                  )}
                  {visibleFields >= 2 && (
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[var(--qm-text-secondary)] text-sm"
                    >
                      {contactFields[1].label}
                    </motion.p>
                  )}
                </div>
              </div>

              {/* Stats Row */}
              {visibleFields >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-xs text-[var(--qm-text-tertiary)] mb-4 pb-4 border-b border-[var(--qm-border-subtle)]"
                >
                  <svg
                    className="w-3.5 h-3.5 text-[var(--qm-accent)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {contactFields[2].label}
                </motion.div>
              )}

              {/* Note Snippet */}
              {visibleFields >= 4 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)]"
                >
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-4 h-4 text-[var(--qm-success)] mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    <p className="text-sm text-[var(--qm-text-secondary)] italic">
                      {contactFields[3].label}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Floating AI Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 2.0, type: "spring" }}
                className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-[var(--qm-success)] text-white text-xs font-semibold shadow-lg"
              >
                AI Extracted
              </motion.div>
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
