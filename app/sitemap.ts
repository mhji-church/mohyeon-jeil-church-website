import type { MetadataRoute } from "next";

const publicPaths = ["", "/about", "/worship", "/sermons", "/bulletin", "/news", "/business", "/gallery"];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map((path, index) => ({
    url: `https://mhji.kr${path}`,
    changeFrequency: index === 0 ? "weekly" : "monthly",
    priority: index === 0 ? 1 : 0.7,
  }));
}
