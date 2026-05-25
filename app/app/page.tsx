import type { Metadata } from "next";
import DistanceVisualizer from "@/app/components/DistanceVisualizer";
import { absoluteUrl, appDescription, appTitle, ogImage, siteName } from "@/app/lib/seo";

export const metadata: Metadata = {
  title: appTitle,
  description: appDescription,
  alternates: {
    canonical: absoluteUrl("/app"),
  },
  openGraph: {
    title: appTitle,
    description:
      "Visualize logistics lanes, compare routes, and manage route planning workflows in the RouteVision app.",
    url: absoluteUrl("/app"),
    siteName,
    type: "website",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: appTitle,
    description: appDescription,
    images: [ogImage.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function AppPage() {
  return <DistanceVisualizer />;
}
