import Link from "next/link";
import { headers } from "next/headers";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("Metadata.download");
  return {
    title: t("title"),
    description: t("description"),
  };
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
  prerelease: boolean;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

// Detect if we're on staging environment
async function isStaging(): Promise<boolean> {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "";
    return host.includes("staging") || host.includes("localhost");
  } catch {
    return false;
  }
}

// Detect user OS from User-Agent
async function detectOS(): Promise<"macos" | "windows"> {
  try {
    const headersList = await headers();
    const ua = headersList.get("user-agent") || "";
    if (ua.includes("Windows")) return "windows";
    return "macos";
  } catch {
    return "macos";
  }
}

// Fetch all releases once (used to find platform-specific releases by tag prefix)
async function getAllReleases(isStaging: boolean): Promise<GitHubRelease[]> {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
  };

  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(
      "https://api.github.com/repos/surpriz/Queen_Mama/releases?per_page=30",
      {
        next: { revalidate: isStaging ? 60 : 300 },
        headers,
      }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// Find the latest release for a specific platform (mac/v*, win/v*, or legacy v*)
function findPlatformRelease(
  releases: GitHubRelease[],
  platform: "macos" | "windows",
  isStaging: boolean
): GitHubRelease | null {
  const prefix = platform === "macos" ? "mac/v" : "win/v";

  const platformReleases = releases.filter((r) => {
    const matchesPrefix = r.tag_name.startsWith(prefix);
    // Also match legacy v* tags that contain the right asset type
    const isLegacy = !r.tag_name.startsWith("mac/") && !r.tag_name.startsWith("win/") && r.tag_name.startsWith("v");
    const hasAsset = platform === "macos"
      ? r.assets.some((a) => a.name.endsWith(".dmg"))
      : r.assets.some((a) => a.name.endsWith(".exe"));
    return matchesPrefix || (isLegacy && hasAsset);
  });

  if (isStaging) {
    // Prefer pre-release, fallback to latest
    return platformReleases.find((r) => r.prerelease) || platformReleases[0] || null;
  } else {
    // Only stable releases
    return platformReleases.find((r) => !r.prerelease) || null;
  }
}

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

async function formatDate(dateString: string): Promise<string> {
  const locale = await getLocale();
  return new Date(dateString).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DownloadPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Download");
  const staging = await isStaging();
  const userOS = await detectOS();
  const allReleases = await getAllReleases(staging);

  const macRelease = findPlatformRelease(allReleases, "macos", staging);
  const winRelease = findPlatformRelease(allReleases, "windows", staging);

  const dmgAsset = macRelease?.assets?.find((a) => a.name.endsWith(".dmg"));
  const exeAsset = winRelease?.assets?.find((a) => a.name.endsWith(".exe"));

  // Use the release matching the user's OS for version display
  const release = userOS === "windows" ? (winRelease || macRelease) : (macRelease || winRelease);
  const primaryAsset = userOS === "windows" ? exeAsset : dmgAsset;
  const secondaryAsset = userOS === "windows" ? dmgAsset : exeAsset;

  // Extract clean version from tag (strip mac/v or win/v or just v prefix)
  const primaryVersion = (userOS === "windows" ? winRelease : macRelease)
    ?.tag_name?.replace(/^(mac|win)\/v/, "").replace(/^v/, "") || "1.0.0";
  const secondaryVersion = (userOS === "windows" ? macRelease : winRelease)
    ?.tag_name?.replace(/^(mac|win)\/v/, "").replace(/^v/, "") || "1.0.0";

  // Use proxy URL for downloads (works with private repo)
  const primaryDownloadUrl = staging
    ? `/api/download/${primaryVersion}?platform=${userOS}&prerelease=true`
    : `/api/download/${primaryVersion}?platform=${userOS}`;

  const secondaryOS = userOS === "windows" ? "macos" : "windows";
  const secondaryDownloadUrl = staging
    ? `/api/download/${secondaryVersion}?platform=${secondaryOS}&prerelease=true`
    : `/api/download/${secondaryVersion}?platform=${secondaryOS}`;

  // OS-specific content
  const isMac = userOS === "macos";

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white">
            Queen Mama
          </Link>
          <div className="flex items-center gap-4">
            {staging && (
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-full border border-yellow-500/30">
                STAGING
              </span>
            )}
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors"
            >
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Staging Warning Banner */}
          {staging && release?.prerelease && (
            <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <div className="flex items-center justify-center gap-2 text-yellow-400 font-medium">
                <span>Pre-release version - For testing only</span>
              </div>
              <p className="text-yellow-400/70 text-sm mt-1">
                This build is from the staging branch and may contain bugs.
              </p>
            </div>
          )}

          {/* Icon */}
          <div className="mb-8 flex justify-center">
            <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl shadow-2xl shadow-purple-500/25 flex items-center justify-center">
              <span className="text-6xl">{isMac ? "\uD83D\uDC51" : "\uD83D\uDC51"}</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-5xl font-bold text-white mb-4">
            {t("title")}
          </h1>
          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            {t("subtitle")}
          </p>

          {/* Primary Download Button */}
          {primaryAsset ? (
            <div className="mb-6">
              <a
                href={primaryDownloadUrl}
                className={`inline-flex items-center gap-3 ${
                  release?.prerelease
                    ? "bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 shadow-yellow-500/25 hover:shadow-yellow-500/40"
                    : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-500/25 hover:shadow-purple-500/40"
                } text-white px-10 py-5 rounded-2xl text-xl font-semibold transition-all shadow-xl hover:scale-105`}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                {release?.prerelease
                  ? t("downloadBeta")
                  : isMac
                    ? t("downloadForMac")
                    : t("downloadForWindows")}
              </a>
              <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-500">
                <span className={release?.prerelease ? "text-yellow-500" : ""}>
                  Version {primaryVersion}
                  {release?.prerelease && " (Beta)"}
                </span>
                <span>&bull;</span>
                <span>{formatFileSize(primaryAsset.size)}</span>
                {release?.published_at && (
                  <>
                    <span>&bull;</span>
                    <span>{formatDate(release.published_at)}</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-6 p-8 bg-white/5 rounded-2xl border border-white/10">
              <div className="text-gray-400 mb-2">{t("comingSoon")}</div>
              <p className="text-gray-500 text-sm">
                {t("comingSoonSub")}
              </p>
            </div>
          )}

          {/* Secondary Download Link */}
          {secondaryAsset && (
            <div className="mb-12">
              <a
                href={secondaryDownloadUrl}
                className="text-gray-400 hover:text-white transition-colors text-sm underline underline-offset-4"
              >
                {t("alsoAvailableFor", {
                  platform: isMac ? "Windows" : "macOS",
                })}
              </a>
            </div>
          )}

          {!secondaryAsset && <div className="mb-12" />}

          {/* System Requirements */}
          {isMac ? (
            <div className="grid md:grid-cols-3 gap-6 mb-16">
              <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                <div className="text-2xl mb-2">{"\uD83D\uDDA5\uFE0F"}</div>
                <h3 className="text-white font-semibold mb-1">{t("sysReqMacOS")}</h3>
                <p className="text-gray-500 text-sm">{t("sysReqMacOSSub")}</p>
              </div>
              <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                <div className="text-2xl mb-2">{"\u26A1"}</div>
                <h3 className="text-white font-semibold mb-1">{t("sysReqChip")}</h3>
                <p className="text-gray-500 text-sm">{t("sysReqChipSub")}</p>
              </div>
              <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                <div className="text-2xl mb-2">{"\uD83D\uDD12"}</div>
                <h3 className="text-white font-semibold mb-1">{t("sysReqSigned")}</h3>
                <p className="text-gray-500 text-sm">{t("sysReqSignedSub")}</p>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6 mb-16">
              <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                <div className="text-2xl mb-2">{"\uD83D\uDDA5\uFE0F"}</div>
                <h3 className="text-white font-semibold mb-1">{t("sysReqWindows")}</h3>
                <p className="text-gray-500 text-sm">{t("sysReqWindowsSub")}</p>
              </div>
              <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                <div className="text-2xl mb-2">{"\u26A1"}</div>
                <h3 className="text-white font-semibold mb-1">{t("sysReqWindowsArch")}</h3>
                <p className="text-gray-500 text-sm">{t("sysReqWindowsArchSub")}</p>
              </div>
              <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                <div className="text-2xl mb-2">{"\uD83D\uDCE6"}</div>
                <h3 className="text-white font-semibold mb-1">{t("sysReqWindowsInstaller")}</h3>
                <p className="text-gray-500 text-sm">{t("sysReqWindowsInstallerSub")}</p>
              </div>
            </div>
          )}

          {/* Installation Instructions */}
          <div className="text-left max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl font-bold text-white mb-6">{t("installation")}</h2>
            <ol className="space-y-4">
              {(isMac
                ? [
                    { title: t("installStep1"), sub: t("installStep1Sub") },
                    { title: t("installStep2"), sub: t("installStep2Sub") },
                    { title: t("installStep3"), sub: t("installStep3Sub") },
                    { title: t("installStep4"), sub: t("installStep4Sub") },
                  ]
                : [
                    { title: t("installStepWin1"), sub: t("installStepWin1Sub") },
                    { title: t("installStepWin2"), sub: t("installStepWin2Sub") },
                    { title: t("installStepWin3"), sub: t("installStepWin3Sub") },
                    { title: t("installStepWin4"), sub: t("installStepWin4Sub") },
                  ]
              ).map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-white font-medium">{step.title}</h3>
                    <p className="text-gray-500 text-sm">{step.sub}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Features Preview */}
          <div className="text-left max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">{t("whatsIncluded")}</h2>
            <ul className="space-y-3">
              {[
                t("feature1"),
                t("feature2"),
                t("feature3"),
                t("feature4"),
                t("feature5"),
                t("feature6"),
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-300">
                  <svg
                    className="w-5 h-5 text-green-500 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-gray-500 text-sm">
          <p>&copy; 2026 Queen Mama. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">
              {t("privacyPolicy")}
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              {t("termsOfService")}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
