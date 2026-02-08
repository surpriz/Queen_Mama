import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features Guide - QueenMama | Complete Feature Reference",
  description:
    "Master every Queen Mama feature. Learn what each button does, how to use it, and why it matters — from session recording to AI coaching to Memory Palace.",
  keywords: [
    "Queen Mama features",
    "AI coaching guide",
    "real-time transcription",
    "meeting assistant features",
    "keyboard shortcuts",
    "AI assistant guide",
    "overlay widget",
    "conversation modes",
    "auto-answer",
    "Memory Palace",
    "talk time analytics",
    "screen capture",
  ],
  openGraph: {
    title: "Features Guide - QueenMama | Master Every Feature",
    description:
      "The complete reference guide to every Queen Mama feature. Understand what each button does, how to activate it, and why it's valuable.",
    url: "https://queenmama.app/features-guide",
    siteName: "Queen Mama",
    images: [
      {
        url: "/og-features-guide.png",
        width: 1200,
        height: 630,
        alt: "QueenMama Features Guide - Complete Feature Reference",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Features Guide - QueenMama | Complete Feature Reference",
    description:
      "Master every Queen Mama feature. The complete guide to real-time AI coaching, transcription, and conversation intelligence.",
    images: ["/og-features-guide.png"],
  },
};

export default function FeaturesGuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
