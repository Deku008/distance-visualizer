export const siteUrl = "https://routevision.online";
export const siteName = "RouteVision";

export const homeTitle = "RouteVision — Smart Route & Lane Planning Platform";
export const homeDescription =
  "Plan, visualize, and optimize routes with RouteVision. Compare ETAs, distances, facilities, relocation decisions, logistics lanes, and travel routes intelligently.";

export const appTitle = "RouteVision Planner";
export const appDescription =
  "Open the RouteVision interactive planner to visualize saved lanes, compare distances, review ETAs, and manage route planning workflows.";

export const seoKeywords = [
  "RouteVision",
  "route planning",
  "logistics planning",
  "ETA comparison",
  "distance calculator",
  "lane planning",
  "trip planning",
  "family relocation planning",
  "facility planning",
  "smart route visualization",
  "enterprise logistics",
  "logistics route optimization",
  "route intelligence",
  "logistics analytics",
];

export const featureList = [
  "Lane visualization",
  "Live route planning",
  "Distance comparison",
  "ETA comparison",
  "Facility planning",
  "Family relocation planning",
  "Trip planning",
  "Premium analytics",
  "Export support",
  "Priority cloud sync",
];

export const absoluteUrl = (path = "/") => new URL(path, siteUrl).toString();

export const ogImage = {
  url: absoluteUrl("/opengraph-image"),
  width: 1200,
  height: 630,
  alt: "RouteVision smart route and lane planning platform preview",
};
