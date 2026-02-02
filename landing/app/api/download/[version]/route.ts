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

async function getRelease(version: string, includePrerelease: boolean): Promise<GitHubRelease | null> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "QueenMama-Download-Proxy",
  };

  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    if (version === "latest") {
      if (includePrerelease) {
        // Get all releases and find the most recent (including prereleases)
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=10`,
          { headers, next: { revalidate: 60 } }
        );
        if (!res.ok) return null;
        const releases: GitHubRelease[] = await res.json();
        return releases[0] || null;
      } else {
        // Get the latest stable release
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
          { headers, next: { revalidate: 300 } }
        );
        if (!res.ok) return null;
        return res.json();
      }
    } else {
      // Get a specific version
      const tag = version.startsWith("v") ? version : `v${version}`;
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${tag}`,
        { headers, next: { revalidate: 3600 } }
      );
      if (!res.ok) return null;
      return res.json();
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ version: string }> }
) {
  const { version } = await params;
  const searchParams = request.nextUrl.searchParams;
  const includePrerelease = searchParams.get("prerelease") === "true";

  // Get the release
  const release = await getRelease(version, includePrerelease);
  if (!release) {
    return NextResponse.json(
      { error: "Release not found" },
      { status: 404 }
    );
  }

  // Find the DMG asset
  const dmgAsset = release.assets.find((a) => a.name.endsWith(".dmg"));
  if (!dmgAsset) {
    return NextResponse.json(
      { error: "DMG not found in release" },
      { status: 404 }
    );
  }

  // Download and stream the asset
  const assetResponse = await downloadAsset(dmgAsset);
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
      "Content-Disposition": `attachment; filename="${dmgAsset.name}"`,
      "Content-Length": dmgAsset.size.toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
