import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Proxy endpoint for Windows auto-update feed (electron-updater)
 *
 * Fetches the latest.yml from the corresponding GitHub release and proxies it,
 * rewriting download URLs to use the landing download proxy.
 *
 * - Staging (staging.queenmama.co) → serves pre-release latest.yml
 * - Production (www.queenmama.co) → serves stable latest.yml
 */

const GITHUB_REPO = "surpriz/Queen_Mama";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

interface GitHubAsset {
  name: string;
  url: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  prerelease: boolean;
  assets: GitHubAsset[];
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

async function getWindowsRelease(includePrerelease: boolean): Promise<GitHubRelease | null> {
  const reqHeaders: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "QueenMama-Update-Proxy",
  };

  if (GITHUB_TOKEN) {
    reqHeaders.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=30`,
      { headers: reqHeaders, next: { revalidate: includePrerelease ? 60 : 300 } }
    );
    if (!res.ok) return null;
    const releases: GitHubRelease[] = await res.json();

    // Find the latest Windows release (win/v* tag with latest.yml asset)
    const windowsReleases = releases.filter((r) => {
      const isWinTag = r.tag_name.startsWith("win/v");
      const hasLatestYml = r.assets.some((a) => a.name === "latest.yml");
      return isWinTag && hasLatestYml;
    });

    if (includePrerelease) {
      return windowsReleases.find((r) => r.prerelease) || windowsReleases[0] || null;
    } else {
      return windowsReleases.find((r) => !r.prerelease) || null;
    }
  } catch {
    return null;
  }
}

export async function GET() {
  const staging = await isStaging();
  const release = await getWindowsRelease(staging);

  if (!release) {
    return new NextResponse("Release not found", { status: 404 });
  }

  // Find the latest.yml asset
  const latestYmlAsset = release.assets.find((a) => a.name === "latest.yml");
  if (!latestYmlAsset) {
    return new NextResponse("latest.yml not found in release", { status: 404 });
  }

  // Fetch the latest.yml content from GitHub
  const reqHeaders: HeadersInit = {
    Accept: "application/octet-stream",
    "User-Agent": "QueenMama-Update-Proxy",
  };

  if (GITHUB_TOKEN) {
    reqHeaders.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  const assetRes = await fetch(latestYmlAsset.url, { headers: reqHeaders });
  if (!assetRes.ok) {
    return new NextResponse("Failed to fetch latest.yml", { status: 502 });
  }

  let yamlContent = await assetRes.text();

  // Rewrite download URLs to use our download proxy
  // electron-builder latest.yml contains lines like:
  //   url: QueenMama-Setup-1.0.0.exe
  // We need to rewrite to use our proxy URL
  const version = release.tag_name.replace(/^(win\/)?v/, "");
  const baseUrl = staging
    ? "https://staging.queenmama.co"
    : "https://www.queenmama.co";

  // Replace relative .exe URLs with absolute proxy URLs
  yamlContent = yamlContent.replace(
    /url:\s*(.+\.exe)/g,
    `url: ${baseUrl}/api/download/${version}?platform=windows${staging ? "&prerelease=true" : ""}`
  );

  return new NextResponse(yamlContent, {
    status: 200,
    headers: {
      "Content-Type": "text/yaml",
      "Cache-Control": staging
        ? "public, max-age=60"
        : "public, max-age=300",
    },
  });
}
