import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// avoid-ai-design-ignore: T1 (Inter dimandatkan PRD addendum v1.2)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"],
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
    <html lang="id" className={inter.variable}>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
