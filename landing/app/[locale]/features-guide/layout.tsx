import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata.featuresGuide");

  return {
    title: t("title"),
    description: t("description"),
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
      title: t("title"),
      description: t("description"),
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
      title: t("title"),
      description: t("description"),
      images: ["/og-features-guide.png"],
    },
  };
}

export default function FeaturesGuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
