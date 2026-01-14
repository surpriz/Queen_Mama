"use client";

import { motion } from "framer-motion";
import { Container, GradientButton, Badge } from "@/components/ui";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-[var(--qm-purple)] rounded-full blur-[128px] opacity-20" />
        <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-[var(--qm-blue)] rounded-full blur-[128px] opacity-20" />

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(var(--qm-text-tertiary) 1px, transparent 1px),
                              linear-gradient(90deg, var(--qm-text-tertiary) 1px, transparent 1px)`,
            backgroundSize: '64px 64px'
          }}
        />
      </div>

      <Container className="relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-6"
            >
              <Badge variant="success" size="md">
                <span className="w-2 h-2 rounded-full bg-[var(--qm-success)] animate-pulse" />
                Available for macOS
              </Badge>
            </motion.div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Your Secret Weapon for{" "}
              <span className="gradient-text">High-Stakes Conversations</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-[var(--qm-text-secondary)] mb-8 max-w-xl mx-auto lg:mx-0">
              AI coaching that stays invisible. Get real-time suggestions during
              interviews, sales calls, and meetings{" "}
              <span className="text-white font-medium">
                completely undetectable on video calls.
              </span>
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-3 mb-8">
              <Badge variant="accent">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
                Invisible to Screen Share
              </Badge>
              <Badge variant="default">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Real-time AI
              </Badge>
              <Badge variant="default">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Live Transcription
              </Badge>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
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
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                See How It Works
              </GradientButton>
            </div>

            {/* Trust Note */}
            <p className="mt-6 text-sm text-[var(--qm-text-tertiary)]">
              Free to use. Bring your own API keys.
            </p>
          </motion.div>

          {/* Right Column - Widget Preview */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="relative"
          >
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Floating Widget Mock */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                {/* Widget Container */}
                <div className="relative bg-black/90 backdrop-blur-xl rounded-2xl border border-[var(--qm-border-subtle)] shadow-2xl overflow-hidden">
                  {/* Widget Header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--qm-border-subtle)]">
                    <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-gradient-to-r from-[var(--qm-purple)] to-[var(--qm-blue)] rounded-full text-white text-xs font-medium">
                        Ask
                      </span>
                      <Badge variant="success" size="sm">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                        Hidden
                      </Badge>
                    </div>
                    <div className="flex-1" />
                    <Badge variant="auto-answer" size="sm">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Auto
                    </Badge>
                  </div>

                  {/* Tab Bar */}
                  <div className="flex gap-1 px-3 py-2 border-b border-[var(--qm-border-subtle)]">
                    {["Assist", "Say", "Ask", "Recap"].map((tab, i) => (
                      <button
                        key={tab}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          i === 0
                            ? "bg-[var(--qm-surface-hover)] text-white"
                            : "text-[var(--qm-text-tertiary)] hover:text-white"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Response Area */}
                  <div className="p-4 min-h-[200px]">
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-[rgba(139,92,246,0.2)] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-[var(--qm-accent)]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-[var(--qm-text-secondary)] leading-relaxed">
                            Based on the conversation, here are some suggestions for your response about project management experience:
                          </p>
                          <div className="mt-3 space-y-2">
                            <div className="p-3 bg-[var(--qm-surface-light)] rounded-lg border border-[var(--qm-border-subtle)]">
                              <p className="text-sm text-white">
                                &ldquo;I led a team of 8 engineers on a 6-month product redesign that increased user engagement by 40%...&rdquo;
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Input Area */}
                  <div className="p-3 border-t border-[var(--qm-border-subtle)]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[var(--qm-surface-light)] rounded-lg px-3 py-2 border border-[var(--qm-border-subtle)]">
                        <span className="text-sm text-[var(--qm-text-tertiary)]">
                          Ask anything...
                        </span>
                      </div>
                      <button className="w-9 h-9 rounded-lg gradient-bg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Glow Effect */}
                <div className="absolute -inset-4 bg-gradient-to-r from-[var(--qm-purple)] to-[var(--qm-blue)] rounded-3xl opacity-20 blur-2xl -z-10" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
