"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui";
import OSDownloadButtons from "./OSDownloadButtons";

interface CTASectionProps {
  macDownloadUrl: string | null;
  winDownloadUrl: string | null;
}

export default function CTASection({ macDownloadUrl, winDownloadUrl }: CTASectionProps) {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 gradient-bg opacity-90" />
      <div className="absolute inset-0 bg-black/20" />

      <Container size="md" className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Une longueur d&apos;avance, à chaque call.
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto">
            Téléchargez-le. Testez-le sur votre prochain call. Devenez imbattable.
          </p>

          <div className="flex justify-center">
            <OSDownloadButtons
              macDownloadUrl={macDownloadUrl}
              winDownloadUrl={winDownloadUrl}
              variant="light"
            />
          </div>

          <p className="mt-5 text-sm text-white/60">
            Gratuit · Mac & Windows · Prêt en 30 secondes
          </p>
        </motion.div>
      </Container>
    </section>
  );
}
