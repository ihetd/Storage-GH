import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  IBM_Plex_Sans_Arabic,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif display face reserved for headings (paired with the gold heading color).
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

// Arabic fallback: Geist/Playfair have no Arabic glyphs, so Arabic text
// (e.g. category or product names) falls through to IBM Plex Sans Arabic.
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  applicationName: "GymHood Storage",
  title: "GymHood Storage",
  description: "Internal stock management",
  manifest: "/manifest.webmanifest",
  // iOS "Add to Home Screen": fullscreen standalone, title, and status bar.
  appleWebApp: {
    capable: true,
    title: "GymHood",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#080808",
  // Fill the whole screen on notched iPhones when launched from the home screen.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${plexArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-ink text-cream">{children}</body>
    </html>
  );
}
