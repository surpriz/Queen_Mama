import {
  Navbar,
  Hero,
  Features,
  Modes,
  HowItWorks,
  Undetectable,
  Pricing,
  FAQ,
  CTA,
  Footer,
} from "@/components/sections";

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
        <CTA />
      </main>
      <Footer />
    </>
  );
}
