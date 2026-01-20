"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Container, GlassCard, Input, Label, GradientButton } from "@/components/ui";

export function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setSuccess(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="contact" className="py-24 relative bg-[var(--qm-bg-secondary)]">
      <Container size="md">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Get in <span className="gradient-text">Touch</span>
          </h2>
          <p className="text-lg text-[var(--qm-text-secondary)]">
            Have questions? We'd love to hear from you.
          </p>
        </motion.div>

        {/* Contact Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-2xl mx-auto"
        >
          <GlassCard padding="lg">
            {success ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--qm-success)]/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-[var(--qm-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Message sent!</h3>
                <p className="text-[var(--qm-text-secondary)] mb-6">
                  Thanks for reaching out. We'll get back to you soon.
                </p>
                <button
                  onClick={() => setSuccess(false)}
                  className="text-[var(--qm-accent)] hover:text-[var(--qm-accent-light)] transition-colors"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-error)]/10 border border-[var(--qm-error)]/20">
                    <p className="text-sm text-[var(--qm-error)]">{error}</p>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="name" required>
                      Name
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" required>
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="subject" required>
                    Subject
                  </Label>
                  <Input
                    id="subject"
                    type="text"
                    placeholder="How can we help?"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="message" required>
                    Message
                  </Label>
                  <textarea
                    id="message"
                    rows={6}
                    placeholder="Tell us more about your question or feedback..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    disabled={isLoading}
                    required
                    className="w-full px-4 py-3 bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)] rounded-[var(--qm-radius-md)] text-white placeholder:text-[var(--qm-text-tertiary)] focus:outline-none focus:border-[var(--qm-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                  />
                </div>

                <GradientButton type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Message
                    </>
                  )}
                </GradientButton>
              </form>
            )}
          </GlassCard>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 text-center"
          >
            <p className="text-sm text-[var(--qm-text-tertiary)]">
              Or email us directly at{" "}
              <a
                href="mailto:jerome0laval@gmail.com"
                className="text-[var(--qm-accent)] hover:text-[var(--qm-accent-light)] transition-colors"
              >
                jerome0laval@gmail.com
              </a>
            </p>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
