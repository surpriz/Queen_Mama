import { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Download Queen Mama for macOS",
  description:
    "Download Queen Mama - Your AI coaching assistant for high-stakes conversations. Requires macOS 14.2+",
};

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
function isStaging(): boolean {
  try {
    const headersList = headers();
    const host = headersList.get("host") || "";
    return host.includes("staging") || host.includes("localhost");
  } catch {
    return false;
  }
}

async function getRelease(isStaging: boolean): Promise<GitHubRelease | null> {
  try {
    if (isStaging) {
      // For staging: get the latest pre-release
      const res = await fetch(
        "https://api.github.com/repos/surpriz/Queen_Mama/releases",
        {
          next: { revalidate: 60 }, // Revalidate every 1 minute for staging
          headers: {
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      if (!res.ok) return null;
      const releases: GitHubRelease[] = await res.json();
      // Find the latest pre-release
      const prerelease = releases.find((r) => r.prerelease);
      // Fallback to latest release if no pre-release exists
      return prerelease || releases[0] || null;
    } else {
      // For production: get the latest stable release
      const res = await fetch(
        "https://api.github.com/repos/surpriz/Queen_Mama/releases/latest",
        {
          next: { revalidate: 300 }, // Revalidate every 5 minutes
          headers: {
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      if (!res.ok) return null;
      return res.json();
    }
  } catch {
    return null;
  }
}

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function DownloadPage() {
  const staging = isStaging();
  const release = await getRelease(staging);
  const dmgAsset = release?.assets?.find((a) => a.name.endsWith(".dmg"));
  const version = release?.tag_name?.replace("v", "") || "1.0.0";

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
              ← Back to Home
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
                <span>⚠️</span>
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
              <span className="text-6xl">👑</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-5xl font-bold text-white mb-4">
            Download Queen Mama
          </h1>
          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            Your AI-powered secret weapon for interviews, sales calls, and
            high-stakes meetings. Completely undetectable on video calls.
          </p>

          {/* Download Button */}
          {dmgAsset ? (
            <div className="mb-12">
              <a
                href={dmgAsset.browser_download_url}
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
                {release?.prerelease ? "Download Beta" : "Download for macOS"}
              </a>
              <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-500">
                <span className={release?.prerelease ? "text-yellow-500" : ""}>
                  Version {version}
                  {release?.prerelease && " (Beta)"}
                </span>
                <span>•</span>
                <span>{formatFileSize(dmgAsset.size)}</span>
                {release?.published_at && (
                  <>
                    <span>•</span>
                    <span>{formatDate(release.published_at)}</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-12 p-8 bg-white/5 rounded-2xl border border-white/10">
              <div className="text-gray-400 mb-2">Coming Soon</div>
              <p className="text-gray-500 text-sm">
                The first release is being prepared. Check back soon!
              </p>
            </div>
          )}

          {/* System Requirements */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <div className="p-6 bg-white/5 rounded-xl border border-white/10">
              <div className="text-2xl mb-2">🖥️</div>
              <h3 className="text-white font-semibold mb-1">macOS 14.2+</h3>
              <p className="text-gray-500 text-sm">Sonoma or later required</p>
            </div>
            <div className="p-6 bg-white/5 rounded-xl border border-white/10">
              <div className="text-2xl mb-2">⚡</div>
              <h3 className="text-white font-semibold mb-1">Apple Silicon</h3>
              <p className="text-gray-500 text-sm">M1, M2, M3 & Intel supported</p>
            </div>
            <div className="p-6 bg-white/5 rounded-xl border border-white/10">
              <div className="text-2xl mb-2">🔒</div>
              <h3 className="text-white font-semibold mb-1">Signed & Notarized</h3>
              <p className="text-gray-500 text-sm">Verified by Apple</p>
            </div>
          </div>

          {/* Installation Instructions */}
          <div className="text-left max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl font-bold text-white mb-6">Installation</h2>
            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                  1
                </span>
                <div>
                  <h3 className="text-white font-medium">Download the DMG</h3>
                  <p className="text-gray-500 text-sm">
                    Click the download button above
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                  2
                </span>
                <div>
                  <h3 className="text-white font-medium">Open the DMG file</h3>
                  <p className="text-gray-500 text-sm">
                    Double-click the downloaded file
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                  3
                </span>
                <div>
                  <h3 className="text-white font-medium">
                    Drag to Applications
                  </h3>
                  <p className="text-gray-500 text-sm">
                    Drag Queen Mama to your Applications folder
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                  4
                </span>
                <div>
                  <h3 className="text-white font-medium">Grant permissions</h3>
                  <p className="text-gray-500 text-sm">
                    Allow microphone and screen recording when prompted
                  </p>
                </div>
              </li>
            </ol>
          </div>

          {/* Features Preview */}
          <div className="text-left max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">What&apos;s Included</h2>
            <ul className="space-y-3">
              {[
                "Real-time transcription with Deepgram Nova-3",
                "AI coaching from GPT-4, Claude, or Gemini",
                "Invisible overlay - undetectable on Zoom, Meet, Teams",
                "Smart mode suggestions based on context",
                "Session recording and cloud sync (PRO)",
                "Automatic updates via Sparkle",
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
          <p>© 2026 Queen Mama. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
