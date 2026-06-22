import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MiniStar English Global Lab — Living Textbook",
  description: "AAA 2029 white-label PWA learning portal. Physics-driven vocabulary games, AI authoring, xAPI anti-cheat telemetry, and immersive theme worlds.",
  keywords: ["MiniStar", "English", "ESL", "vocabulary", "games", "PWA", "white-label", "Phaser", "xAPI"],
  authors: [{ name: "MiniStar Lab" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MiniStar Lab",
  },
  openGraph: {
    title: "MiniStar English Global Lab",
    description: "Living Textbook — AAA 2029 white-label PWA learning portal",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/phaser@4.2.0/dist/phaser.min.js" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}