"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui";
import {
  FeaturesGuideHero,
  TableOfContents,
  useActiveCategoryTracking,
  FeatureCategorySection,
  KeyboardShortcutsReference,
  FeaturesGuideCTA,
} from "@/components/sections/features-guide";
import { categories } from "@/components/sections/features-guide/data";

export default function FeaturesGuidePage() {
  const t = useTranslations("FeaturesGuide");
  const activeCategory = useActiveCategoryTracking();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;

    const query = searchQuery.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        features: cat.features.filter(
          (f) =>
            f.title.toLowerCase().includes(query) ||
            f.subtitle.toLowerCase().includes(query) ||
            f.description.toLowerCase().includes(query)
        ),
      }))
      .filter((cat) => cat.features.length > 0);
  }, [searchQuery]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <FeaturesGuideHero />

        <Container size="xl">
          <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-12">
            <TableOfContents
              activeCategory={activeCategory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />

            <div>
              {filteredCategories.map((category, index) => (
                <FeatureCategorySection
                  key={category.id}
                  category={category}
                  index={index}
                />
              ))}

              {filteredCategories.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-lg text-[var(--qm-text-tertiary)]">
                    {t("noResults", { query: searchQuery })}
                  </p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-4 text-sm text-[var(--qm-accent)] hover:underline"
                  >
                    {t("clearSearch")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </Container>

        <Container size="xl">
          <KeyboardShortcutsReference />
        </Container>

        <Container size="xl">
          <FeaturesGuideCTA />
        </Container>
      </main>
      <Footer />
    </>
  );
}
