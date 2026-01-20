"use client";

import { motion } from "framer-motion";
import * as Accordion from "@radix-ui/react-accordion";
import { Container } from "@/components/ui";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "How does Queen Mama work?",
    answer:
      "Queen Mama listens to your conversations in real-time, transcribes the audio, and provides AI-powered suggestions based on the context. Simply download the app, create an account, and you're ready to go - no configuration needed. We handle all the AI and transcription infrastructure for you.",
  },
  {
    question: "Is it really invisible during screen sharing?",
    answer:
      "Yes! Queen Mama uses macOS's official screen capture exclusion APIs (setSharingType). When undetectability mode is enabled, the widget is completely invisible to Zoom, Teams, Google Meet, and any screen recording software. It's like it doesn't exist on your screen.",
  },
  {
    question: "Does it work with Zoom, Teams, and Google Meet?",
    answer:
      "Absolutely. Queen Mama works with any video conferencing app on macOS. The floating widget stays on top of your screen while remaining invisible to other participants when you share your screen or record the meeting.",
  },
  {
    question: "What languages are supported?",
    answer:
      "Queen Mama automatically detects the language being spoken and responds in the same language. Currently, it works best with English and French, with more languages coming soon. The AI providers support many additional languages.",
  },
  {
    question: "Is my data private?",
    answer:
      "Yes. We take privacy seriously. Audio is processed in real-time and not stored on our servers. Session data and transcripts are stored locally on your Mac using SwiftData. Your conversations remain private and are never used for training AI models.",
  },
  {
    question: "What are the system requirements?",
    answer:
      "Queen Mama requires macOS 14.0 (Sonoma) or later. You'll need to grant microphone access for transcription and screen recording permission for screen context features. An internet connection is required for AI and transcription services.",
  },
  {
    question: "Can I create custom AI modes?",
    answer:
      "Yes! Pro users can create unlimited custom modes with their own system prompts. You can even attach documents (PDFs, text files) to modes for context-specific AI responses. Free users get access to 4 built-in modes: Default, Interview, Sales, and Professional.",
  },
  {
    question: "How does the auto-answer feature work?",
    answer:
      "Auto-answer intelligently triggers AI responses based on conversation context. It detects silence after you speak, question marks in the transcript, and sentence completions. You can customize the sensitivity and cooldown period in settings.",
  },
];

export function FAQ() {
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
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <p className="text-lg text-[var(--qm-text-secondary)]">
            Everything you need to know about Queen Mama
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
            Still have questions?{" "}
            <a
              href="mailto:support@queenmama.app"
              className="text-[var(--qm-accent)] hover:text-[var(--qm-accent-light)] transition-colors"
            >
              Contact us
            </a>
          </p>
        </motion.div>
      </Container>
    </section>
  );
}
