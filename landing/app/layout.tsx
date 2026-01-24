import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BackToTop } from "@/components/ui";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { CookieConsent } from "@/components/CookieConsent";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Queen Mama - AI Coaching for High-Stakes Conversations",
  description:
    "Real-time AI assistant for interviews, sales calls & meetings. Completely undetectable on video calls. Download free for macOS.",
  keywords: [
    "AI assistant",
    "interview coach",
    "sales assistant",
    "macOS app",
    "undetectable",
    "real-time coaching",
    "job interview help",
    "video call assistant",
  ],
  authors: [{ name: "Queen Mama" }],
  creator: "Queen Mama",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://queenmama.app",
    siteName: "Queen Mama",
    title: "Queen Mama - Your Secret Weapon for High-Stakes Conversations",
    description:
      "AI coaching that stays invisible. Get real-time suggestions during interviews, sales calls, and meetings.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Queen Mama - AI Coaching Assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Queen Mama - AI Coaching for High-Stakes Conversations",
    description:
      "Real-time AI assistant that stays invisible on video calls. Download free for macOS.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <SessionProvider>
          {children}
          <BackToTop />
          <CookieConsent />
        </SessionProvider>
      </body>
    </html>
  );
}
