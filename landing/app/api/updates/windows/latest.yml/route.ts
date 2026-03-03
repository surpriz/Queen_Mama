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

async function getRelease(includePrerelease: boolean): Promise<GitHubRelease | null> {
  const reqHeaders: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "QueenMama-Update-Proxy",
  };

  if (GITHUB_TOKEN) {
    reqHeaders.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    if (includePrerelease) {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=10`,
        { headers: reqHeaders, next: { revalidate: 60 } }
      );
      if (!res.ok) return null;
      const releases: GitHubRelease[] = await res.json();
      return releases[0] || null;
    } else {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: reqHeaders, next: { revalidate: 300 } }
      );
      if (!res.ok) return null;
      return res.json();
    }
  } catch {
    return null;
  }
}

export async function GET() {
  const staging = await isStaging();
  const release = await getRelease(staging);

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
  const version = release.tag_name.replace("v", "");
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
