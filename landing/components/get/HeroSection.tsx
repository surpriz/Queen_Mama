"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui";
import OSDownloadButtons from "./OSDownloadButtons";
import WidgetMockup from "./WidgetMockup";

interface HeroSectionProps {
  macDownloadUrl: string | null;
  winDownloadUrl: string | null;
}

const HERO_SUGGESTION =
  "Relance : Justement, la plupart de nos clients ont commencé par un pilote gratuit pour prouver le ROI avant d'engager du budget. On peut faire pareil ?";

export default function HeroSection({ macDownloadUrl, winDownloadUrl }: HeroSectionProps) {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[var(--qm-purple)] rounded-full blur-[128px] opacity-20" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[var(--qm-blue)] rounded-full blur-[128px] opacity-15" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <Container size="xl" className="relative z-10 py-20 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column — Text + CTA */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--qm-text-primary)] leading-tight mb-6">
              L&apos;argument que vous auriez dû dire...{" "}
              <span className="gradient-text">soufflé en temps réel.</span>
            </h1>
            <p className="text-lg text-[var(--qm-text-secondary)] mb-8 max-w-xl leading-relaxed">
              Pendant votre prochain call, les bonnes réponses s&apos;affichent
              sur votre écran — au bon moment, sans que personne ne le voie.
            </p>

            <OSDownloadButtons
              macDownloadUrl={macDownloadUrl}
              winDownloadUrl={winDownloadUrl}
              variant="dark"
            />

            <p className="mt-4 text-sm text-[var(--qm-text-tertiary)]">
              Gratuit · Installation en 30 secondes · Aucune carte requise
            </p>
          </motion.div>

          {/* Right column — Widget mockup */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="flex justify-center lg:justify-end"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <WidgetMockup text={HERO_SUGGESTION} isTyping={true} />
            </motion.div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
