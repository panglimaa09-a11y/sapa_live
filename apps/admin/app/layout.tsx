import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Bahasa desain SapaLive (diselaraskan dengan aplikasi utama, audit 28 Okt 2026):
// Plus Jakarta Sans untuk teks, Fraunces untuk headline. Catatan lama yang menyebut
// Inter dimandatkan PRD tidak lagi berlaku untuk tipografi panel ini.
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
  title: {
    default: "SapaLive Admin Control Center",
    template: "%s — SapaLive Admin",
  },
  description: "Panel administrator SapaLive. Akses terbatas.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
