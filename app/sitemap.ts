import type { MetadataRoute } from "next";
import { absoluteUrl, ogImage, siteUrl } from "./lib/seo";

const routes = [
  {
    path: "/",
    changeFrequency: "weekly",
    priority: 1,
    images: [ogImage.url, absoluteUrl("/routevision-platform-preview.png")],
  },
  {
    path: "/app",
    changeFrequency: "weekly",
    priority: 0.8,
    images: [ogImage.url],
  },
] satisfies Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
  images?: string[];
}>;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routes.map((route) => ({
    url: route.path === "/" ? siteUrl : absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    images: route.images,
  }));
}
