import { Metadata } from "next";
import { LegalPageLayout } from "@/components/LegalPageLayout";
import { ChangelogEntry } from "@/components/changelog/ChangelogEntry";
import { changelogData } from "@/lib/changelog-data";

export const metadata: Metadata = {
  title: "Changelog - Queen Mama",
  description: "Discover what's new in Queen Mama. Follow our journey as we continuously improve your AI coaching experience.",
};

export default function ChangelogPage() {
  return (
    <LegalPageLayout
      title="Changelog"
      description="Follow Queen Mama's evolution as we build the ultimate AI coaching assistant for your meetings, interviews, and calls."
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
