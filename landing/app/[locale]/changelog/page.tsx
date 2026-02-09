import { setRequestLocale, getTranslations } from "next-intl/server";
import { LegalPageLayout } from "@/components/LegalPageLayout";
import { ChangelogEntry } from "@/components/changelog/ChangelogEntry";
import { changelogData } from "@/lib/changelog-data";

// Force static generation for this page
export const dynamic = "force-static";

export async function generateMetadata() {
  const t = await getTranslations("Metadata.changelog");
  return {
    title: t("title"),
    description: t("description"),
  };
}

type Props = { params: Promise<{ locale: string }> };

export default async function ChangelogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Changelog");
  return (
    <LegalPageLayout
      title={t("title")}
      description={t("description")}
    >
      <div className="space-y-6">
        {changelogData.map((release) => (
          <ChangelogEntry
            key={release.date}
            date={release.date}
            isNew={release.isNew}
            sections={release.sections}
          />
        ))}
      </div>
    </LegalPageLayout>
  );
}
