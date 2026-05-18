import DistanceVisualizer from "@/app/components/DistanceVisualizer";

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RouteVision",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "RouteVision is a route analytics and lane planning platform for saving routes, comparing distances, analyzing travel times, and syncing route history across devices.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Route analytics dashboard",
      "Lane planning",
      "Saved route history",
      "Distance comparison",
      "Travel time comparison",
      "Cloud route sync",
      "Map export",
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <DistanceVisualizer />
    </>
  );
}
