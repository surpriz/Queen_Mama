import type { Metadata } from "next";
import SetLang from "./set-lang";

export const metadata: Metadata = {
  title: "Télécharger Queen Mama — Assistant IA pour vos appels",
  description:
    "Queen Mama analyse vos appels en temps réel et vous souffle les bons arguments. Invisible pour votre interlocuteur. Gratuit sur Mac et Windows.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Queen Mama — L'argument qu'il vous fallait, en temps réel",
    description:
      "Assistant IA invisible qui vous souffle les bons arguments pendant vos appels. Téléchargement gratuit.",
    type: "website",
  },
};

export default function GetLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SetLang />
      {children}
    </>
  );
}
