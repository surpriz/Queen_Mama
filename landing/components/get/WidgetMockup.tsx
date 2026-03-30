"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, MessageSquare, RotateCcw, FileText } from "lucide-react";

const TABS = [
  { id: "assist", label: "Assist", icon: Sparkles, active: true },
  { id: "say", label: "What to Say", icon: MessageSquare, active: false },
  { id: "followup", label: "Follow-up", icon: RotateCcw, active: false },
  { id: "recap", label: "Recap", icon: FileText, active: false },
];

interface WidgetMockupProps {
  text: string;
  isTyping: boolean;
  className?: string;
}

export default function WidgetMockup({ text, isTyping, className = "" }: WidgetMockupProps) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (!isTyping) {
      setDisplayedText(text);
      return;
    }
    setDisplayedText("");
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 25);
    return () => clearInterval(interval);
  }, [text, isTyping]);

  return (
    <div
      className={`w-full max-w-[380px] rounded-2xl overflow-hidden border border-[var(--qm-border-subtle)] bg-[var(--qm-bg-secondary)]/95 backdrop-blur-xl shadow-2xl ${className}`}
    >
      {/* Tab bar */}
      <div className="flex border-b border-[var(--qm-border-subtle)] px-1 pt-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
              tab.active
                ? "text-[var(--qm-accent)] bg-[var(--qm-surface-medium)]"
                : "text-[var(--qm-text-tertiary)] hover:text-[var(--qm-text-secondary)]"
            }`}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 min-h-[120px]">
        <AnimatePresence mode="wait">
          <motion.p
            key={text}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-[var(--qm-text-primary)] leading-relaxed"
          >
            {displayedText}
            {isTyping && displayedText.length < text.length && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="inline-block w-0.5 h-4 bg-[var(--qm-accent)] ml-0.5 align-middle"
              />
            )}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
