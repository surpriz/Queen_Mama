"use client";

import { useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { Apple } from "lucide-react";

function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 12.5h8V21l-8-1.143V12.5zM3 11.5h8V3L3 4.143V11.5zM12 12.5h9V22l-9-1.286V12.5zM12 11.5h9V2l-9 1.286V11.5z" />
    </svg>
  );
}

interface OSDownloadButtonsProps {
  macDownloadUrl: string | null;
  winDownloadUrl: string | null;
  variant?: "dark" | "light";
}

type OS = "mac" | "windows" | "other";

function getOS(): OS {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (ua.includes("Mac")) return "mac";
  if (ua.includes("Windows")) return "windows";
  return "other";
}

const subscribe = () => () => {};

export default function OSDownloadButtons({
  macDownloadUrl,
  winDownloadUrl,
  variant = "dark",
}: OSDownloadButtonsProps) {
  const os = useSyncExternalStore(subscribe, getOS, () => "other" as OS);

  const isPrimary = (button: "mac" | "windows") => {
    if (os === "other") return true;
    return button === os;
  };

  const primaryClasses =
    variant === "dark"
      ? "gradient-bg text-white shadow-[var(--qm-shadow-glow)]"
      : "bg-white text-gray-900 shadow-xl hover:shadow-2xl";

  const secondaryClasses =
    variant === "dark"
      ? "bg-[var(--qm-surface-medium)] text-[var(--qm-text-secondary)] border border-[var(--qm-border-subtle)] hover:bg-[var(--qm-surface-hover)]"
      : "bg-white/20 text-white border border-white/30 hover:bg-white/30";

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {macDownloadUrl && (
        <motion.a
          href={macDownloadUrl}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          className={`inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-base transition-all ${
            isPrimary("mac") ? primaryClasses : secondaryClasses
          }`}
        >
          <Apple className="w-5 h-5" />
          Essayer sur Mac
        </motion.a>
      )}
      {winDownloadUrl && (
        <motion.a
          href={winDownloadUrl}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          className={`inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-base transition-all ${
            isPrimary("windows") ? primaryClasses : secondaryClasses
          }`}
        >
          <WindowsIcon className="w-5 h-5" />
          Essayer sur Windows
        </motion.a>
      )}
      {!macDownloadUrl && !winDownloadUrl && (
        <span className="text-[var(--qm-text-tertiary)] text-sm">
          Téléchargement bientôt disponible
        </span>
      )}
    </div>
  );
}
