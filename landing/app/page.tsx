import {
  Navbar,
  Hero,
  Features,
  Modes,
  HowItWorks,
  Undetectable,
  Pricing,
  FAQ,
  Contact,
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
        <Contact />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
