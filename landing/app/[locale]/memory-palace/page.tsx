"use client";

import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import {
  MemoryPalaceHero,
  FeatureShowcase,
  HowMemoryPalaceWorks,
  MemoryPalaceBeforeAfter,
  MemoryPalaceCTA,
} from "@/components/sections/memory-palace";

export default function MemoryPalacePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <MemoryPalaceHero />
        <FeatureShowcase />
        <HowMemoryPalaceWorks />
        <MemoryPalaceBeforeAfter />
        <MemoryPalaceCTA />
      </main>
      <Footer />
    </>
  );
}
