"use client";

import { useReducer, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Container } from "@/components/ui";
import { Video, Users, Mic, MicOff, MonitorOff } from "lucide-react";
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

const PARTICIPANTS = [
  { initials: "TM", name: "Thomas Martin", color: "bg-blue-600", muted: false },
  { initials: "SL", name: "Sophie Laurent", color: "bg-emerald-600", muted: true },
  { initials: "Vous", name: "Vous", color: "bg-purple-600", muted: false },
  { initials: "JD", name: "Julie Dupont", color: "bg-amber-600", muted: true },
];

const VISIO_LOGOS = [
  { name: "Zoom", icon: Video },
  { name: "Teams", icon: Users },
  { name: "Meet", icon: Mic },
];

type Phase = "transcript" | "thinking" | "response" | "pause";

interface DemoState {
  phase: Phase;
  scenarioIndex: number;
  transcriptVisible: boolean;
}

function demoReducer(state: DemoState, action: "advance" | "show_transcript"): DemoState {
  if (action === "show_transcript") {
    return { ...state, transcriptVisible: true };
  }
  // advance
  switch (state.phase) {
    case "transcript":
      return { ...state, phase: "thinking" };
    case "thinking":
      return { ...state, phase: "response" };
    case "response":
      return { ...state, phase: "pause" };
    case "pause":
      return {
        phase: "transcript",
        scenarioIndex: (state.scenarioIndex + 1) % SCENARIOS.length,
        transcriptVisible: false,
      };
  }
}

export default function DemoSection() {
  const [state, dispatch] = useReducer(demoReducer, {
    phase: "transcript",
    scenarioIndex: 0,
    transcriptVisible: false,
  });

  const { phase, scenarioIndex, transcriptVisible } = state;
  const scenario = SCENARIOS[scenarioIndex];

  useEffect(() => {
    if (phase === "transcript") {
      const timer = setTimeout(() => dispatch("show_transcript"), 300);
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
    const timer = setTimeout(() => dispatch("advance"), durations[phase]);
    return () => clearTimeout(timer);
  }, [phase, scenarioIndex]);

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
            Votre prochain call, avec Queen Mama
          </h2>
          <p className="text-[var(--qm-text-secondary)] text-lg">
            Voici ce qui se passe sur votre écran pendant que vous parlez.
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
              <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-xl">
                {PARTICIPANTS.map((p) => (
                  <div
                    key={p.initials}
                    className="relative aspect-video rounded-xl bg-[var(--qm-bg-tertiary)] border border-[var(--qm-border-subtle)] flex flex-col items-center justify-center overflow-hidden"
                  >
                    {/* Gradient background per participant */}
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full ${p.color} flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-lg`}>
                      {p.initials}
                    </div>
                    {/* Name label */}
                    <span className="mt-2 text-[10px] sm:text-xs text-white/70 font-medium">
                      {p.name}
                    </span>
                    {/* Mic indicator */}
                    <div className={`absolute bottom-2 right-2 p-1 rounded-full ${p.muted ? "bg-red-500/80" : "bg-[var(--qm-surface-medium)]"}`}>
                      {p.muted
                        ? <MicOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                        : <Mic className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white/70" />
                      }
                    </div>
                    {/* Speaking indicator ring */}
                    {!p.muted && (
                      <div className="absolute inset-0 rounded-xl border-2 border-[var(--qm-accent)]/30 animate-pulse pointer-events-none" />
                    )}
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
              Invisible pour votre interlocuteur. Compatible Zoom, Teams, Meet et toutes les apps de visio.
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
