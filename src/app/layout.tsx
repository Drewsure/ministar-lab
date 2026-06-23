import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import PWAInstallPrompt from "@/components/ministar/PWAInstallPrompt";

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
  description: "AAAA 2029 white-label PWA learning portal. 17 physics-driven vocabulary games, AI authoring, live multiplayer, adaptive difficulty, and ten immersive theme worlds.",
  keywords: ["MiniStar", "English", "ESL", "vocabulary", "games", "PWA", "white-label", "Phaser", "xAPI", "multiplayer", "AI"],
  authors: [{ name: "MiniStar Lab" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192" },
      { url: "/icon-512.png", sizes: "512x512" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MiniStar Lab",
  },
  openGraph: {
    title: "MiniStar English Global Lab",
    description: "Living Textbook — AAAA 2029 white-label PWA learning portal with 17 games, AI authoring, and live multiplayer",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: 'var(--brand-bg)', color: 'var(--brand-text)' }}
      >
        {children}
        <Toaster />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
