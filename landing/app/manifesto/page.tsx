"use client";

import { Metadata } from "next";
import { motion } from "framer-motion";
import { Container, GradientButton } from "@/components/ui";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";

export default function ManifestoPage() {
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
              The World Will Call It{" "}
              <span className="gradient-text">Cheating</span>
            </h1>
            <p className="text-xl sm:text-2xl text-[var(--qm-text-secondary)]">
              We call it leveling the playing field.
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
                Queen Mama gives you an AI assistant that sees your screen, hears your
                conversation, and whispers suggestions in real-time.
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                During job interviews. Sales calls. Important meetings.
              </p>
              <p className="text-2xl text-white font-medium">
                And nobody knows it&apos;s there.
              </p>
            </section>

            {/* Section 2 - The History */}
            <section className="space-y-6">
              <h2 className="text-3xl font-bold text-white">
                &ldquo;That&apos;s not fair.&rdquo;
              </h2>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                That&apos;s what they said about calculators. About spellcheck. About
                Google. About GPS navigation.
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                Every tool that made humans more capable was once called unfair by
                those who didn&apos;t have it.
              </p>
              <p className="text-xl text-white font-medium">
                Then it became standard. Then it became expected.
              </p>
            </section>

            {/* Section 3 - The Reality */}
            <section className="space-y-6">
              <h2 className="text-3xl font-bold text-white">
                The Nervous Candidate
              </h2>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                You&apos;ve been there. Sitting in front of your screen, heart racing,
                mind going blank at the worst possible moment.
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                The question was simple. You know the answer. But stress hijacked your
                brain, and now you&apos;re stumbling through a response that doesn&apos;t
                reflect who you really are.
              </p>
              <p className="text-xl text-white font-medium">
                Meanwhile, someone else - less qualified but more confident - gets the
                job.
              </p>
            </section>

            {/* Section 4 - The Truth */}
            <section className="py-12 border-y border-[var(--qm-border-subtle)]">
              <blockquote className="text-3xl sm:text-4xl font-bold text-center leading-tight">
                <span className="gradient-text">
                  &ldquo;The future won&apos;t reward effort.
                  <br />
                  It will reward leverage.&rdquo;
                </span>
              </blockquote>
            </section>

            {/* Section 5 - The Shift */}
            <section className="space-y-6">
              <h2 className="text-3xl font-bold text-white">
                The Rules Are Changing
              </h2>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                Memorizing facts? That&apos;s what search engines are for.
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                Writing perfect prose? That&apos;s what AI is for.
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                Knowing every answer? That&apos;s what having the right tools is for.
              </p>
              <p className="text-xl text-white font-medium">
                What matters now is knowing which questions to ask. And having the
                courage to ask them.
              </p>
            </section>

            {/* Section 6 - The Privacy Promise */}
            <section className="space-y-6">
              <h2 className="text-3xl font-bold text-white">
                Your Secret, Truly Kept
              </h2>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                Queen Mama doesn&apos;t just help you. It protects you.
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                When you share your screen, Queen Mama disappears. Not minimized. Not
                hidden behind a window. <span className="text-white">Gone.</span>{" "}
                Invisible to screen capture APIs. Undetectable.
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                Your conversations stay on your machine. Your API keys stay in your
                Keychain. We don&apos;t see your data. We don&apos;t want to.
              </p>
            </section>

            {/* Section 7 - The Choice */}
            <section className="space-y-6">
              <h2 className="text-3xl font-bold text-white">
                You Have a Choice
              </h2>
              <p className="text-xl text-[var(--qm-text-secondary)] leading-relaxed">
                You can keep playing by the old rules. Hoping your nerves don&apos;t
                betray you. Praying you remember the right talking points. Competing
                against people who&apos;ve already embraced the future.
              </p>
              <p className="text-xl text-white font-medium">Or you can adapt.</p>
            </section>

            {/* Closing */}
            <section className="text-center pt-8 space-y-8">
              <p className="text-2xl sm:text-3xl font-bold text-white">
                So yes, start &ldquo;cheating.&rdquo;
              </p>
              <p className="text-xl text-[var(--qm-text-secondary)]">
                Because when everyone does, no one is.
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
                  Download Queen Mama
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
