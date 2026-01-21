"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Container, GradientButton, Input, Label } from "@/components/ui";

export default function WindowsWaitlistPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, platform: "WINDOWS" }),
      });

      const data = await response.json();

      if (!response.ok && response.status !== 200) {
        setError(data.error || "Something went wrong");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-20 px-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-[var(--qm-purple)] rounded-full blur-[128px] opacity-20" />
        <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-[var(--qm-blue)] rounded-full blur-[128px] opacity-20" />
      </div>

      <Container size="sm" className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          {/* Windows Icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[var(--qm-surface-medium)] border border-[var(--qm-border-subtle)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--qm-accent)]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
            </svg>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Queen Mama for <span className="gradient-text">Windows</span>
          </h1>
          <p className="text-lg text-[var(--qm-text-secondary)] max-w-md mx-auto">
            We&apos;re working hard to bring Queen Mama to Windows. Join the waitlist to be the first to know when it&apos;s ready.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-[var(--qm-surface-medium)] border border-[var(--qm-border-subtle)] rounded-2xl p-6 sm:p-8"
        >
          {success ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--qm-success)]/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--qm-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">You&apos;re on the list!</h2>
              <p className="text-[var(--qm-text-secondary)] mb-6">
                We&apos;ll notify you at <span className="text-white font-medium">{email}</span> as soon as Queen Mama for Windows is available.
              </p>
              <Link href="/" className="text-[var(--qm-accent)] hover:text-[var(--qm-accent-light)] transition-colors">
                Back to home
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-error)]/10 border border-[var(--qm-error)]/20">
                  <p className="text-sm text-[var(--qm-error)]">{error}</p>
                </div>
              )}

              <div>
                <Label htmlFor="email" required>
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <GradientButton type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Joining..." : "Join the Waitlist"}
              </GradientButton>

              <p className="text-xs text-[var(--qm-text-tertiary)] text-center">
                We&apos;ll only email you when Windows support is ready. No spam, ever.
              </p>
            </form>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 text-center"
        >
          <p className="text-[var(--qm-text-tertiary)]">
            Already on macOS?{" "}
            <Link href="/download" className="text-[var(--qm-accent)] hover:text-[var(--qm-accent-light)] transition-colors">
              Download now
            </Link>
          </p>
        </motion.div>
      </Container>
    </div>
  );
}
