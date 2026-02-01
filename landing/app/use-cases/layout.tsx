import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Use Cases - QueenMama | AI Coaching for Every Scenario",
  description:
    "Discover 32+ use cases for QueenMama: job interviews, sales calls, investor pitches, coding exams, thesis defenses, and more. Real-time AI coaching for every high-stakes conversation.",
  keywords: [
    "AI interview coach",
    "sales call assistant",
    "coding interview help",
    "presentation coaching",
    "real-time AI assistant",
    "job interview preparation",
    "salary negotiation tips",
    "thesis defense help",
    "meeting assistant",
    "professional coaching AI",
  ],
  openGraph: {
    title: "Use Cases - QueenMama | One Assistant, Infinite Scenarios",
    description:
      "From job interviews to investor pitches, discover how QueenMama adapts to every high-stakes conversation with real-time AI coaching.",
    url: "https://queenmama.app/use-cases",
    siteName: "Queen Mama",
    images: [
      {
        url: "/og-use-cases.png",
        width: 1200,
        height: 630,
        alt: "QueenMama Use Cases - AI Coaching for Every Scenario",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Use Cases - QueenMama | AI Coaching for Every Scenario",
    description:
      "32+ use cases: interviews, sales, coding exams, thesis defenses. Real-time AI coaching that stays invisible.",
    images: ["/og-use-cases.png"],
  },
};

export default function UseCasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
