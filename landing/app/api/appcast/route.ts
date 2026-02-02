import { NextRequest, NextResponse } from "next/server";

/**
 * Dynamic appcast.xml generator for Sparkle updates
 * Uses proxy URLs so private repo releases can be downloaded
 */

const GITHUB_REPO = "surpriz/Queen_Mama";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

interface GitHubAsset {
  name: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  published_at: string;
  prerelease: boolean;
  body: string;
  assets: GitHubAsset[];
}

// Map version strings to build numbers for Sparkle
function versionToBuildNumber(version: string): number {
  // Remove 'v' prefix and any prerelease suffix
  const cleanVersion = version.replace(/^v/, "").split("-")[0];
  const parts = cleanVersion.split(".").map((p) => parseInt(p, 10) || 0);

  // Calculate build number: major * 1000 + minor * 100 + patch
  // e.g., 1.2.7 -> 1*1000 + 2*100 + 7 = 1207
  // This ensures newer versions always have higher build numbers
  return parts[0] * 1000 + (parts[1] || 0) * 100 + (parts[2] || 0);
}

async function getStableReleases(): Promise<GitHubRelease[]> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "QueenMama-Appcast",
  };

  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`,
      { headers, next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const releases: GitHubRelease[] = await res.json();
    // Filter to only stable releases (no prereleases)
    return releases.filter((r) => !r.prerelease);
  } catch {
    return [];
  }
}

function formatPubDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toUTCString();
}

function generateAppcastXml(releases: GitHubRelease[], baseUrl: string): string {
  const items = releases
    .map((release) => {
      const dmgAsset = release.assets.find((a) => a.name.endsWith(".dmg"));
      if (!dmgAsset) return "";

      const version = release.tag_name.replace(/^v/, "");
      const buildNumber = versionToBuildNumber(release.tag_name);
      const downloadUrl = `${baseUrl}/api/download/${version}`;

      return `
    <item>
      <title>Version ${version}</title>
      <description><![CDATA[
Queen Mama ${version} - Nouvelle version disponible.
${release.body || "Consultez les notes de version sur GitHub pour plus de détails."}
      ]]></description>
      <pubDate>${formatPubDate(release.published_at)}</pubDate>
      <sparkle:version>${buildNumber}</sparkle:version>
      <sparkle:shortVersionString>${version}</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>14.2</sparkle:minimumSystemVersion>
      <enclosure
        url="${downloadUrl}"
        length="${dmgAsset.size}"
        type="application/octet-stream"
      />
    </item>`;
    })
    .filter(Boolean)
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?>
<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" version="2.0">
  <channel>
    <title>Queen Mama Updates</title>
    <link>${baseUrl}/api/appcast</link>
    <description>Most recent updates to Queen Mama</description>
    <language>fr</language>
    ${items}
  </channel>
</rss>`;
}

export async function GET(request: NextRequest) {
  const releases = await getStableReleases();

  // Determine base URL from request
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("host") || "queenmama.co";
  const baseUrl = `${protocol}://${host}`;

  const xml = generateAppcastXml(releases, baseUrl);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300", // 5 minutes
    },
  });
}
