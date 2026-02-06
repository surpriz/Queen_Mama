import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Memory Palace - QueenMama | AI-Powered Contact Management",
  description:
    "Memory Palace automatically extracts contacts from your conversations, builds relationship profiles, and briefs you before meetings. Your AI-powered mini-CRM.",
  keywords: [
    "AI contact management",
    "conversation CRM",
    "relationship intelligence",
    "meeting preparation",
    "contact extraction",
    "professional networking tool",
    "AI meeting assistant",
    "pre-session briefing",
    "automatic contact sync",
    "relationship tracking",
  ],
  openGraph: {
    title: "Memory Palace - QueenMama | Never Forget a Name Again",
    description:
      "AI-powered mini-CRM that automatically extracts contacts from conversations, tracks relationships, and briefs you before meetings.",
    url: "https://queenmama.app/memory-palace",
    siteName: "Queen Mama",
    images: [
      {
        url: "/og-memory-palace.png",
        width: 1200,
        height: 630,
        alt: "QueenMama Memory Palace - AI-Powered Contact Management",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Memory Palace - QueenMama | AI-Powered Contact Management",
    description:
      "Never walk into a meeting unprepared. Memory Palace builds your personal CRM from conversations automatically.",
    images: ["/og-memory-palace.png"],
  },
};

export default function MemoryPalaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
