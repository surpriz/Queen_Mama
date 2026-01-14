"use client";

import { motion } from "framer-motion";
import { Container, GradientButton } from "@/components/ui";

export function CTA() {
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
            Never Be{" "}
            <span className="gradient-text">Caught Off-Guard</span> Again
          </h2>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-[var(--qm-text-secondary)] mb-10 max-w-2xl mx-auto">
            Join professionals who have transformed their high-stakes conversations
            with AI-powered real-time coaching. Download Queen Mama today.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
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
              Download for macOS
            </GradientButton>
            <GradientButton size="lg" variant="secondary">
              View on GitHub
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </GradientButton>
          </div>

          {/* Trust Note */}
          <p className="text-sm text-[var(--qm-text-tertiary)]">
            Free to use. No credit card required. macOS 14+ required.
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
              <p className="text-3xl font-bold gradient-text">3+</p>
              <p className="text-sm text-[var(--qm-text-tertiary)]">AI Providers</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold gradient-text">4</p>
              <p className="text-sm text-[var(--qm-text-tertiary)]">Built-in Modes</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold gradient-text">100%</p>
              <p className="text-sm text-[var(--qm-text-tertiary)]">Undetectable</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold gradient-text">Free</p>
              <p className="text-sm text-[var(--qm-text-tertiary)]">To Start</p>
            </div>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
