"use client";

import { useState, useEffect } from "react";
import { Container } from "@/components/ui";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import {
  UseCasesHero,
  UseCaseFilters,
  UseCaseGrid,
  BeforeAfter,
  UseCasesCTA,
  type Category,
} from "@/components/sections/use-cases";

export default function UseCasesPage() {
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">(
    "all"
  );
  const [isFilterSticky, setIsFilterSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Make filters sticky after scrolling past the hero
      setIsFilterSticky(window.scrollY > 500);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <UseCasesHero />

        <Container>
          <UseCaseFilters
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            isSticky={isFilterSticky}
          />
        </Container>

        <UseCaseGrid selectedCategory={selectedCategory} />

        <BeforeAfter />

        <UseCasesCTA />
      </main>
      <Footer />
    </>
  );
}
