import { Metadata } from "next";
import { LegalPageLayout } from "@/components/LegalPageLayout";
import { GlassCard } from "@/components/ui";

export const metadata: Metadata = {
  title: "Subprocessors - Queen Mama",
  description:
    "List of third-party service providers that process data on behalf of Queen Mama.",
};

const subprocessors = [
  {
    name: "OpenAI",
    purpose: "AI language model provider for generating responses",
    location: "United States",
    website: "https://openai.com",
  },
  {
    name: "Anthropic",
    purpose: "AI language model provider (Claude) for generating responses",
    location: "United States",
    website: "https://anthropic.com",
  },
  {
    name: "Google (Gemini)",
    purpose: "AI language model provider for generating responses",
    location: "United States",
    website: "https://deepmind.google/technologies/gemini/",
  },
  {
    name: "Deepgram",
    purpose: "Real-time speech-to-text transcription",
    location: "United States",
    website: "https://deepgram.com",
  },
  {
    name: "AssemblyAI",
    purpose: "Speech-to-text transcription (fallback provider)",
    location: "United States",
    website: "https://assemblyai.com",
  },
  {
    name: "Vercel",
    purpose: "Website hosting and deployment",
    location: "United States",
    website: "https://vercel.com",
  },
  {
    name: "Apple",
    purpose: "macOS platform and Keychain for secure credential storage",
    location: "United States",
    website: "https://apple.com",
  },
];

export default function SubprocessorsPage() {
  return (
    <LegalPageLayout
      title="Subprocessors"
      lastUpdated="January 2026"
      description="This page provides transparency about where your data goes and how it is processed. Queen Mama uses the following third-party service providers."
    >
      {/* Important Notice */}
      <GlassCard hover={false} className="mb-8">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[rgba(139,92,246,0.15)] flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-[var(--qm-accent)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">
              Your API Keys, Your Control
            </h3>
            <p className="text-sm text-[var(--qm-text-secondary)]">
              Queen Mama uses <strong>your own API keys</strong> to connect to AI and
              transcription providers. Your data is sent directly to these providers
              under your account, not through our servers. We never store your
              conversations or transcriptions.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Subprocessors Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--qm-border-subtle)]">
              <th className="text-left py-4 px-4 text-sm font-semibold text-white">
                Name
              </th>
              <th className="text-left py-4 px-4 text-sm font-semibold text-white">
                Purpose
              </th>
              <th className="text-left py-4 px-4 text-sm font-semibold text-white">
                Location
              </th>
              <th className="text-left py-4 px-4 text-sm font-semibold text-white">
                Website
              </th>
            </tr>
          </thead>
          <tbody>
            {subprocessors.map((sp, index) => (
              <tr
                key={sp.name}
                className={`border-b border-[var(--qm-border-subtle)] ${
                  index % 2 === 0 ? "bg-[var(--qm-surface-light)]" : ""
                }`}
              >
                <td className="py-4 px-4 text-sm text-white font-medium">
                  {sp.name}
                </td>
                <td className="py-4 px-4 text-sm text-[var(--qm-text-secondary)]">
                  {sp.purpose}
                </td>
                <td className="py-4 px-4 text-sm text-[var(--qm-text-tertiary)]">
                  {sp.location}
                </td>
                <td className="py-4 px-4 text-sm">
                  <a
                    href={sp.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--qm-accent)] hover:text-[var(--qm-accent-light)] transition-colors"
                  >
                    {sp.website.replace("https://", "")}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Additional Info */}
      <div className="mt-12 space-y-6">
        <h2 className="text-2xl font-semibold text-white">
          Data Processing Details
        </h2>

        <div className="space-y-4 text-[var(--qm-text-secondary)]">
          <p>
            <strong className="text-white">AI Providers (OpenAI, Anthropic, Google):</strong>{" "}
            When you use Queen Mama, your transcribed conversation and screen context
            are sent to your chosen AI provider to generate suggestions. This data is
            processed according to each provider&apos;s privacy policy and data retention
            practices.
          </p>

          <p>
            <strong className="text-white">Transcription Providers (Deepgram, AssemblyAI):</strong>{" "}
            Audio from your microphone is streamed to your chosen transcription provider
            for real-time speech-to-text conversion. We recommend reviewing each
            provider&apos;s data handling practices.
          </p>

          <p>
            <strong className="text-white">Local Storage:</strong>{" "}
            Session history, preferences, and mode configurations are stored locally
            on your Mac using SwiftData. API keys are securely stored in your macOS
            Keychain and never transmitted to our servers.
          </p>
        </div>

        <h2 className="text-2xl font-semibold text-white pt-6">
          Changes to This List
        </h2>

        <p className="text-[var(--qm-text-secondary)]">
          We may update this list from time to time as we add or change service
          providers. We recommend checking this page periodically for any updates.
        </p>
      </div>
    </LegalPageLayout>
  );
}
