// avoid-ai-design-ignore-file: T1 (PRD mandates Inter)
import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "../lib/i18n";
import SwRegister from "../components/SwRegister";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sapalive.my.id"),
  title: {
    default: "SapaLive — Temukan Teman Baru, Mulai Percakapan",
    template: "%s — SapaLive",
  },
  description:
    "SapaLive mempertemukanmu lewat video call 1 lawan 1 dengan orang baru. Acak, instan, aman. Khusus 18+.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
  openGraph: {
    title: "SapaLive — Temukan Teman Baru, Mulai Percakapan",
    description:
      "Platform sosial real-time: pencocokan acak, video chat, dan pesan teks. Khusus 18+.",
    url: "https://sapalive.my.id",
    siteName: "SapaLive",
    locale: "id_ID",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body
        className={`${jakarta.variable} ${fraunces.variable} bg-paper font-sans text-ink antialiased`}
      >
        <LanguageProvider>
          <SwRegister />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
