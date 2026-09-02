import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/member/", "/archive/admin/", "/privacy"],
    },
    sitemap: "https://mhji.kr/sitemap.xml",
    host: "https://mhji.kr",
  };
}
