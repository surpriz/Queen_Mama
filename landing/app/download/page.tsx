import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Télécharger Queen Mama pour macOS",
  description: "Assistant IA de coaching pour macOS 14.2+",
};

async function getLatestRelease() {
  try {
    const res = await fetch(
      "https://api.github.com/repos/surpriz/Queen_Mama/releases/latest",
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DownloadPage() {
  const release = await getLatestRelease();
  const dmgAsset = release?.assets?.find((a: { name: string }) =>
    a.name.endsWith(".dmg")
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-b from-purple-50 to-white">
      <h1 className="text-4xl font-bold mb-4">Télécharger Queen Mama</h1>
      <p className="text-lg text-gray-600 mb-8">
        Assistant IA de coaching pour vos meetings
      </p>

      {dmgAsset ? (
        <a
          href={dmgAsset.browser_download_url}
          className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-lg text-xl font-semibold transition-colors"
        >
          Télécharger v{release.tag_name.replace("v", "")}
        </a>
      ) : (
        <div className="text-center">
          <p className="text-gray-500 mb-4">Version en préparation...</p>
          <p className="text-sm text-gray-400">Revenez bientôt!</p>
        </div>
      )}

      <div className="mt-8 text-sm text-gray-500 text-center">
        <p>Requiert macOS 14.2 ou plus récent</p>
        <p>Compatible Apple Silicon et Intel</p>
      </div>
    </main>
  );
}
