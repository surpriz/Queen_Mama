"use client";

import { motion } from "framer-motion";
import { Container, GlassCard } from "@/components/ui";
import { Mic, BrainCircuit, Zap } from "lucide-react";

const STEPS = [
  {
    icon: Mic,
    number: "1",
    title: "Lancez votre appel",
    description:
      "Démarrez Queen Mama avant votre rdv. L'app tourne en arrière-plan.",
  },
  {
    icon: BrainCircuit,
    number: "2",
    title: "L'IA écoute et analyse",
    description:
      "Transcription en temps réel + capture d'écran pour comprendre le contexte.",
  },
  {
    icon: Zap,
    number: "3",
    title: "Recevez les bons arguments",
    description:
      "Objections, relances, données clés — affichés dans un widget invisible pour votre interlocuteur.",
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-24">
      <Container size="lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--qm-text-primary)] mb-4">
            Comment ça marche
          </h2>
          <p className="text-[var(--qm-text-secondary)] text-lg max-w-2xl mx-auto">
            Trois étapes. Zéro configuration compliquée.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {STEPS.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
            >
              <GlassCard hover padding="lg" className="h-full text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full gradient-bg text-white font-bold text-lg mb-5">
                  {step.number}
                </div>
                <div className="flex justify-center mb-4">
                  <step.icon className="w-8 h-8 text-[var(--qm-accent)]" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--qm-text-primary)] mb-3">
                  {step.title}
                </h3>
                <p className="text-[var(--qm-text-secondary)] leading-relaxed">
                  {step.description}
                </p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
