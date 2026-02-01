"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Container } from "@/components/ui";
import { UseCaseCard } from "./UseCaseCard";
import { useCases, type Category } from "./data";

interface UseCaseGridProps {
  selectedCategory: Category | "all";
}

export function UseCaseGrid({ selectedCategory }: UseCaseGridProps) {
  const filteredUseCases =
    selectedCategory === "all"
      ? useCases
      : useCases.filter((uc) => uc.category === selectedCategory);

  return (
    <section id="use-cases" className="py-16">
      <Container>
        {/* Results count */}
        <motion.div
          key={selectedCategory}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mb-8"
        >
          <p className="text-sm text-[var(--qm-text-tertiary)]">
            Showing{" "}
            <span className="text-white font-medium">
              {filteredUseCases.length}
            </span>{" "}
            use case{filteredUseCases.length !== 1 ? "s" : ""}
            {selectedCategory !== "all" && (
              <>
                {" "}
                in{" "}
                <span className="text-white font-medium capitalize">
                  {selectedCategory}
                </span>
              </>
            )}
          </p>
        </motion.div>

        {/* Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCategory}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filteredUseCases.map((useCase, index) => (
              <UseCaseCard key={useCase.id} useCase={useCase} index={index} />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Empty State */}
        {filteredUseCases.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 rounded-full bg-[var(--qm-surface-medium)] flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-[var(--qm-text-tertiary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-[var(--qm-text-secondary)]">
              No use cases found in this category
            </p>
          </motion.div>
        )}
      </Container>
    </section>
  );
}
