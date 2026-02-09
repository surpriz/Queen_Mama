"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { FeatureCategory } from "./data";
import { FeatureDetailCard } from "./FeatureDetailCard";

interface FeatureCategorySectionProps {
  category: FeatureCategory;
  index: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

export function FeatureCategorySection({
  category,
  index,
}: FeatureCategorySectionProps) {
  const t = useTranslations("FeaturesGuide");

  return (
    <section
      data-category-id={category.id}
      className={`py-16 ${index % 2 === 1 ? "bg-[var(--qm-surface-light)]" : ""}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{category.icon}</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            {t(`categories.${category.id}.label`)}
          </h2>
        </div>
        <p className="text-[var(--qm-text-secondary)] max-w-xl">
          {t(`categories.${category.id}.description`)}
        </p>
      </motion.div>

      <motion.div
        className="space-y-8"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
      >
        {category.features.map((feature) => (
          <motion.div key={feature.id} variants={itemVariants}>
            <FeatureDetailCard
              feature={feature}
              categoryColor={category.accentColor}
            />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
