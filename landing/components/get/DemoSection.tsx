"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Container } from "@/components/ui";
import { Video, Users, Mic, MonitorOff } from "lucide-react";
import WidgetMockup from "./WidgetMockup";

interface Scenario {
  transcript: string;
  response: string;
}

const SCENARIOS: Scenario[] = [
  {
    transcript:
      "Le prospect : \"Notre budget est déjà alloué pour ce trimestre.\"",
    response:
      "Relance : Justement, la plupart de nos clients ont commencé par un pilote gratuit pour prouver le ROI avant d'engager du budget. On peut faire pareil ?",
  },
  {
    transcript:
      "Le prospect : \"Comment vous gérez la conformité RGPD exactement ?\"",
    response:
      "Données clés : Toutes les données sont traitées en Europe, certifié RGPD, aucun enregistrement conservé après la session. DPA disponible sur demande.",
  },
  {
    transcript: "... (silence prolongé du prospect)",
    response:
      "Relance suggérée : Pour résumer les 3 points clés qu'on a abordés — est-ce que ça correspond à ce que vous cherchiez ?",
  },
];

const VISIO_LOGOS = [
  { name: "Zoom", icon: Video },
  { name: "Teams", icon: Users },
  { name: "Meet", icon: Mic },
];

type Phase = "transcript" | "thinking" | "response" | "pause";

export default function DemoSection() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("transcript");
  const [transcriptVisible, setTranscriptVisible] = useState(false);

  const scenario = SCENARIOS[scenarioIndex];

  const advancePhase = useCallback(() => {
    setPhase((current) => {
      switch (current) {
        case "transcript":
          return "thinking";
        case "thinking":
          return "response";
        case "response":
          return "pause";
        case "pause":
          setScenarioIndex((i) => (i + 1) % SCENARIOS.length);
          setTranscriptVisible(false);
          return "transcript";
      }
    });
  }, []);

  useEffect(() => {
    if (phase === "transcript") {
      setTranscriptVisible(false);
      const timer = setTimeout(() => {
        setTranscriptVisible(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [phase, scenarioIndex]);

  useEffect(() => {
    const durations: Record<Phase, number> = {
      transcript: 2500,
      thinking: 1500,
      response: 5000,
      pause: 1500,
    };
    const timer = setTimeout(advancePhase, durations[phase]);
    return () => clearTimeout(timer);
  }, [phase, advancePhase, scenarioIndex]);

  return (
    <section className="py-24 relative">
      <Container size="lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--qm-text-primary)] mb-4">
            En action
          </h2>
          <p className="text-[var(--qm-text-secondary)] text-lg">
            Voyez comment Queen Mama vous accompagne en temps réel.
          </p>
        </motion.div>

        {/* Meeting screen simulation */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="relative max-w-4xl mx-auto"
        >
          {/* Browser-like frame */}
          <div className="rounded-2xl overflow-hidden border border-[var(--qm-border-medium)] bg-[var(--qm-bg-primary)] shadow-2xl">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[var(--qm-bg-secondary)] border-b border-[var(--qm-border-subtle)]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-md bg-[var(--qm-surface-light)] text-xs text-[var(--qm-text-tertiary)]">
                  Réunion en cours...
                </div>
              </div>
            </div>

            {/* Meeting content */}
            <div className="relative aspect-video bg-[var(--qm-bg-primary)] flex items-center justify-center p-8">
              {/* Fake meeting participants */}
              <div className="grid grid-cols-2 gap-4 w-full max-w-lg opacity-30">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="aspect-video rounded-xl bg-[var(--qm-bg-tertiary)] flex items-center justify-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-[var(--qm-surface-medium)]" />
                  </div>
                ))}
              </div>

              {/* Transcript overlay (left side) */}
              <AnimatePresence>
                {transcriptVisible && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="absolute bottom-6 left-6 max-w-[260px] px-4 py-3 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10"
                  >
                    <p className="text-xs text-white/60 font-medium mb-1">
                      Transcription
                    </p>
                    <p className="text-sm text-white/90 leading-relaxed">
                      {scenario.transcript}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Queen Mama widget (bottom right) */}
              <div className="absolute bottom-6 right-6">
                <WidgetMockup
                  text={
                    phase === "thinking"
                      ? "Analyse en cours..."
                      : phase === "response" || phase === "pause"
                        ? scenario.response
                        : ""
                  }
                  isTyping={phase === "response"}
                  className={
                    phase === "thinking"
                      ? "animate-pulse"
                      : ""
                  }
                />
              </div>
            </div>
          </div>

          {/* Scenario dots */}
          <div className="flex justify-center gap-2 mt-6">
            {SCENARIOS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  i === scenarioIndex
                    ? "bg-[var(--qm-accent)]"
                    : "bg-[var(--qm-surface-medium)]"
                }`}
              />
            ))}
          </div>
        </motion.div>

        {/* Visio compatibility line */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col items-center gap-4 mt-10"
        >
          <div className="flex items-center gap-2">
            <MonitorOff className="w-4 h-4 text-[var(--qm-text-tertiary)]" />
            <p className="text-sm text-[var(--qm-text-tertiary)]">
              Invisible sur Zoom, Teams, Meet et tous les outils de visio.
            </p>
          </div>
          <div className="flex items-center gap-6">
            {VISIO_LOGOS.map((logo) => (
              <div
                key={logo.name}
                className="flex items-center gap-1.5 text-[var(--qm-text-tertiary)] opacity-50"
              >
                <logo.icon className="w-4 h-4" />
                <span className="text-xs">{logo.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
