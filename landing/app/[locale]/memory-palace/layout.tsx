import { setRequestLocale, getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("Metadata.memoryPalace");
  return {
    title: t("title"),
    description: t("description"),
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
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "https://queenmama.app/memory-palace",
      siteName: "Queen Mama",
      images: [
        {
          url: "/og-memory-palace.png",
          width: 1200,
          height: 630,
          alt: t("ogImageAlt"),
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("twitterTitle"),
      description: t("twitterDescription"),
      images: ["/og-memory-palace.png"],
    },
  };
}

export default async function MemoryPalaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <>{children}</>;
}
