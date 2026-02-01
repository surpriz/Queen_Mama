"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Container, GradientButton, Badge } from "@/components/ui";

const typewriterTexts = [
  "job interviews",
  "sales calls",
  "investor pitches",
  "board meetings",
  "coding exams",
  "thesis defenses",
  "salary negotiations",
];

export function UseCasesHero() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = typewriterTexts[currentIndex];
    const typeSpeed = isDeleting ? 30 : 60;

    if (!isDeleting && displayText === currentText) {
      const timeout = setTimeout(() => setIsDeleting(true), 2000);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && displayText === "") {
      setIsDeleting(false);
      setCurrentIndex((prev) => (prev + 1) % typewriterTexts.length);
      return;
    }

    const timeout = setTimeout(() => {
      setDisplayText((prev) =>
        isDeleting ? prev.slice(0, -1) : currentText.slice(0, prev.length + 1)
      );
    }, typeSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentIndex]);

  return (
    <section className="relative min-h-[70vh] flex items-center pt-28 pb-16 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 -left-1/4 w-[600px] h-[600px] bg-[var(--qm-purple)] rounded-full blur-[200px] opacity-15" />
        <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-[var(--qm-blue)] rounded-full blur-[200px] opacity-15" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-[#F97316] to-[#EC4899] rounded-full blur-[300px] opacity-5" />

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
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Counter Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <Badge variant="accent" size="md" className="px-4 py-2">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              32+ Use Cases Across 6 Domains
            </Badge>
          </motion.div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight mb-6">
            One Assistant,{" "}
            <span className="gradient-text">Infinite Scenarios</span>
          </h1>

          {/* Typewriter Subtitle */}
          <div className="h-16 sm:h-20 flex items-center justify-center mb-8">
            <p className="text-xl sm:text-2xl lg:text-3xl text-[var(--qm-text-secondary)]">
              From{" "}
              <span className="text-white font-semibold inline-block min-w-[200px] sm:min-w-[280px]">
                {displayText}
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="inline-block w-[3px] h-6 sm:h-8 bg-[var(--qm-accent)] ml-1 align-middle"
                />
              </span>{" "}
              <br className="hidden sm:block" />
              to every high-stakes conversation
            </p>
          </div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row justify-center gap-4"
          >
            <a href="#use-cases">
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
                Explore Use Cases
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
                Try Free
              </GradientButton>
            </Link>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
