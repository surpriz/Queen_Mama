import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Catch-all download route for electron-updater.
 *
 * electron-updater constructs download URLs by combining the feed base URL
 * with the `url` field from latest.yml. For example:
 *   base: https://www.queenmama.co/api/updates/windows
 *   url:  QueenMama-Setup-1.0.9.exe
 *   →     https://www.queenmama.co/api/updates/windows/QueenMama-Setup-1.0.9.exe
 *
 * This route extracts the version from the filename and proxies the download
 * from the corresponding GitHub release asset.
 */

const GITHUB_REPO = "surpriz/Queen_Mama";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function isStaging(): Promise<boolean> {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "";
    return host.includes("staging") || host.includes("localhost");
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Extract version from filename (e.g., "QueenMama-Setup-1.0.9.exe" → "1.0.9")
  const versionMatch = filename.match(/(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/);
  if (!versionMatch) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  const version = versionMatch[1];
  const staging = await isStaging();

  // Determine the GitHub release tag
  const tagsToTry = [`win/v${version}`, `v${version}`];

  const reqHeaders: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "QueenMama-Update-Proxy",
  };

  if (GITHUB_TOKEN) {
    reqHeaders.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  for (const tag of tagsToTry) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${encodeURIComponent(tag)}`,
        { headers: reqHeaders, next: { revalidate: staging ? 60 : 3600 } }
      );
      if (!res.ok) continue;

      const release = await res.json();
      const asset = release.assets?.find(
        (a: { name: string }) => a.name.endsWith(".exe")
      );

      if (!asset) continue;

      // Stream the binary from GitHub
      const dlHeaders: HeadersInit = {
        Accept: "application/octet-stream",
        "User-Agent": "QueenMama-Update-Proxy",
      };
      if (GITHUB_TOKEN) {
        dlHeaders.Authorization = `Bearer ${GITHUB_TOKEN}`;
      }

      const dlRes = await fetch(asset.url, { headers: dlHeaders });
      if (!dlRes.ok) continue;

      return new NextResponse(dlRes.body, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${asset.name}"`,
          "Content-Length": asset.size.toString(),
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch {
      continue;
    }
  }

  return new NextResponse("Release not found", { status: 404 });
}
