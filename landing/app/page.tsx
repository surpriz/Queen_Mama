import dynamicImport from "next/dynamic";
import { Navbar, Hero } from "@/components/sections";
import { SectionSkeleton } from "@/components/ui";

// Force static generation for homepage
export const dynamic = "force-static";

// Lazy load below-the-fold sections for better initial load performance
const Features = dynamicImport(() => import("@/components/sections/Features").then(mod => mod.Features), {
  loading: () => <SectionSkeleton height="600px" />,
});

const Modes = dynamicImport(() => import("@/components/sections/Modes").then(mod => mod.Modes), {
  loading: () => <SectionSkeleton height="500px" />,
});

const HowItWorks = dynamicImport(() => import("@/components/sections/HowItWorks").then(mod => mod.HowItWorks), {
  loading: () => <SectionSkeleton height="700px" />,
});

const Undetectable = dynamicImport(() => import("@/components/sections/Undetectable").then(mod => mod.Undetectable), {
  loading: () => <SectionSkeleton height="500px" />,
});

const Pricing = dynamicImport(() => import("@/components/sections/Pricing").then(mod => mod.Pricing), {
  loading: () => <SectionSkeleton height="600px" />,
});

const FAQ = dynamicImport(() => import("@/components/sections/FAQ").then(mod => mod.FAQ), {
  loading: () => <SectionSkeleton height="400px" />,
});

const Contact = dynamicImport(() => import("@/components/sections/Contact").then(mod => mod.Contact), {
  loading: () => <SectionSkeleton height="300px" />,
});

const CTA = dynamicImport(() => import("@/components/sections/CTA").then(mod => mod.CTA), {
  loading: () => <SectionSkeleton height="300px" />,
});

const Footer = dynamicImport(() => import("@/components/sections/Footer").then(mod => mod.Footer), {
  loading: () => <SectionSkeleton height="200px" />,
});

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Modes />
        <HowItWorks />
        <Undetectable />
        <Pricing />
        <FAQ />
        <Contact />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
