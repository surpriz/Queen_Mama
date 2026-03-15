import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy endpoint for downloading DMG files from private GitHub releases
 *
 * Usage:
 * - /api/download/latest - Downloads the latest stable release
 * - /api/download/1.2.7 - Downloads a specific version
 * - /api/download/latest?prerelease=true - Downloads the latest pre-release (for staging)
 */

const GITHUB_REPO = "surpriz/Queen_Mama";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

interface GitHubAsset {
  id: number;
  name: string;
  size: number;
  browser_download_url: string;
  url: string;
}

interface GitHubRelease {
  tag_name: string;
  prerelease: boolean;
  assets: GitHubAsset[];
}

async function getRelease(version: string, includePrerelease: boolean, platform: "windows" | "macos" | "electron-mac"): Promise<GitHubRelease | null> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "QueenMama-Download-Proxy",
  };

  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    if (version === "latest") {
      // Fetch all releases and find the right one by platform
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=30`,
        { headers, next: { revalidate: includePrerelease ? 60 : 300 } }
      );
      if (!res.ok) return null;
      const releases: GitHubRelease[] = await res.json();
      const ext = platform === "windows" ? ".exe" : ".dmg";
      const tagPrefix = platform === "electron-mac" ? "electron-mac/" : platform === "windows" ? "win/" : "mac/";

      const filtered = releases.filter((r) => {
        if (includePrerelease ? false : r.prerelease) return false;
        if (platform === "electron-mac") return r.tag_name.startsWith(tagPrefix) && r.assets.some((a) => a.name.endsWith(ext));
        return r.assets.some((a) => a.name.endsWith(ext));
      });

      if (includePrerelease) {
        return filtered.find((r) => r.prerelease) || filtered[0] || null;
      }
      return filtered[0] || null;
    } else {
      // Try platform-prefixed tag first (mac/v1.3.17 or win/v1.0.0 or electron-mac/v1.0.0), then legacy (v1.3.17)
      const prefix = platform === "windows" ? "win" : platform === "electron-mac" ? "electron-mac" : "mac";
      const cleanVersion = version.startsWith("v") ? version.slice(1) : version;
      const tagsToTry = platform === "electron-mac"
        ? [`electron-mac/v${cleanVersion}`]
        : [`${prefix}/v${cleanVersion}`, `v${cleanVersion}`];

      for (const tag of tagsToTry) {
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${encodeURIComponent(tag)}`,
          { headers, next: { revalidate: 3600 } }
        );
        if (res.ok) return res.json();
      }
      return null;
    }
  } catch {
    return null;
  }
}

async function downloadAsset(asset: GitHubAsset): Promise<Response | null> {
  const headers: HeadersInit = {
    Accept: "application/octet-stream",
    "User-Agent": "QueenMama-Download-Proxy",
  };

  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    // Use the API URL with octet-stream accept header to get the binary
    const res = await fetch(asset.url, { headers });
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  }
}

function detectPlatform(request: NextRequest): "windows" | "macos" | "electron-mac" {
  const platformParam = request.nextUrl.searchParams.get("platform");
  if (platformParam === "windows") return "windows";
  if (platformParam === "macos") return "macos";
  if (platformParam === "electron-mac") return "electron-mac";

  // Auto-detect from User-Agent
  const ua = request.headers.get("user-agent") || "";
  if (ua.includes("Windows") || ua.includes("electron-updater")) return "windows";
  return "macos";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ version: string }> }
) {
  const { version } = await params;
  const searchParams = request.nextUrl.searchParams;
  const includePrerelease = searchParams.get("prerelease") === "true";
  const platform = detectPlatform(request);

  // Get the release
  const release = await getRelease(version, includePrerelease, platform);
  if (!release) {
    return NextResponse.json(
      { error: "Release not found" },
      { status: 404 }
    );
  }

  // Find the appropriate asset based on platform
  const extension = platform === "windows" ? ".exe" : ".dmg";
  const asset = release.assets.find((a) => a.name.endsWith(extension));
  if (!asset) {
    return NextResponse.json(
      { error: `${extension.toUpperCase().slice(1)} not found in release` },
      { status: 404 }
    );
  }

  // Download and stream the asset
  const assetResponse = await downloadAsset(asset);
  if (!assetResponse) {
    return NextResponse.json(
      { error: "Failed to download asset" },
      { status: 502 }
    );
  }

  // Stream the response with appropriate headers
  return new NextResponse(assetResponse.body, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asset.name}"`,
      "Content-Length": asset.size.toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
