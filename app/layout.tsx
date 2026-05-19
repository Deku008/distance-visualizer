import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { absoluteUrl, siteUrl } from "./lib/seo";
import "./globals.css";

const title = "RouteVision";
const description =
  "RouteVision is a route analytics and lane planning platform for saving routes, comparing distances, analyzing travel times, and syncing route history across devices.";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: title,
  title: {
    default: "RouteVision | Route Analytics and Lane Planning Platform",
    template: "%s | RouteVision",
  },
  description,
  keywords: [
    "RouteVision",
    "route analytics",
    "lane planning",
    "route history",
    "travel time analytics",
    "distance comparison",
    "route planning platform",
    "fleet route visualization",
  ],
  authors: [{ name: "RouteVision" }],
  creator: "RouteVision",
  publisher: "RouteVision",
  category: "Route analytics software",
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "64x64" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "RouteVision | Route Analytics and Lane Planning Platform",
    description,
    url: siteUrl,
    siteName: "RouteVision",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: absoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: "RouteVision route analytics and lane planning dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RouteVision | Route Analytics and Lane Planning Platform",
    description,
    images: [absoluteUrl("/opengraph-image")],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-hidden">{children}</body>
    </html>
  );
}
