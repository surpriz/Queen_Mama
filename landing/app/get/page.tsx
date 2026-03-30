import { headers } from "next/headers";
import HeroSection from "@/components/get/HeroSection";
import HowItWorksSection from "@/components/get/HowItWorksSection";
import DemoSection from "@/components/get/DemoSection";
import CTASection from "@/components/get/CTASection";
import MiniFooter from "@/components/get/MiniFooter";

interface GitHubRelease {
  tag_name: string;
  prerelease: boolean;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

async function isStaging(): Promise<boolean> {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "";
    return host.includes("staging") || host.includes("localhost");
  } catch {
    return false;
  }
}

async function getDownloadUrls(): Promise<{
  mac: string | null;
  win: string | null;
}> {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const fetchHeaders: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
  };
  if (GITHUB_TOKEN) {
    fetchHeaders.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  const staging = await isStaging();

  try {
    const res = await fetch(
      "https://api.github.com/repos/surpriz/Queen_Mama/releases?per_page=30",
      {
        next: { revalidate: staging ? 60 : 300 },
        headers: fetchHeaders,
      }
    );
    if (!res.ok) return { mac: null, win: null };
    const releases: GitHubRelease[] = await res.json();

    // Find Mac release
    const macReleases = releases.filter(
      (r) =>
        r.tag_name.startsWith("mac/v") &&
        r.assets.some((a) => a.name.endsWith(".dmg"))
    );
    const macRelease = staging
      ? macReleases.find((r) => r.prerelease) || macReleases[0]
      : macReleases.find((r) => !r.prerelease);
    const macVersion = macRelease?.tag_name
      ?.replace(/^mac\/v/, "")
      .replace(/^v/, "");

    // Find Windows release
    const winReleases = releases.filter(
      (r) =>
        r.tag_name.startsWith("win/v") &&
        r.assets.some((a) => a.name.endsWith(".exe"))
    );
    const winRelease = staging
      ? winReleases.find((r) => r.prerelease) || winReleases[0]
      : winReleases.find((r) => !r.prerelease);
    const winVersion = winRelease?.tag_name
      ?.replace(/^win\/v/, "")
      .replace(/^v/, "");

    const macUrl = macVersion
      ? `/api/download/${macVersion}?platform=macos${staging ? "&prerelease=true" : ""}`
      : null;
    const winUrl = winVersion
      ? `/api/download/${winVersion}?platform=windows${staging ? "&prerelease=true" : ""}`
      : null;

    return { mac: macUrl, win: winUrl };
  } catch {
    return { mac: null, win: null };
  }
}

export default async function GetPage() {
  const { mac, win } = await getDownloadUrls();

  return (
    <main className="min-h-screen bg-[var(--qm-bg-primary)]">
      <HeroSection macDownloadUrl={mac} winDownloadUrl={win} />
      <HowItWorksSection />
      <DemoSection />
      <CTASection macDownloadUrl={mac} winDownloadUrl={win} />
      <MiniFooter />
    </main>
  );
}
