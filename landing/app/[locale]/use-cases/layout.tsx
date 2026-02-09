import { setRequestLocale, getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("Metadata.useCases");
  return {
    title: t("title"),
    description: t("description"),
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
      title: t("title"),
      description: t("description"),
      url: "https://queenmama.app/use-cases",
      siteName: "Queen Mama",
      images: [
        {
          url: "/og-use-cases.png",
          width: 1200,
          height: 630,
          alt: t("title"),
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: ["/og-use-cases.png"],
    },
  };
}

type Props = {
  params: Promise<{ locale: string }>;
  children: React.ReactNode;
};

export default async function UseCasesLayout({ params, children }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <>{children}</>;
}
