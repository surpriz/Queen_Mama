import { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

const baseUrl = "https://queenmama.app";

const publicPages = [
  "",
  "/download",
  "/manifesto",
  "/changelog",
  "/memory-palace",
  "/use-cases",
  "/features-guide",
  "/windows-waitlist",
  "/privacy",
  "/terms",
  "/dpa",
  "/subprocessors",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of publicPages) {
    entries.push({
      url: `${baseUrl}${page}`,
      lastModified: new Date(),
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((locale) => [
            locale,
            `${baseUrl}/${locale}${page}`,
          ])
        ),
      },
    });
  }

  return entries;
}
