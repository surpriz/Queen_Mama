"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import * as Accordion from "@radix-ui/react-accordion";
import { Container } from "@/components/ui";
import { cn } from "@/lib/utils";

export function FAQ() {
  const t = useTranslations("FAQ");

  const faqs = [
    {
      question: t("q1"),
      answer: t("a1"),
    },
    {
      question: t("q2"),
      answer: t("a2"),
    },
    {
      question: t("q3"),
      answer: t("a3"),
    },
    {
      question: t("q4"),
      answer: t("a4"),
    },
    {
      question: t("q5"),
      answer: t("a5"),
    },
    {
      question: t("q6"),
      answer: t("a6"),
    },
    {
      question: t("q7"),
      answer: t("a7"),
    },
    {
      question: t("q8"),
      answer: t("a8"),
    },
  ];

  return (
    <section id="faq" className="py-24 relative">
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
            {t.rich("title", {
              highlight: (chunks) => <span className="gradient-text">{chunks}</span>,
            })}
          </h2>
          <p className="text-lg text-[var(--qm-text-secondary)]">
            {t("subtitle")}
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Accordion.Root type="single" collapsible className="space-y-3">
            {faqs.map((faq, index) => (
              <Accordion.Item
                key={index}
                value={`item-${index}`}
                className="bg-[var(--qm-surface-medium)] rounded-xl border border-[var(--qm-border-subtle)] overflow-hidden"
              >
                <Accordion.Header>
                  <Accordion.Trigger className="flex items-center justify-between w-full px-6 py-4 text-left group">
                    <span className="text-white font-medium pr-4">
                      {faq.question}
                    </span>
                    <svg
                      className={cn(
                        "w-5 h-5 text-[var(--qm-text-tertiary)] flex-shrink-0 transition-transform duration-200",
                        "group-data-[state=open]:rotate-180"
                      )}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
                  <div className="px-6 pb-4">
                    <p className="text-[var(--qm-text-secondary)] text-sm leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </motion.div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center mt-12"
        >
          <p className="text-[var(--qm-text-tertiary)]">
            {t("stillQuestions")}{" "}
            <a
              href="mailto:support@queenmama.app"
              className="text-[var(--qm-accent)] hover:text-[var(--qm-accent-light)] transition-colors"
            >
              {t("contactUs")}
            </a>
          </p>
        </motion.div>
      </Container>
    </section>
  );
}
