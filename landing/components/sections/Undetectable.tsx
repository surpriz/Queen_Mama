"use client";

import { motion } from "framer-motion";
import { Container, GlassCard, Badge } from "@/components/ui";

export function Undetectable() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-[var(--qm-success)] rounded-full blur-[200px] opacity-10" />
      </div>

      <Container className="relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left - Visual */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="relative">
              {/* Screen Share Frame */}
              <div className="relative bg-[var(--qm-bg-elevated)] rounded-2xl border border-[var(--qm-border-subtle)] overflow-hidden shadow-2xl">
                {/* Window Controls */}
                <div className="flex items-center gap-2 px-4 py-3 bg-[var(--qm-bg-tertiary)] border-b border-[var(--qm-border-subtle)]">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
                  <span className="ml-4 text-xs text-[var(--qm-text-tertiary)]">
                    Zoom Meeting - Screen Sharing Active
                  </span>
                </div>

                {/* Content */}
                <div className="p-6 min-h-[300px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--qm-surface-medium)] flex items-center justify-center">
                      <svg className="w-8 h-8 text-[var(--qm-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-[var(--qm-text-secondary)]">
                      Your presentation slides appear here
                    </p>
                    <p className="text-sm text-[var(--qm-text-tertiary)] mt-2">
                      Queen Mama widget is NOT visible to participants
                    </p>
                  </div>
                </div>

                {/* Status Bar */}
                <div className="px-4 py-2 bg-[var(--qm-bg-tertiary)] border-t border-[var(--qm-border-subtle)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#27C93F] animate-pulse" />
                    <span className="text-xs text-[var(--qm-text-tertiary)]">
                      Recording
                    </span>
                  </div>
                  <Badge variant="success" size="sm">
                    Widget Hidden
                  </Badge>
                </div>
              </div>

              {/* Queen Mama Widget (Floating, Visible Only to You) */}
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -right-4 -bottom-4 lg:-right-8 lg:-bottom-8"
              >
                <div className="relative">
                  <div className="bg-black/95 backdrop-blur-xl rounded-xl border border-[var(--qm-border-subtle)] shadow-2xl p-3 w-64">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <Badge variant="success" size="sm">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                        Hidden
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--qm-text-secondary)]">
                      &ldquo;Great point about scalability. You could add that your
                      solution reduced costs by 40%...&rdquo;
                    </p>
                  </div>

                  {/* Arrow pointing */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-center">
                    <span className="text-xs text-[var(--qm-success)] font-medium">
                      Only you see this
                    </span>
                    <svg className="w-4 h-4 text-[var(--qm-success)] mx-auto mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>

                  {/* Glow */}
                  <div className="absolute -inset-2 bg-[var(--qm-success)] rounded-xl opacity-20 blur-xl -z-10" />
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right - Content */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Badge variant="success" className="mb-4">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Privacy First
            </Badge>

            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              Truly{" "}
              <span className="gradient-text">Invisible</span> During Screen Sharing
            </h2>

            <p className="text-lg text-[var(--qm-text-secondary)] mb-8">
              Unlike other tools that can be spotted during video calls, Queen Mama
              uses advanced macOS APIs to completely exclude itself from screen
              captures and recordings. Your secret weapon stays secret.
            </p>

            <div className="space-y-4">
              {[
                {
                  title: "Hidden from Zoom, Teams, Meet",
                  description:
                    "Works with all major video conferencing platforms without detection.",
                },
                {
                  title: "Excluded from Screen Recordings",
                  description:
                    "Even if you record your screen, Queen Mama won't appear.",
                },
                {
                  title: "Toggle On/Off Anytime",
                  description:
                    "Disable undetectability mode when you need to show the widget.",
                },
              ].map((item, index) => (
                <GlassCard key={index} padding="sm" hover={false}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--qm-success-light)] flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-4 h-4 text-[var(--qm-success)]"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{item.title}</h4>
                      <p className="text-sm text-[var(--qm-text-tertiary)]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
