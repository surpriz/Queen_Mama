"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { KeyboardShortcut } from "@/components/ui";
import { allShortcuts } from "./data";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export function KeyboardShortcutsReference() {
  const t = useTranslations("FeaturesGuide");

  return (
    <section className="py-16 bg-[var(--qm-bg-secondary)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">⌨️</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            {t("shortcuts.title")}
          </h2>
        </div>
        <p className="text-[var(--qm-text-secondary)]">
          {t("shortcuts.description")}
        </p>
      </motion.div>

      <motion.div
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
      >
        {allShortcuts.map((sc) => (
          <motion.div
            key={sc.keys}
            variants={itemVariants}
            className="flex items-center gap-4 p-4 rounded-[var(--qm-radius-lg)] bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)]"
          >
            <KeyboardShortcut shortcut={sc.keys} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">
                {t(`shortcuts.items.${sc.keys}.label`)}
              </p>
              {sc.context && (
                <p className="text-xs text-[var(--qm-text-tertiary)]">
                  {t(`shortcuts.items.${sc.keys}.context`)}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
